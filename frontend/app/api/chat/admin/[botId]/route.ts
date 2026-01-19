import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { buildVisitorSummary, groupLegacyConversations } from "@/lib/chat-utils";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { botId } = await params;

        const bot = await prisma.bot.findFirst({
            where: {
                id: botId,
                userId: session.user.id,
            },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const visitors = await prisma.visitor.findMany({
            where: { botId: bot.id },
            include: {
                _count: {
                    select: { conversations: true },
                },
                conversations: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        userMessage: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { lastSeenAt: "desc" },
        });

        const legacyConversations = await prisma.conversation.findMany({
            where: {
                botId: bot.id,
                visitorId: null,
            },
            select: {
                id: true,
                userMessage: true,
                aiResponse: true,
                sessionId: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        const visitorList = visitors.map((visitor: any) => ({
            ...buildVisitorSummary(visitor),
            lastMessageAt: visitor.conversations[0]?.createdAt || visitor.lastSeenAt,
            lastMessagePreview: visitor.conversations[0]?.userMessage || null,
            isLegacy: false,
        }));

        const legacyGroups = groupLegacyConversations(legacyConversations);

        const mergedVisitors = [...visitorList, ...legacyGroups].sort((a, b) => {
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });

        return NextResponse.json({
            bot: {
                id: bot.id,
                name: bot.name,
                botName: bot.botName,
            },
            visitors: mergedVisitors,
        });
    } catch (error) {
        console.error("Get admin conversations error:", error);
        return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }
}
