import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { getCorsHeaders, corsResponse, getRequestOrigin } from "@/lib/chat-utils";
import { acceptLiveChatRoom } from "@/lib/live-chat";
import { broadcastToBotOwners, broadcastToRoom } from "@/lib/live-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin, null) });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ roomId: string }> }
) {
    const origin = getRequestOrigin(req);
    try {
        const { roomId } = await params;
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const room = await acceptLiveChatRoom(roomId, session.user.id);
        if (!room) {
            return corsResponse({ error: "Chat room not found" }, origin, null, 404);
        }

        broadcastToRoom(roomId, { type: "accepted", room });
        broadcastToBotOwners(room.botId, { type: "accepted", room });

        return corsResponse(room, origin, null);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to accept chat";
        const status = (error as { status?: number }).status || 500;
        console.error("Accept live chat error:", error);
        return corsResponse({ error: message }, origin, null, status);
    }
}
