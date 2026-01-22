import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { findBot, upsertVisitor, getCorsHeaders, corsResponse, getRequestOrigin, type VisitorProfileInput } from "@/lib/chat-utils";
import { authorizeLiveChatVisitor } from "@/lib/live-chat-http";
import { canUseHumanChat, listLiveChatRoomsForOwner, type LiveChatRoomStatusValue } from "@/lib/live-chat";
import { createAndNotifyLiveRoom } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

/**
 * Visitor: request a live human chat room. Creates a WAITING room and notifies
 * the bot owner (Pro plan feature).
 */
export async function POST(req: NextRequest) {
    const origin = getRequestOrigin(req);

    try {
        const body = await req.json();
        const {
            botId,
            botName,
            sessionId,
            visitorId,
            visitorToken,
            visitorProfile,
            widgetApiKey,
        } = body as {
            botId?: string;
            botName?: string;
            sessionId?: string;
            visitorId?: string;
            visitorToken?: string;
            visitorProfile?: VisitorProfileInput;
            widgetApiKey?: string;
        };

        const bot = await findBot({ botId, botName });
        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        const authorized = authorizeLiveChatVisitor(req, {
            bot,
            room: { visitorId: null },
            visitorId,
            widgetApiKey,
        });
        if (!authorized.ok) return authorized.response;

        if (!bot.humanChatEnabled) {
            return corsResponse({ error: "Live human chat is disabled for this assistant" }, origin, bot.allowedOrigin, 403);
        }

        const available = await canUseHumanChat(bot.userId);
        if (!available) {
            return corsResponse(
                { error: "Live human chat is a Pro plan feature. The owner needs to upgrade.", code: "plan_required" },
                origin,
                bot.allowedOrigin,
                403
            );
        }

        const visitor = await upsertVisitor({
            bot,
            req,
            visitorId,
            visitorToken,
            sessionId,
            profile: visitorProfile,
        });

        const room = await createAndNotifyLiveRoom({
            botId: bot.id,
            visitorId: visitor?.id || null,
            sessionId,
        });

        return corsResponse(room, origin, bot.allowedOrigin, 201);
    } catch (error) {
        console.error("Create live chat room error:", error);
        return corsResponse({ error: "Failed to start live chat" }, origin, null, 500);
    }
}

/**
 * Owner: list live chat rooms across the user's bots.
 * ?status=WAITING | ACTIVE | EXPIRED | CLOSED | ALL (default ALL)
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const status = (req.nextUrl.searchParams.get("status") || "ALL") as LiveChatRoomStatusValue | "ALL";
        const rooms = await listLiveChatRoomsForOwner({ userId: session.user.id, status });
        return NextResponse.json(rooms);
    } catch (error) {
        console.error("List live chat rooms error:", error);
        return NextResponse.json({ error: "Failed to list live chats" }, { status: 500 });
    }
}
