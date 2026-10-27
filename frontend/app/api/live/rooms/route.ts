import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { findBot, upsertAuthorizedVisitor, getCorsHeaders, corsResponse, getRequestOrigin, type VisitorProfileInput } from "@/lib/chat-utils";
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
            visitorAccessToken,
            visitorProfile,
            widgetApiKey,
        } = body as {
            botId?: string;
            botName?: string;
            sessionId?: string;
            visitorAccessToken?: string;
            visitorProfile?: VisitorProfileInput;
            widgetApiKey?: string;
        };

        const bot = await findBot({ botId, botName });
        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        const authorized = authorizeLiveChatVisitor(req, {
            bot,
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

        const accessToken = visitorAccessToken || req.headers.get("x-visitor-access-token") || undefined;
        let authorizedVisitor = await upsertAuthorizedVisitor({
            bot,
            req,
            accessToken,
            sessionId,
            profile: visitorProfile,
        });
        if (!authorizedVisitor && accessToken) {
            authorizedVisitor = await upsertAuthorizedVisitor({ bot, req, sessionId, profile: visitorProfile });
        }
        if (!authorizedVisitor) {
            return corsResponse({ error: "Invalid visitor session" }, origin, bot.allowedOrigin, 401);
        }

        const room = await createAndNotifyLiveRoom({
            botId: bot.id,
            visitorId: authorizedVisitor.visitor!.id,
            sessionId,
        });

        return corsResponse({ ...room, visitorAccessToken: authorizedVisitor.accessToken }, origin, bot.allowedOrigin, 201);
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
