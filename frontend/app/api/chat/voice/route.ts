import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invokeChatVertexAI, invokeChatVertexAIMultimodal } from "@/lib/gemini";
import {
    findBot,
    getKnowledgeSourceContents,
    extractWidgetApiKey,
    needsWidgetApiKeyValidation,
    validateWidgetApiKey,
    validateOrigin,
    getCorsHeaders,
    corsResponse,
    getRequestOrigin,
    upsertAuthorizedVisitor,
    VisitorProfileInput
} from "@/lib/chat-utils";
import { assertCanCreateConversation, EntitlementError } from "@/lib/entitlements";
import { retrieveRelevantChunks, buildRAGPrompt, buildPromptGuardrails } from "@/lib/rag";
import {
    isContactIntentMessage,
    parseBotFallbackContacts,
    stripContactMarkers,
} from "@/lib/fallback-contact";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin, null),
    });
}

export async function POST(req: NextRequest) {
    const origin = getRequestOrigin(req);

    try {
        const body = await req.json();
        const {
            botId,
            botName,
            audioData,
            mimeType,
            sessionId,
            visitorId,
            visitorToken,
            visitorAccessToken,
            visitorProfile,
            widgetApiKey,
        } = body as {
            botId?: string;
            botName?: string;
            audioData?: string;
            mimeType?: string;
            sessionId?: string;
            visitorId?: string;
            visitorToken?: string;
            visitorAccessToken?: string;
            visitorProfile?: VisitorProfileInput;
            widgetApiKey?: string;
        };

        if (!audioData) {
            return corsResponse({ error: "Audio data is required" }, origin, null, 400);
        }

        const bot = await findBot({ botId, botName });
        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        const originCheck = validateOrigin(origin, bot.allowedOrigin, req);
        if (!originCheck.valid) {
            return corsResponse({ error: originCheck.error }, origin, bot.allowedOrigin, originCheck.status);
        }

        const suppliedKey = extractWidgetApiKey(req, { widgetApiKey });
        if (needsWidgetApiKeyValidation({ visitorId, visitorToken, widgetApiKey: suppliedKey })) {
            const validation = validateWidgetApiKey({ bot, suppliedKey });
            if (!validation.valid) {
                return corsResponse({ error: validation.error }, origin, bot.allowedOrigin, validation.status);
            }
        }

        try {
            await assertCanCreateConversation(bot.userId);
        } catch (err) {
            if (err instanceof EntitlementError) {
                return corsResponse(
                    { error: err.message },
                    origin,
                    bot.allowedOrigin,
                    err.status
                );
            }
            throw err;
        }

        const authorized = await upsertAuthorizedVisitor({
            bot,
            req,
            accessToken: visitorAccessToken,
            sessionId,
            profile: visitorProfile,
        });
        if (!authorized) {
            return corsResponse({ error: "Invalid visitor session" }, origin, bot.allowedOrigin, 401);
        }
        const visitor = authorized.visitor;

        const recentConversations = await prisma.conversation.findMany({
            where: {
                botId: bot.id,
                ...(visitor?.id
                    ? { visitorId: visitor.id }
                    : sessionId
                      ? { sessionId }
                      : {}),
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        const conversationHistory = recentConversations
            .reverse()
            .map((c: any) => `User: ${c.userMessage}\nAssistant: ${c.aiResponse}`)
            .join("\n\n");

        // First pass: transcribe only (avoid loading full knowledge sources via Accelerate)
        const transcriptInstruction = [
            "You are a precise speech transcription assistant.",
            "Transcribe the user's audio exactly. Return ONLY a valid JSON object with one field: \"transcription\".",
            "No markdown, no extra text — only the JSON object.",
        ].join(" ");

        const rawTranscript = await invokeChatVertexAIMultimodal({
            systemInstruction: transcriptInstruction,
            media: {
                mimeType: mimeType || "audio/webm",
                data: audioData,
            },
            text: "Transcribe the audio exactly. Return ONLY JSON: {\"transcription\":\"...\"}",
            type: "default",
            userId: bot.userId,
            sessionId: sessionId || undefined,
            metadata: { botId: bot.id, botName: bot.name, modality: "voice-transcribe" },
        });

        let transcription = "";
        try {
            const jsonText = rawTranscript
                .replace(/^```(?:json)?\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();
            const parsed = JSON.parse(jsonText);
            transcription = String(parsed.transcription || "");
        } catch {
            transcription = rawTranscript.trim();
        }

        const userMessage = transcription || "[Voice message]";

        const retrievedChunks = transcription
            ? await retrieveRelevantChunks({ botId: bot.id, query: transcription })
            : [];

        const configuredContacts = parseBotFallbackContacts(bot);
        const hasFallbackContact = configuredContacts.length > 0;
        const contactIntent = isContactIntentMessage(userMessage);

        let systemInstruction: string;
        let userPrompt: string;

        if (retrievedChunks.length > 0) {
            const ragPrompt = buildRAGPrompt({
                systemPrompt: bot.systemPrompt,
                userMessage,
                retrievedChunks,
                conversationHistory,
                defaultLanguage: bot.defaultLanguage,
                assistantName: bot.name,
                hasFallbackContact,
            });
            systemInstruction = ragPrompt.systemInstruction;
            userPrompt = ragPrompt.userPrompt;
        } else {
            const knowledgeContents = await getKnowledgeSourceContents(bot.id);
            const knowledgeContext = knowledgeContents.join("\n\n---\n\n");
            systemInstruction = [
                bot.systemPrompt,
                knowledgeContext
                    ? `\n\nUse ONLY the knowledge below to answer. Do not invent facts. Never mention context, sources, or documents in your reply.\n\nKNOWLEDGE:\n${knowledgeContext}`
                    : "",
                bot.description
                    ? `\n\nAbout the business/website: ${bot.description}`
                    : "",
                buildPromptGuardrails({
                    assistantName: bot.name,
                    defaultLanguage: bot.defaultLanguage,
                    hasFallbackContact,
                }),
            ].join("");
            userPrompt = [
                conversationHistory
                    ? `Previous conversation:\n${conversationHistory}\n\n`
                    : "",
                `User: ${userMessage}`,
            ].join("");
        }

        const rawAiResponse =
            (
                await invokeChatVertexAI({
                    systemInstruction,
                    userPrompt,
                    type: "text",
                    userId: bot.userId,
                    sessionId: sessionId || undefined,
                    metadata: { botId: bot.id, botName: bot.name, modality: "voice" },
                })
            ).trim() || "I'm sorry, I couldn't process that audio.";

        const { cleaned, shouldShowContact } = stripContactMarkers(rawAiResponse);
        const aiResponse = cleaned || "I'm sorry, I couldn't process that audio.";

        const conversation = await prisma.conversation.create({
            data: {
                botId: bot.id,
                userMessage,
                aiResponse,
                sessionId: sessionId || null,
                visitorId: visitor?.id || null,
            },
        });

        if (visitor?.id) {
            await prisma.visitor.update({
                where: { id: visitor.id },
                data: { lastSeenAt: conversation.createdAt },
            });
        }

        const fallbackContacts =
            hasFallbackContact && (shouldShowContact || contactIntent)
                ? configuredContacts
                : null;

        return corsResponse({
            id: conversation.id,
            transcription,
            response: aiResponse,
            createdAt: conversation.createdAt,
            visitorId: visitor?.id || null,
            visitorAccessToken: authorized.accessToken,
            fallbackContacts,
        }, origin, bot.allowedOrigin);
    } catch (error: any) {
        console.error("Voice chat error:", error);
        return corsResponse({
            error: "Failed to process voice message",
            details: error?.message || "Unknown error",
        }, origin, null, 500);
    }
}
