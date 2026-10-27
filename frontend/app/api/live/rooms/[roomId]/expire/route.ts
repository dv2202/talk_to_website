import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-utils";
import { getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";
import {
    expireLiveChatRoom,
    findLiveChatRoom,
    VISITOR_SWITCHED_TO_AI_REASON,
} from "@/lib/live-chat";
import { authorizeLiveChatVisitor } from "@/lib/live-chat-http";
import { broadcastToBotOwners, broadcastToRoom } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

/** Expire a waiting/active room — from the visitor timeout or the owner. */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const origin = getRequestOrigin(req);
    try {
        const { roomId } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            widgetApiKey?: string;
            reason?: string;
        };

        const session = await getSession();

        const existing = await findLiveChatRoom(roomId);
        if (!existing) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }

        let endedBy = "SYSTEM";
        if (session && session.user.id === existing.bot.userId) {
            endedBy = "OWNER";
        } else {
            const authorized = authorizeLiveChatVisitor(req, {
                bot: existing.bot,
                room: existing,
                widgetApiKey: body.widgetApiKey,
            });
            if (!authorized.ok) return authorized.response;
            endedBy = "VISITOR";
        }

        const reason =
            body.reason ||
            (endedBy === "VISITOR" ? "visitor-timeout" : "owner-ended");

        const result = await expireLiveChatRoom(roomId, {
            endedBy,
            reason,
        });
        if (!result) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }

        if (result.notice) {
            broadcastToRoom(roomId, { type: "message", message: result.notice });
            broadcastToBotOwners(result.room.botId, { type: "message", message: result.notice });
        }

        broadcastToRoom(roomId, { type: "expired", roomId, reason });
        broadcastToBotOwners(result.room.botId, { type: "expired", roomId, reason });

        return corsResponse(
            {
                ...result.room,
                notice: result.notice,
                switchedToAi: reason === VISITOR_SWITCHED_TO_AI_REASON,
            },
            origin,
            null
        );
    } catch (error) {
        console.error("Expire live chat error:", error);
        return corsResponse({ error: "Failed to end live chat" }, origin, null, 500);
    }
}
