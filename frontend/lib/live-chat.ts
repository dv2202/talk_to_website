import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getEffectivePlanId } from "@/lib/entitlements";
import {
    LIVE_ACCEPT_TIMEOUT_MS,
    VISITOR_SWITCHED_TO_AI_MESSAGE,
    VISITOR_SWITCHED_TO_AI_REASON,
    type LiveChatMessageDto,
    type LiveChatRoomDto,
    type LiveChatRoomStatusValue,
    type LiveChatSenderValue,
} from "@/lib/live-chat-shared";

export {
    LIVE_ACCEPT_TIMEOUT_MS,
    VISITOR_SWITCHED_TO_AI_MESSAGE,
    VISITOR_SWITCHED_TO_AI_REASON,
    type LiveChatRole,
    type LiveChatRoomStatusValue,
    type LiveChatSenderValue,
    type LiveChatMessageDto,
    type LiveChatRoomDto,
    type LiveWsClientMessage,
    type LiveWsServerMessage,
} from "@/lib/live-chat-shared";

/** ─── Owner WS auth token (HMAC-signed, short-lived) ─── */

const OWNER_TOKEN_TTL_MS = 15 * 60 * 1000;

function tokenSecret(): string {
    return process.env.AUTH_SECRET || process.env.LIVE_CHAT_SECRET || "live-chat-dev-secret";
}

export function createOwnerLiveToken(userId: string, botId: string): string {
    const payload = `${userId}.${botId}.${Date.now()}`;
    const sig = crypto
        .createHmac("sha256", tokenSecret())
        .update(payload)
        .digest("hex")
        .slice(0, 32);
    return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyOwnerLiveToken(token: string): { userId: string; botId: string } | null {
    try {
        const [payloadPart, sig] = token.split(".");
        if (!payloadPart || !sig) return null;
        const expected = crypto
            .createHmac("sha256", tokenSecret())
            .update(Buffer.from(payloadPart, "base64url").toString())
            .digest("hex")
            .slice(0, 32);
        if (expected !== sig) return null;

        const [userId, botId, ts] = Buffer.from(payloadPart, "base64url").toString().split(".");
        if (!userId || !botId || !ts) return null;
        if (Date.now() - Number(ts) > OWNER_TOKEN_TTL_MS) return null;
        return { userId, botId };
    } catch {
        return null;
    }
}

/** ─── Plan gating ─── */

export async function canUseHumanChat(ownerUserId: string): Promise<boolean> {
    try {
        return (await getEffectivePlanId(ownerUserId)) === "PRO";
    } catch {
        return false;
    }
}

/** ─── Serializers ─── */

export function serializeLiveRoom(
    room: {
        id: string;
        botId: string;
        sessionId: string | null;
        status: string;
        ownerJoinedAt: Date | null;
        expiresAt: Date;
        endedBy: string | null;
        closedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        visitorId: string | null;
        bot?: { name?: string; botName?: string } | null;
        visitor?: { name?: string } | null;
    }
): LiveChatRoomDto {
    return {
        id: room.id,
        botId: room.botId,
        botName: room.bot?.name || room.bot?.botName || "Assistant",
        visitorId: room.visitorId,
        visitorName: room.visitor?.name || "Visitor",
        sessionId: room.sessionId,
        status: room.status as LiveChatRoomStatusValue,
        ownerJoinedAt: room.ownerJoinedAt ? room.ownerJoinedAt.toISOString() : null,
        expiresAt: room.expiresAt.toISOString(),
        endedBy: room.endedBy,
        closedAt: room.closedAt ? room.closedAt.toISOString() : null,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
    };
}

export function serializeLiveMessage(message: {
    id: string;
    roomId: string;
    sender: string;
    content: string;
    createdAt: Date;
}): LiveChatMessageDto {
    return {
        id: message.id,
        roomId: message.roomId,
        sender: message.sender as LiveChatSenderValue,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
    };
}

/** ─── DB service ─── */

export async function createLiveChatRoom(params: {
    botId: string;
    visitorId: string | null;
    sessionId?: string;
}): Promise<{ room: LiveChatRoomDto; superseded: LiveChatRoomDto[] }> {
    const now = new Date();

    // One open room per visitor (or anonymous session). Without this, each
    // "talk to a human" click / page reload leaves prior ACTIVE rooms hanging
    // forever and the owner Active tab fills with duplicates.
    const priorFilter =
        params.visitorId
            ? { botId: params.botId, visitorId: params.visitorId, status: { in: ["WAITING", "ACTIVE"] as const } }
            : params.sessionId
              ? {
                    botId: params.botId,
                    sessionId: params.sessionId,
                    visitorId: null,
                    status: { in: ["WAITING", "ACTIVE"] as const },
                }
              : null;

    let superseded: LiveChatRoomDto[] = [];
    if (priorFilter) {
        const prior = await prisma.liveChatRoom.findMany({
            where: priorFilter,
            include: {
                bot: { select: { name: true, botName: true } },
                visitor: { select: { name: true } },
            },
        });
        if (prior.length > 0) {
            const priorIds: string[] = [];
            for (const openRoom of prior) {
                priorIds.push(openRoom.id);
                superseded.push(
                    serializeLiveRoom({
                        ...openRoom,
                        status: "EXPIRED",
                        endedBy: "SYSTEM",
                        closedAt: now,
                    })
                );
            }
            await prisma.liveChatRoom.updateMany({
                where: { id: { in: priorIds } },
                data: { status: "EXPIRED", endedBy: "SYSTEM", closedAt: now },
            });
        }
    }

    const room = await prisma.liveChatRoom.create({
        data: {
            botId: params.botId,
            visitorId: params.visitorId,
            sessionId: params.sessionId || null,
            status: "WAITING",
            expiresAt: new Date(now.getTime() + LIVE_ACCEPT_TIMEOUT_MS),
        },
        include: {
            bot: { select: { name: true, botName: true } },
            visitor: { select: { name: true } },
        },
    });
    return { room: serializeLiveRoom(room), superseded };
}

export async function findLiveChatRoom(roomId: string) {
    return prisma.liveChatRoom.findUnique({
        where: { id: roomId },
        include: {
            bot: {
                select: {
                    name: true,
                    botName: true,
                    userId: true,
                    widgetApiKey: true,
                    allowedOrigin: true,
                },
            },
            visitor: { select: { name: true } },
        },
    });
}

export async function acceptLiveChatRoom(roomId: string, ownerUserId: string): Promise<LiveChatRoomDto | null> {
    const existing = await findLiveChatRoom(roomId);
    if (!existing) return null;
    if (existing.bot.userId !== ownerUserId) {
        throw Object.assign(new Error("Not authorized"), { status: 403 });
    }
    if (existing.status === "ACTIVE") {
        return serializeLiveRoom(existing);
    }
    if (existing.status !== "WAITING") {
        throw Object.assign(new Error("This chat request is no longer waiting"), { status: 409 });
    }

    const room = await prisma.liveChatRoom.update({
        where: { id: roomId },
        data: { status: "ACTIVE", ownerJoinedAt: new Date() },
        include: {
            bot: { select: { name: true, botName: true } },
            visitor: { select: { name: true } },
        },
    });

    // Accepting one room closes other open rooms for the same visitor/session.
    if (existing.visitorId || existing.sessionId) {
        await prisma.liveChatRoom.updateMany({
            where: {
                botId: existing.botId,
                id: { not: roomId },
                status: { in: ["WAITING", "ACTIVE"] },
                ...(existing.visitorId
                    ? { visitorId: existing.visitorId }
                    : { sessionId: existing.sessionId, visitorId: null }),
            },
            data: { status: "EXPIRED", endedBy: "SYSTEM", closedAt: new Date() },
        });
    }

    return serializeLiveRoom(room);
}

export async function expireLiveChatRoom(
    roomId: string,
    params: { endedBy: string; reason?: string }
): Promise<{ room: LiveChatRoomDto; notice: LiveChatMessageDto | null } | null> {
    const existing = await findLiveChatRoom(roomId);
    if (!existing) return null;
    if (existing.status !== "WAITING" && existing.status !== "ACTIVE") {
        return { room: serializeLiveRoom(existing), notice: null };
    }

    let notice: LiveChatMessageDto | null = null;
    if (params.reason === VISITOR_SWITCHED_TO_AI_REASON) {
        const message = await prisma.liveChatMessage.create({
            data: {
                roomId,
                sender: "VISITOR",
                content: VISITOR_SWITCHED_TO_AI_MESSAGE,
            },
        });
        notice = serializeLiveMessage(message);
    }

    const room = await prisma.liveChatRoom.update({
        where: { id: roomId },
        data: {
            status: "EXPIRED",
            endedBy: params.endedBy,
            closedAt: new Date(),
        },
        include: {
            bot: { select: { name: true, botName: true } },
            visitor: { select: { name: true } },
        },
    });
    return { room: serializeLiveRoom(room), notice };
}

export async function closeLiveChatRoom(
    roomId: string,
    endedBy: string
): Promise<LiveChatRoomDto | null> {
    const existing = await findLiveChatRoom(roomId);
    if (!existing) return null;
    if (existing.status === "CLOSED") return serializeLiveRoom(existing);

    const room = await prisma.liveChatRoom.update({
        where: { id: roomId },
        data: { status: "CLOSED", endedBy, closedAt: new Date() },
        include: {
            bot: { select: { name: true, botName: true } },
            visitor: { select: { name: true } },
        },
    });
    return serializeLiveRoom(room);
}

export async function appendLiveChatMessage(params: {
    roomId: string;
    sender: LiveChatSenderValue;
    content: string;
}): Promise<{ message: LiveChatMessageDto; room: LiveChatRoomDto | null } | null> {
    const content = params.content.trim();
    if (!content) return null;

    const room = await findLiveChatRoom(params.roomId);
    if (!room) return null;
    if (room.status === "WAITING") {
        // Visitor can start typing once accepted; reject anything sent before.
        throw Object.assign(new Error("Chat has not started yet"), { status: 409 });
    }
    if (room.status === "EXPIRED" || room.status === "CLOSED") {
        throw Object.assign(new Error("This chat has ended"), { status: 409 });
    }

    const message = await prisma.liveChatMessage.create({
        data: {
            roomId: params.roomId,
            sender: params.sender,
            content,
        },
    });
    return {
        message: serializeLiveMessage(message),
        room: serializeLiveRoom(room),
    };
}

export async function listLiveChatMessages(roomId: string): Promise<LiveChatMessageDto[]> {
    const messages = await prisma.liveChatMessage.findMany({
        where: { roomId },
        orderBy: { createdAt: "asc" },
        take: 200,
    });
    return messages.map(serializeLiveMessage);
}

export async function listLiveChatRoomsForOwner(params: {
    userId: string;
    status?: LiveChatRoomStatusValue | "ALL";
}): Promise<LiveChatRoomDto[]> {
    const { userId, status = "ALL" } = params;

    // Clean up WAITING rooms whose accept window already passed.
    await prisma.liveChatRoom.updateMany({
        where: {
            status: "WAITING",
            expiresAt: { lt: new Date() },
            bot: { userId },
        },
        data: { status: "EXPIRED", endedBy: "SYSTEM", closedAt: new Date() },
    });

    const rooms = await prisma.liveChatRoom.findMany({
        where: {
            bot: { userId },
            ...(status !== "ALL" ? { status } : {}),
        },
        include: {
            bot: { select: { name: true, botName: true } },
            visitor: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
    });
    return rooms.map(serializeLiveRoom);
}
