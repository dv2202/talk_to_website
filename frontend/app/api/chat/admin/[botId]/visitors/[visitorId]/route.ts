import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { buildVisitorSummary } from "@/lib/chat-utils";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ botId: string; visitorId: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { botId, visitorId: rawVisitorId } = await params;
        // Next.js may leave path segments percent-encoded (e.g. legacy%3A...),
        // and the client may also encode — normalize before lookup.
        let visitorId = rawVisitorId;
        try {
            visitorId = decodeURIComponent(rawVisitorId);
            if (visitorId.includes("%")) {
                visitorId = decodeURIComponent(visitorId);
            }
        } catch {
            visitorId = rawVisitorId;
        }

        const bot = await prisma.bot.findFirst({
            where: {
                id: botId,
                userId: session.user.id,
            },
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
                    lastSeenAt: conversations[conversations.length - 1]?.createdAt || null,
                    sessionId: legacySessionId.startsWith("legacy-") ? null : legacySessionId,
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
            visitor: buildVisitorSummary(visitor),
            conversations: visitor.conversations,
        });
    } catch (error) {
        console.error("Get visitor conversation details error:", error);
        return NextResponse.json({ error: "Failed to fetch visitor details" }, { status: 500 });
    }
}
