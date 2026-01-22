import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { getCorsHeaders, corsResponse, getRequestOrigin, getKnowledgeSourceContents } from "@/lib/chat-utils";
import { findLiveChatRoom, listLiveChatMessages } from "@/lib/live-chat";
import { invokeChatVertexAI } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { retrieveRelevantChunks } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

/**
 * Owner-only: draft an AI reply for the visitor's latest message.
 * Grounds the draft in the bot's knowledge base so facts (pricing, plans, etc.) stay accurate.
 * Fills the owner's composer so they can edit before sending.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const origin = getRequestOrigin(req);
    try {
        const { roomId } = await params;
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const room = await findLiveChatRoom(roomId);
        if (!room) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }
        if (room.bot.userId !== session.user.id) {
            return corsResponse({ error: "Not authorized for this chat" }, origin, null, 403);
        }

        const bot = await prisma.bot.findUnique({
            where: { id: room.botId },
            select: {
                id: true,
                name: true,
                systemPrompt: true,
                description: true,
                defaultLanguage: true,
                allowedOrigin: true,
            },
        });
        if (!bot) {
            return corsResponse({ error: "Assistant not found" }, origin, null, 404);
        }

        const messages = await listLiveChatMessages(roomId);
        const visitorName = room.visitor?.name || "Customer";

        const transcript = messages
            .map((m) => `${m.sender === "VISITOR" ? visitorName : "You"}: ${m.content}`)
            .join("\n");

        const latestVisitorMessage =
            [...messages].reverse().find((m) => m.sender === "VISITOR")?.content || "";

        const retrievedChunks = latestVisitorMessage
            ? await retrieveRelevantChunks({ botId: bot.id, query: latestVisitorMessage })
            : [];

        let knowledgeContext = "";
        if (retrievedChunks.length > 0) {
            knowledgeContext = retrievedChunks
                .map((chunk, i) => {
                    const title =
                        (typeof chunk.metadata?.title === "string" && chunk.metadata.title) ||
                        (typeof chunk.metadata?.section === "string" && chunk.metadata.section) ||
                        "Unknown";
                    return `[Source ${i + 1}: ${title}]\n${chunk.content}`;
                })
                .join("\n\n---\n\n");
        } else {
            const knowledgeContents = await getKnowledgeSourceContents(bot.id);
            knowledgeContext = knowledgeContents.join("\n\n---\n\n");
        }

        const systemInstruction = [
            bot.name ? `Assistant / brand: ${bot.name}.` : "",
            bot.allowedOrigin ? `Website: ${bot.allowedOrigin}` : "",
            bot.description ? `About the business: ${bot.description}` : "",
            bot.systemPrompt ? `\nBusiness guidance:\n${bot.systemPrompt}` : "",
            "You are helping the business owner reply inside a live customer chat.",
            "Write a reply that a real human support agent would send: warm, concise, on-brand.",
            "Use ONLY the knowledge below for facts (plans, pricing, features, policies). Do not invent or guess.",
            "If the knowledge does not cover the answer, say you will confirm and get back — do not make up numbers or plan details.",
            "Match the customer's language when they write in another language.",
            "Only output the reply text — no quotes, prefixes, or explanations.",
            "Never mention knowledge base, sources, context, or documents.",
            knowledgeContext
                ? `\n\nKNOWLEDGE:\n${knowledgeContext}`
                : "\n\nNo knowledge is available. Do not invent product facts; keep the reply general and offer to confirm details.",
        ].filter(Boolean).join("\n");

        const userPrompt = [
            transcript ? `Chat so far:\n${transcript}\n` : "",
            latestVisitorMessage
                ? `Latest customer message to answer:\n${latestVisitorMessage}\n`
                : "",
            "Draft the owner's next reply to the customer now.",
        ].filter(Boolean).join("\n");

        const reply = await invokeChatVertexAI({
            systemInstruction,
            userPrompt,
            type: "text",
            userId: session.user.id,
            sessionId: roomId,
            metadata: { botId: room.botId, liveChatSuggestion: true },
        });

        return corsResponse({ reply }, origin, null);
    } catch (error) {
        console.error("Suggest live chat reply error:", error);
        return corsResponse({ error: "Failed to generate a reply" }, origin, null, 500);
    }
}
