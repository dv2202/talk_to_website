import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractWidgetApiKey, validateOrigin, getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin, null),
    });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    const origin = getRequestOrigin(req);

    try {
        const { botId } = await params;
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get("sessionId");
        const visitorId = searchParams.get("visitorId");

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: { widgetApiKey: true, allowedOrigin: true },
        });

        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        if (visitorId && visitorId.trim()) {
            const suppliedKey = extractWidgetApiKey(req);
            if (!suppliedKey) {
                return corsResponse({ error: "Widget API key is required" }, origin, bot.allowedOrigin, 401);
            }

            if (suppliedKey !== bot.widgetApiKey) {
                return corsResponse({ error: "Invalid widget API key" }, origin, bot.allowedOrigin, 401);
            }

            const originCheck = validateOrigin(origin, bot.allowedOrigin, req);
            if (!originCheck.valid) {
                return corsResponse({ error: originCheck.error }, origin, bot.allowedOrigin, originCheck.status);
            }
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                botId,
                ...(visitorId
                    ? { visitorId }
                    : sessionId
                      ? { sessionId }
                      : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 50,
        });

        return corsResponse(conversations, origin, bot.allowedOrigin);
    } catch (error) {
        console.error("Get conversations error:", error);
        return corsResponse({ error: "Failed to fetch conversations" }, origin, null, 500);
    }
}
