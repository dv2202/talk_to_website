/** Client-safe live chat types & constants (no Prisma / Node crypto). */

/** How long a visitor waits for the owner to pick up the room. */
export const LIVE_ACCEPT_TIMEOUT_MS = 30_000;

export type LiveChatRole = "visitor" | "owner";
export type LiveChatRoomStatusValue = "WAITING" | "ACTIVE" | "EXPIRED" | "CLOSED";
export type LiveChatSenderValue = "VISITOR" | "OWNER";

export interface LiveChatMessageDto {
    id: string;
    roomId: string;
    sender: LiveChatSenderValue;
    content: string;
    createdAt: string;
}

export interface LiveChatRoomDto {
    id: string;
    botId: string;
    botName: string;
    visitorId: string | null;
    visitorName: string;
    sessionId: string | null;
    status: LiveChatRoomStatusValue;
    ownerJoinedAt: string | null;
    expiresAt: string;
    endedBy: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type LiveWsClientMessage =
    | { type: "hello"; role: "visitor"; botId: string; roomId: string; visitorAccessToken: string }
    | { type: "hello"; role: "owner"; botId: string; token: string }
    | { type: "join-room"; roomId: string }
    | { type: "message"; roomId: string; content: string }
    | { type: "typing"; roomId: string; isTyping: boolean }
    | { type: "accept"; roomId: string }
    | { type: "expire"; roomId: string; reason?: string };

export type LiveWsServerMessage =
    | { type: "hello-ok"; role: LiveChatRole; roomId: string | null }
    | { type: "error"; code: string; message: string }
    | { type: "request"; room: LiveChatRoomDto }
    | { type: "accepted"; room: LiveChatRoomDto }
    | { type: "expired"; roomId: string; reason: string }
    | { type: "closed"; roomId: string; reason: string }
    | { type: "message"; message: LiveChatMessageDto; room?: LiveChatRoomDto }
    | { type: "typing"; roomId: string; sender: LiveChatSenderValue; isTyping: boolean };

export const VISITOR_SWITCHED_TO_AI_REASON = "visitor-switched-to-ai";
export const VISITOR_SWITCHED_TO_AI_MESSAGE =
    "Visitor changed the mode to AI conversation.";
