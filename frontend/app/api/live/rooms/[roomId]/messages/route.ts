import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-utils";
import { getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";
import { appendLiveChatMessage, findLiveChatRoom } from "@/lib/live-chat";
import { authorizeLiveChatVisitor } from "@/lib/live-chat-http";
import { broadcastToRoom, broadcastToBotOwners, publishTyping } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

/**
 * Fallback message send (used when the WebSocket is unavailable, e.g. `next dev`).
 * Sender is detected from auth: owner session or validated visitor.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const origin = getRequestOrigin(req);
    try {
        const { roomId } = await params;
        const body = (await req.json().catch(() => ({}))) as {
            content?: string;
            visitorId?: string;
            widgetApiKey?: string;
        };

        if (!body.content || !body.content.trim()) {
            return corsResponse({ error: "Message is required" }, origin, null, 400);
        }

        const room = await findLiveChatRoom(roomId);
        if (!room) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
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

        const result = await appendLiveChatMessage({ roomId, sender, content: body.content });
        if (!result) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }

        publishTyping(roomId, sender, false);
        broadcastToRoom(roomId, {
            type: "message",
            message: result.message,
            room: result.room || undefined,
        });
        if (sender === "VISITOR" && result.room) {
            broadcastToBotOwners(
                result.room.botId,
                { type: "message", message: result.message, room: result.room },
                roomId
            );
        }

        return corsResponse({ message: result.message }, origin, null, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message";
        const status = (error as { status?: number }).status || 500;
        console.error("Send live chat message error:", error);
        return corsResponse({ error: message }, origin, null, status);
    }
}
