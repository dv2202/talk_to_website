import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paceStreamByWords, streamChatVertexAI } from "@/lib/gemini";
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
import { retrieveRelevantChunks, buildRAGPrompt, buildPromptGuardrails } from "@/lib/rag";
import { assertCanCreateConversation, EntitlementError } from "@/lib/entitlements";
import {
    getStreamableResponse,
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
            message,
            sessionId,
            visitorId,
            visitorToken,
            visitorAccessToken,
            visitorProfile,
            widgetApiKey,
        } = body as {
            botId?: string;
            botName?: string;
            message?: string;
            sessionId?: string;
            visitorId?: string;
            visitorToken?: string;
            visitorAccessToken?: string;
            visitorProfile?: VisitorProfileInput;
            widgetApiKey?: string;
        };

        if (!message) {
            return corsResponse({ error: "Message is required" }, origin, null, 400);
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
            .map((conversation: any) => `User: ${conversation.userMessage}\nAssistant: ${conversation.aiResponse}`)
            .join("\n\n");

        // Try RAG retrieval first
        const retrievedChunks = await retrieveRelevantChunks({
            botId: bot.id,
            query: message,
        });

        const configuredContacts = parseBotFallbackContacts(bot);
        const hasFallbackContact = configuredContacts.length > 0;
        const contactIntent = isContactIntentMessage(message);

        let systemInstruction: string;
        let userPrompt: string;

        if (retrievedChunks.length > 0) {
            // Use RAG-based prompt
            const ragPrompt = buildRAGPrompt({
                systemPrompt: bot.systemPrompt,
                userMessage: message,
                retrievedChunks,
                conversationHistory,
                defaultLanguage: bot.defaultLanguage,
                assistantName: bot.name,
                hasFallbackContact,
            });
            systemInstruction = ragPrompt.systemInstruction;
            userPrompt = ragPrompt.userPrompt;
        } else {
            // Fallback to full context only when no indexed chunks exist
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
                `User: ${message}`,
            ].join("");
        }

        const encoder = new TextEncoder();
        const corsHeaders = getCorsHeaders(origin, bot.allowedOrigin);

        const stream = new ReadableStream({
            async start(controller) {
                const send = (payload: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
                };

                let fullResponse = "";
                let streamedLength = 0;

                try {

                    const pacedStream = paceStreamByWords(
                        streamChatVertexAI({
                            systemInstruction,
                            userPrompt,
                            type: "text",
                            userId: bot.userId,
                            sessionId: sessionId || undefined,
                            metadata: { botId: bot.id, botName: bot.name },
                        }),
                        { wordsPerChunk: 3, delayMs: 40 }
                    );

                    for await (const token of pacedStream) {
                        fullResponse += token;
                        const visible = getStreamableResponse(fullResponse);
                        if (visible.length > streamedLength) {
                            send({ type: "token", text: visible.slice(streamedLength) });
                            streamedLength = visible.length;
                        }
                    }

                    const { cleaned, shouldShowContact } = stripContactMarkers(
                        fullResponse.trim() || "I'm sorry, I couldn't generate a response."
                    );
                    const aiResponse = cleaned || "I'm sorry, I couldn't generate a response.";

                    const conversation = await prisma.conversation.create({
                        data: {
                            botId: bot.id,
                            userMessage: message,
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

                    send({
                        type: "done",
                        id: conversation.id,
                        response: aiResponse,
                        createdAt: conversation.createdAt,
                        visitorId: visitor?.id || null,
                        visitorAccessToken: authorized.accessToken,
                        fallbackContacts,
                    });
                } catch (error: any) {
                    console.error("Chat stream error:", error);
                    send({
                        type: "error",
                        error: "Failed to generate response",
                        details: error?.message || "Unknown error",
                    });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                ...corsHeaders,
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        });
    } catch (error: any) {
        console.error("Chat error:", error);
        return corsResponse({
            error: "Failed to generate response",
            details: error?.message || "Unknown error",
        }, origin, null, 500);
    }
}
