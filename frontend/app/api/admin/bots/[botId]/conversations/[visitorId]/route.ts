import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-utils";
import { buildVisitorSummary } from "@/lib/chat-utils";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ botId: string; visitorId: string }> }
) {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const { botId, visitorId: rawVisitorId } = await params;
        let visitorId = rawVisitorId;
        try {
            visitorId = decodeURIComponent(rawVisitorId);
            if (visitorId.includes("%")) {
                visitorId = decodeURIComponent(visitorId);
            }
        } catch {
            visitorId = rawVisitorId;
        }

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: { id: true, name: true, botName: true, userId: true },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        if (visitorId.startsWith("legacy:")) {
            const legacySessionId = visitorId.slice("legacy:".length);
            const conversations = await prisma.conversation.findMany({
                where: {
                    botId: bot.id,
                    visitorId: null,
                    ...(legacySessionId.startsWith("legacy-")
                        ? { sessionId: null }
                        : { sessionId: legacySessionId }),
                },
                orderBy: { createdAt: "asc" },
            });

            return NextResponse.json({
                bot,
                visitor: {
                    id: visitorId,
                    name: "Anonymous User",
                    email: null,
                    country: null,
                    deviceType: null,
                    platform: null,
                    timezone: null,
                    language: null,
                    ipAddress: null,
                    userAgent: null,
                    skippedProfile: true,
                    firstSeenAt: conversations[0]?.createdAt || null,
                    lastSeenAt:
                        conversations[conversations.length - 1]?.createdAt || null,
                    sessionId: legacySessionId.startsWith("legacy-")
                        ? null
                        : legacySessionId,
                    totalMessages: conversations.length,
                    isLegacy: true,
                },
                conversations,
            });
        }

        const visitor = await prisma.visitor.findFirst({
            where: {
                id: visitorId,
                botId: bot.id,
            },
            include: {
                _count: {
                    select: { conversations: true },
                },
                conversations: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!visitor) {
            return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
        }

        return NextResponse.json({
            bot,
            visitor: buildVisitorSummary(visitor),
            conversations: visitor.conversations,
        });
    } catch (error) {
        console.error("Admin get visitor details error:", error);
        return NextResponse.json(
            { error: "Failed to fetch visitor details" },
            { status: 500 }
        );
    }
}
