import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-utils";
import { getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";
import { findLiveChatRoom } from "@/lib/live-chat";
import { authorizeLiveChatVisitor } from "@/lib/live-chat-http";
import { publishTyping } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

/**
 * Fallback typing signal when the WebSocket is unavailable (e.g. `next dev`).
 * Stores ephemeral state for pollers and broadcasts to connected sockets.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const origin = getRequestOrigin(req);
    try {
        const { roomId } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            isTyping?: boolean;
            visitorId?: string;
            widgetApiKey?: string;
        };

        const room = await findLiveChatRoom(roomId);
        if (!room) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }
        if (room.status !== "ACTIVE") {
            return corsResponse({ error: "Chat is not active" }, origin, null, 409);
        }

        const session = await getSession();
        let sender: "VISITOR" | "OWNER" = "VISITOR";

        if (session && session.user.id === room.bot.userId) {
            sender = "OWNER";
        } else {
            const authorized = authorizeLiveChatVisitor(req, {
                bot: room.bot,
                room,
                visitorId: body.visitorId,
                widgetApiKey: body.widgetApiKey,
            });
            if (!authorized.ok) return authorized.response;
            sender = "VISITOR";
        }

        const isTyping = Boolean(body.isTyping);
        publishTyping(roomId, sender, isTyping);

        return corsResponse({ ok: true, sender, isTyping }, origin, null);
    } catch (error) {
        console.error("Live chat typing error:", error);
        return corsResponse({ error: "Failed to update typing" }, origin, null, 500);
    }
}
