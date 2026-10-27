import { verifyVisitorAccessToken } from "@/lib/visitor-access";

export interface LiveRoomIdentity {
    id: string;
    botId: string;
    visitorId: string | null;
    bot: { userId: string };
}

export interface LiveConnectionIdentity {
    role?: "visitor" | "owner";
    userId?: string;
    visitorId?: string;
    botId?: string;
    roomId?: string;
}

/** A bot-wide public widget key and caller-supplied visitor ID do not identify a room visitor. */
export function matchesRoomVisitor(
    room: Pick<LiveRoomIdentity, "botId" | "visitorId">,
    accessToken: string | undefined
): string | null {
    if (!room.visitorId) return null;
    const visitorId = verifyVisitorAccessToken(accessToken, room.botId);
    return visitorId === room.visitorId ? visitorId : null;
}

/** Shared room policy for all WebSocket actions after hello. */
export function canControlLiveRoom(conn: LiveConnectionIdentity | undefined, room: LiveRoomIdentity): boolean {
    if (!conn || conn.botId !== room.botId) return false;
    if (conn.role === "owner") return Boolean(conn.userId && conn.userId === room.bot.userId);
    if (conn.role === "visitor") {
        return Boolean(room.visitorId && conn.visitorId === room.visitorId && conn.roomId === room.id);
    }
    return false;
}
