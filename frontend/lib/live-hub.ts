import type { WebSocket } from "ws";
import { canControlLiveRoom, matchesRoomVisitor, type LiveConnectionIdentity } from "@/lib/live-chat-access";
import {
    acceptLiveChatRoom,
    appendLiveChatMessage,
    createLiveChatRoom,
    expireLiveChatRoom,
    findLiveChatRoom,
    listLiveChatMessages,
    serializeLiveRoom,
    verifyOwnerLiveToken,
    type LiveChatRoomDto,
    type LiveChatSenderValue,
    type LiveWsClientMessage,
    type LiveWsServerMessage,
} from "@/lib/live-chat";

type LiveConnection = LiveConnectionIdentity;

/**
 * In-memory WebSocket hub. A single Vercel Function instance serves the
 * connections; rooms + messages are persisted to Postgres so a reconnecting
 * client always recovers state. Cross-instance delivery is best-effort
 * (Vercel pins a socket to one instance) — every client also polls the REST
 * endpoints, so the flow stays correct even when the WS push is missed.
 */
const connections = new Map<WebSocket, LiveConnection>();
const rooms = new Map<string, Set<WebSocket>>();
const botOwners = new Map<string, Set<WebSocket>>();

/** Ephemeral typing flags for poll fallback when WS is unavailable. */
const typingState = new Map<string, { visitor: boolean; owner: boolean; updatedAt: number }>();
const TYPING_TTL_MS = 4000;

function pruneTyping(roomId: string) {
    const state = typingState.get(roomId);
    if (!state) return null;
    if (Date.now() - state.updatedAt > TYPING_TTL_MS) {
        typingState.delete(roomId);
        return null;
    }
    return state;
}

export function getRoomTyping(roomId: string): { visitor: boolean; owner: boolean } {
    const state = pruneTyping(roomId);
    return {
        visitor: Boolean(state?.visitor),
        owner: Boolean(state?.owner),
    };
}

export function setRoomTyping(
    roomId: string,
    sender: LiveChatSenderValue,
    isTyping: boolean
): { visitor: boolean; owner: boolean } {
    const prev = pruneTyping(roomId) || { visitor: false, owner: false, updatedAt: Date.now() };
    const next = {
        visitor: sender === "VISITOR" ? isTyping : prev.visitor,
        owner: sender === "OWNER" ? isTyping : prev.owner,
        updatedAt: Date.now(),
    };
    if (!next.visitor && !next.owner) {
        typingState.delete(roomId);
    } else {
        typingState.set(roomId, next);
    }
    return { visitor: next.visitor, owner: next.owner };
}

export function clearRoomTyping(roomId: string) {
    typingState.delete(roomId);
}

export function publishTyping(
    roomId: string,
    sender: LiveChatSenderValue,
    isTyping: boolean,
    exclude?: WebSocket
) {
    setRoomTyping(roomId, sender, isTyping);
    broadcastToRoom(roomId, { type: "typing", roomId, sender, isTyping }, exclude);
}

function send(ws: WebSocket, payload: LiveWsServerMessage) {
    if (ws.readyState === ws.OPEN) {
        try {
            ws.send(JSON.stringify(payload));
        } catch {
            /* ignore */
        }
    }
}

function addToRoom(roomId: string, ws: WebSocket) {
    let set = rooms.get(roomId);
    if (!set) {
        set = new Set();
        rooms.set(roomId, set);
    }
    set.add(ws);
}

function removeFromRoom(roomId: string | undefined, ws: WebSocket) {
    if (!roomId) return;
    const set = rooms.get(roomId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomId);
}

function addToBotOwners(botId: string, ws: WebSocket) {
    let set = botOwners.get(botId);
    if (!set) {
        set = new Set();
        botOwners.set(botId, set);
    }
    set.add(ws);
}

function removeFromBotOwners(botId: string | undefined, ws: WebSocket) {
    if (!botId) return;
    const set = botOwners.get(botId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) botOwners.delete(botId);
}

export function broadcastToRoom(roomId: string, payload: LiveWsServerMessage, exclude?: WebSocket) {
    const set = rooms.get(roomId);
    if (!set) return;
    for (const ws of set) {
        if (ws !== exclude) send(ws, payload);
    }
}

export function broadcastToBotOwners(
    botId: string,
    payload: LiveWsServerMessage,
    excludeRoomId?: string
) {
    const set = botOwners.get(botId);
    if (!set) return;
    for (const ws of set) {
        if (excludeRoomId) {
            const conn = connections.get(ws);
            if (conn?.roomId === excludeRoomId) continue;
        }
        send(ws, payload);
    }
}

export function registerLiveConnection(ws: WebSocket) {
    connections.set(ws, {});
}

async function handleHello(ws: WebSocket, msg: Extract<LiveWsClientMessage, { type: "hello" }>) {
    if (connections.get(ws)?.role) {
        send(ws, { type: "error", code: "conflict", message: "Already authenticated" });
        return;
    }
    if (msg.role === "visitor") {
        const room = await findLiveChatRoom(msg.roomId);
        if (!room || room.botId !== msg.botId) {
            send(ws, { type: "error", code: "not_found", message: "Chat room not found" });
            return;
        }
        const visitorId = matchesRoomVisitor(room, msg.visitorAccessToken);
        if (!visitorId) {
            send(ws, { type: "error", code: "forbidden", message: "Not authorized for this chat" });
            return;
        }

        connections.set(ws, { role: "visitor", visitorId, botId: msg.botId, roomId: msg.roomId });
        addToRoom(msg.roomId, ws);
        send(ws, { type: "hello-ok", role: "visitor", roomId: msg.roomId });

        if (room.status === "EXPIRED") {
            send(ws, { type: "expired", roomId: msg.roomId, reason: "timeout" });
            return;
        }
        if (room.status === "CLOSED") {
            send(ws, { type: "closed", roomId: msg.roomId, reason: "ended" });
            return;
        }
        if (room.status === "ACTIVE") {
            send(ws, { type: "accepted", room: serializeLiveRoom(room) });
        }
        return;
    }

    // Owner
    const verified = verifyOwnerLiveToken(msg.token);
    if (!verified || msg.botId !== verified.botId) {
        send(ws, { type: "error", code: "forbidden", message: "Invalid owner token" });
        return;
    }

    connections.set(ws, { role: "owner", userId: verified.userId, botId: verified.botId });
    addToBotOwners(verified.botId, ws);
    send(ws, { type: "hello-ok", role: "owner", roomId: null });
}

async function handleJoinRoom(ws: WebSocket, roomId: string) {
    const conn = connections.get(ws);
    if (!conn || conn.role !== "owner" || !conn.userId) return;

    const room = await findLiveChatRoom(roomId);
    if (!room || !canControlLiveRoom(conn, room)) {
        send(ws, { type: "error", code: "forbidden", message: "Not authorized for this chat" });
        return;
    }

    removeFromRoom(conn.roomId, ws);
    conn.roomId = roomId;
    addToRoom(roomId, ws);
    send(ws, { type: "hello-ok", role: "owner", roomId });

    // Replay recent history so a newly opened room is instantly populated.
    const history = await listLiveChatMessages(roomId);
    for (const message of history) {
        send(ws, { type: "message", message });
    }

    // Only echo "accepted" when the room is actually ACTIVE. Emitting it for
    // WAITING rooms made visitors unlock chat early and flipped the owner
    // dashboard onto the Active tab just from opening a request.
    if (room.status === "ACTIVE") {
        send(ws, { type: "accepted", room: serializeLiveRoom(room) });
    } else if (room.status === "EXPIRED") {
        send(ws, { type: "expired", roomId, reason: "timeout" });
    } else if (room.status === "CLOSED") {
        send(ws, { type: "closed", roomId, reason: "ended" });
    }
}

async function handleMessage(ws: WebSocket, roomId: string, content: string) {
    const conn = connections.get(ws);
    if (!conn || !conn.roomId || conn.roomId !== roomId || !conn.role) return;

    const sender: LiveChatSenderValue = conn.role === "owner" ? "OWNER" : "VISITOR";

    try {
        const result = await appendLiveChatMessage({ roomId, sender, content });
        if (!result) return;
        publishTyping(roomId, sender, false);
        broadcastToRoom(roomId, { type: "message", message: result.message, room: result.room || undefined });
        // Owners watching other rooms (or only subscribed at bot level) get visitor messages too.
        if (sender === "VISITOR" && result.room) {
            broadcastToBotOwners(
                result.room.botId,
                { type: "message", message: result.message, room: result.room },
                roomId
            );
        }
    } catch {
        send(ws, { type: "error", code: "conflict", message: "Chat is not open for messages" });
    }
}

function handleTyping(ws: WebSocket, roomId: string, isTyping: boolean) {
    const conn = connections.get(ws);
    if (!conn || conn.roomId !== roomId || !conn.role) return;
    const sender: LiveChatSenderValue = conn.role === "owner" ? "OWNER" : "VISITOR";
    publishTyping(roomId, sender, isTyping, ws);
}

async function handleAccept(ws: WebSocket, roomId: string) {
    const conn = connections.get(ws);
    if (!conn || conn.role !== "owner" || !conn.userId) return;

    const existing = await findLiveChatRoom(roomId);
    if (!existing || !canControlLiveRoom(conn, existing)) {
        send(ws, { type: "error", code: "forbidden", message: "Not authorized for this chat" });
        return;
    }

    try {
        const room = await acceptLiveChatRoom(roomId, conn.userId);
        if (!room) {
            send(ws, { type: "error", code: "not_found", message: "Chat room not found" });
            return;
        }
        conn.roomId = roomId;
        addToRoom(roomId, ws);
        broadcastToRoom(roomId, { type: "accepted", room });
        broadcastToBotOwners(room.botId, { type: "accepted", room });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not accept chat";
        send(ws, { type: "error", code: "conflict", message });
    }
}

async function handleExpire(ws: WebSocket, roomId: string, reason = "visitor-timeout") {
    const conn = connections.get(ws);
    const room = await findLiveChatRoom(roomId);
    if (!room || !canControlLiveRoom(conn, room)) {
        send(ws, { type: "error", code: "forbidden", message: "Not authorized for this chat" });
        return;
    }

    const result = await expireLiveChatRoom(roomId, { endedBy: conn!.role === "owner" ? "OWNER" : "VISITOR", reason });
    if (!result) return;
    if (result.notice) {
        broadcastToRoom(roomId, { type: "message", message: result.notice });
        broadcastToBotOwners(result.room.botId, { type: "message", message: result.notice });
    }
    broadcastToRoom(roomId, { type: "expired", roomId, reason });
    broadcastToBotOwners(result.room.botId, { type: "expired", roomId, reason });
}

export async function handleLiveClientMessage(ws: WebSocket, raw: string) {
    let msg: LiveWsClientMessage;
    try {
        msg = JSON.parse(raw);
    } catch {
        return;
    }
    if (!msg || typeof msg.type !== "string") return;

    switch (msg.type) {
        case "hello":
            await handleHello(ws, msg as Extract<LiveWsClientMessage, { type: "hello" }>);
            break;
        case "join-room":
            await handleJoinRoom(ws, msg.roomId);
            break;
        case "message":
            await handleMessage(ws, msg.roomId, msg.content);
            break;
        case "typing":
            handleTyping(ws, msg.roomId, msg.isTyping);
            break;
        case "accept":
            await handleAccept(ws, msg.roomId);
            break;
        case "expire":
            await handleExpire(ws, msg.roomId, msg.reason);
            break;
    }
}

export function unregisterLiveConnection(ws: WebSocket) {
    const conn = connections.get(ws);
    if (conn) {
        if (conn.roomId && conn.role) {
            const sender: LiveChatSenderValue = conn.role === "owner" ? "OWNER" : "VISITOR";
            publishTyping(conn.roomId, sender, false);
        }
        removeFromRoom(conn.roomId, ws);
        removeFromBotOwners(conn.botId, ws);
    }
    connections.delete(ws);
}

/** Broadcast a fresh WAITING request (called from the create-room REST route). */
export async function notifyOwnerOfRequest(room: LiveChatRoomDto) {
    broadcastToBotOwners(room.botId, { type: "request", room });
}

/** Create a room AND notify connected owners on this instance. */
export async function createAndNotifyLiveRoom(params: {
    botId: string;
    visitorId: string | null;
    sessionId?: string;
}): Promise<LiveChatRoomDto> {
    const { room, superseded } = await createLiveChatRoom(params);
    for (const old of superseded) {
        broadcastToRoom(old.id, { type: "expired", roomId: old.id, reason: "superseded" });
        broadcastToBotOwners(old.botId, { type: "expired", roomId: old.id, reason: "superseded" });
        clearRoomTyping(old.id);
    }
    await notifyOwnerOfRequest(room);
    return room;
}
