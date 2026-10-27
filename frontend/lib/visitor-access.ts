import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_PREFIX = "v1";

type VisitorTokenPayload = {
    botId: string;
    visitorId: string;
    issuedAt: number;
    expiresAt: number;
};

function signingSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is required for visitor access tokens");
    return secret;
}

function signature(value: string, secret: string): Buffer {
    return createHmac("sha256", secret).update("visitor-access:").update(value).digest();
}

export function createVisitorRecordToken(): string {
    return `visitor_${randomBytes(32).toString("base64url")}`;
}

export function issueVisitorAccessToken(
    botId: string,
    visitorId: string,
    now = Date.now()
): string {
    const payload: VisitorTokenPayload = {
        botId,
        visitorId,
        issuedAt: now,
        expiresAt: now + TOKEN_LIFETIME_MS,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signed = `${TOKEN_PREFIX}.${encoded}`;
    return `${signed}.${signature(signed, signingSecret()).toString("base64url")}`;
}

export function verifyVisitorAccessToken(
    token: string | undefined,
    botId: string,
    now = Date.now()
): string | null {
    if (typeof token !== "string" || !token || token.length > 2048) return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;

    try {
        const signed = `${parts[0]}.${parts[1]}`;
        const provided = Buffer.from(parts[2], "base64url");
        const expected = signature(signed, signingSecret());
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as Partial<VisitorTokenPayload>;
        if (
            payload.botId !== botId ||
            typeof payload.visitorId !== "string" || !payload.visitorId ||
            typeof payload.issuedAt !== "number" || payload.issuedAt > now ||
            typeof payload.expiresAt !== "number" || payload.expiresAt <= now
        ) {
            return null;
        }
        return payload.visitorId;
    } catch {
        return null;
    }
}

type HistoryQuery = {
    where: { botId: string; visitorId: string };
    orderBy: { createdAt: "asc" };
    take: 50;
};

export interface VisitorHistoryStore<T> {
    findVisitor(where: { id: string; botId: string }): Promise<{ id: string } | null>;
    findConversations(query: HistoryQuery): Promise<T[]>;
}

/** Null means unauthorized; an empty array means this visitor has no history. */
export async function readVisitorHistory<T>(
    store: VisitorHistoryStore<T>,
    botId: string,
    accessToken: string | undefined
): Promise<T[] | null> {
    const visitorId = verifyVisitorAccessToken(accessToken, botId);
    if (!visitorId) return null;

    const visitor = await store.findVisitor({ id: visitorId, botId });
    if (!visitor) return null;

    return store.findConversations({
        where: { botId, visitorId },
        orderBy: { createdAt: "asc" },
        take: 50,
    });
}
