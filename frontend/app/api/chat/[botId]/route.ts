import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateOrigin, getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";
import { readVisitorHistory } from "@/lib/visitor-access";

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
        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: { allowedOrigin: true },
        });

        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        const originCheck = validateOrigin(origin, bot.allowedOrigin, req);
        if (!originCheck.valid) {
            return corsResponse({ error: originCheck.error }, origin, bot.allowedOrigin, originCheck.status);
        }

        const conversations = await readVisitorHistory({
            findVisitor: (where) => prisma.visitor.findFirst({ where, select: { id: true } }),
            findConversations: (query) => prisma.conversation.findMany(query),
        }, botId, req.headers.get("x-visitor-access-token") || undefined);

        if (!conversations) {
            return corsResponse({ error: "Visitor session is required" }, origin, bot.allowedOrigin, 401);
        }

        const response = corsResponse(conversations, origin, bot.allowedOrigin);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
    } catch (error) {
        console.error("Get conversations error:", error);
        return corsResponse({ error: "Failed to fetch conversations" }, origin, null, 500);
    }
}
