import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-utils";
import { getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";
import { findLiveChatRoom, listLiveChatMessages, serializeLiveRoom } from "@/lib/live-chat";
import { authorizeLiveChatVisitor } from "@/lib/live-chat-http";
import { getRoomTyping } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const origin = getRequestOrigin(req);
    try {
        const { roomId } = await params;
        const room = await findLiveChatRoom(roomId);
        if (!room) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }

        // Owner path (dashboard)
        const session = await getSession();
        if (session && session.user.id === room.bot.userId) {
            const response = corsResponse({
                room: serializeLiveRoom(room),
                messages: await listLiveChatMessages(roomId),
                typing: getRoomTyping(roomId),
            }, origin, room.bot.allowedOrigin);
            response.headers.set("Cache-Control", "private, no-store");
            return response;
        }

        // Visitor path
        const widgetApiKey = req.nextUrl.searchParams.get("widgetApiKey") || undefined;
        const authorized = authorizeLiveChatVisitor(req, {
            bot: room.bot,
            room,
            widgetApiKey,
        });
        if (!authorized.ok) return authorized.response;

        const response = corsResponse({
            room: serializeLiveRoom(room),
            messages: await listLiveChatMessages(roomId),
            typing: getRoomTyping(roomId),
        }, origin, room.bot.allowedOrigin);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
    } catch (error) {
        console.error("Get live chat room error:", error);
        return corsResponse({ error: "Failed to load live chat" }, origin, null, 500);
    }
}
