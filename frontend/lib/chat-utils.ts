import { Bot } from "@prisma/client";
import crypto from "crypto";
import { prisma, withAccelerateRetry } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import {
    createVisitorRecordToken,
    issueVisitorAccessToken,
    verifyVisitorAccessToken,
} from "@/lib/visitor-access";

export function getCorsHeaders(origin: string | null, allowedOrigin?: string | null) {
    const headers: Record<string, string> = {};

    if (allowedOrigin) {
        headers["Access-Control-Allow-Origin"] = allowedOrigin;
        headers["Vary"] = "Origin";
    } else if (origin) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Vary"] = "Origin";
    } else {
        headers["Access-Control-Allow-Origin"] = "*";
    }

    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, x-widget-api-key, x-visitor-access-token";
    headers["Access-Control-Max-Age"] = "86400";

    return headers;
}

export function getRequestOrigin(req: Request | NextRequest): string | null {
    const origin = req.headers.get("origin");
    if (origin && origin.trim()) {
        return origin.trim();
    }

    // Same-origin GETs (and some navigations) omit Origin; recover from Referer.
    const referer = req.headers.get("referer");
    if (referer) {
        try {
            return new URL(referer).origin;
        } catch {
            return null;
        }
    }

    return null;
}

export function validateOrigin(
    origin: string | null,
    allowedOrigin?: string | null,
    req?: Request | NextRequest
): { valid: true } | { valid: false; error: string; status: number } {
    if (!allowedOrigin) {
        return { valid: true };
    }

    const effectiveOrigin = (origin && origin.trim()) || (req ? getRequestOrigin(req) : null);

    // Browsers omit Origin on same-origin fetches; Sec-Fetch-Site is browser-controlled.
    if (!effectiveOrigin) {
        const secFetchSite = req?.headers.get("sec-fetch-site");
        if (secFetchSite === "same-origin") {
            return { valid: true };
        }
        return { valid: false, error: "Origin header is required for this bot", status: 403 };
    }

    const globalOrigin = process.env.ALLOWED_GLOBAL_ORIGIN;
    const normalizedOrigin = effectiveOrigin.trim().toLowerCase().replace(/\/+$/, "");

    if (globalOrigin && normalizedOrigin === globalOrigin.trim().toLowerCase().replace(/\/+$/, "")) {
        return { valid: true };
    }

    const allowed = allowedOrigin
        .split(",")
        .map((o) => o.trim().toLowerCase().replace(/\/+$/, ""));

    if (!allowed.includes(normalizedOrigin)) {
        return {
            valid: false,
            error: "This widget API key is not authorized for this website",
            status: 403,
        };
    }

    return { valid: true };
}

export function corsResponse(body: unknown, origin: string | null, allowedOrigin?: string | null, status = 200) {
    return NextResponse.json(body, {
        status,
        headers: getCorsHeaders(origin, allowedOrigin),
    });
}

export type VisitorProfileInput = {
    name?: string;
    email?: string;
    skippedProfile?: boolean;
    country?: string;
    deviceType?: string;
    platform?: string;
    timezone?: string;
    language?: string;
    userAgent?: string;
};

export function normalizeBotName(botName?: string) {
    return botName ? botName.toLowerCase() : undefined;
}

export function generateWidgetApiKey() {
    return `ttw_${crypto.randomBytes(24).toString("hex")}`;
}

export function extractWidgetApiKey(req: Request | NextRequest, body?: { widgetApiKey?: string }) {
    const headerValue = req.headers.get("x-widget-api-key");
    if (headerValue && headerValue.trim()) {
        return headerValue.trim();
    }

    if (typeof body?.widgetApiKey === "string" && body.widgetApiKey.trim()) {
        return body.widgetApiKey.trim();
    }

    return undefined;
}

export function needsWidgetApiKeyValidation(params: {
    visitorId?: string;
    visitorToken?: string;
    widgetApiKey?: string;
}) {
    return Boolean(params.visitorId || params.visitorToken || params.widgetApiKey);
}

export function validateWidgetApiKey(params: {
    bot: Bot;
    suppliedKey?: string;
}) {
    const { bot, suppliedKey } = params;

    if (!suppliedKey) {
        return { valid: false, error: "Widget API key is required", status: 401 };
    }

    if (suppliedKey !== bot.widgetApiKey) {
        return { valid: false, error: "Invalid widget API key", status: 401 };
    }

    return { valid: true };
}

export async function findBot(params: {
    botId?: string;
    botName?: string;
}): Promise<Bot | null> {
    // Do not include knowledgeSources here — full page content easily exceeds
    // Prisma Accelerate's query timeout. Chat routes use RAG chunks instead.
    let bot: Bot | null = null;

    if (params.botId) {
        bot = await withAccelerateRetry(() =>
            prisma.bot.findUnique({
                where: { id: params.botId },
                cacheStrategy: { ttl: 30, swr: 60 },
            })
        );
    }

    if (!bot && params.botName) {
        bot = await withAccelerateRetry(() =>
            prisma.bot.findUnique({
                where: { botName: normalizeBotName(params.botName!) },
                cacheStrategy: { ttl: 30, swr: 60 },
            })
        );
    }

    if (!bot) {
        return null;
    }

    if (!bot.widgetApiKey) {
        return withAccelerateRetry(() =>
            prisma.bot.update({
                where: { id: bot!.id },
                data: { widgetApiKey: generateWidgetApiKey() },
            })
        ) as Promise<Bot>;
    }

    return bot;
}

/** Fallback only when RAG returns no chunks. Prefer retrieveRelevantChunks. */
export async function getKnowledgeSourceContents(botId: string): Promise<string[]> {
    try {
        const sources = await prisma.knowledgeSource.findMany({
            where: { botId },
            select: { content: true },
        });
        return sources.map((source: { content: string }) => source.content);
    } catch (error) {
        // Prisma Accelerate often times out when shipping large crawled pages.
        console.warn("Failed to load knowledge sources for fallback:", error);
        return [];
    }
}

export function getClientIp(req: Request | NextRequest) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0].trim();
    }

    return (req as any).ip || null;
}

export function getCountryFromRequest(req: Request | NextRequest, fallbackCountry?: string) {
    const headerCountry =
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("cf-ipcountry") ||
        req.headers.get("x-country-code");

    if (headerCountry && headerCountry.trim()) {
        return headerCountry.trim();
    }

    return fallbackCountry || null;
}

export function normalizeVisitorName(name?: string, skippedProfile?: boolean) {
    const trimmedName = name?.trim();
    if (trimmedName) {
        return trimmedName;
    }

    return skippedProfile ? "Anonymous User" : "Website Visitor";
}

export async function upsertVisitor(params: {
    bot: Bot;
    req: Request | NextRequest;
    visitorId?: string;
    visitorToken?: string;
    sessionId?: string;
    profile?: VisitorProfileInput;
}) {
    const { bot, req, visitorId, visitorToken, sessionId, profile } = params;

    const normalizedProfile = profile || {};
    const name = normalizeVisitorName(normalizedProfile.name, normalizedProfile.skippedProfile);
    const email = normalizedProfile.email?.trim() || null;
    const country = getCountryFromRequest(req, normalizedProfile.country);
    const userAgent = normalizedProfile.userAgent || req.headers.get("user-agent") || null;
    const ipAddress = getClientIp(req);
    const now = new Date();

    if (visitorId) {
        const existingVisitor = await prisma.visitor.findFirst({
            where: {
                id: visitorId,
                botId: bot.id,
            },
        });

        if (existingVisitor) {
            return prisma.visitor.update({
                where: { id: existingVisitor.id },
                data: {
                    sessionId: sessionId || existingVisitor.sessionId,
                    name: existingVisitor.name === "Anonymous User" || normalizedProfile.name ? name : existingVisitor.name,
                    email: email || existingVisitor.email,
                    skippedProfile: normalizedProfile.skippedProfile ?? existingVisitor.skippedProfile,
                    country: country || existingVisitor.country,
                    ipAddress: ipAddress || existingVisitor.ipAddress,
                    userAgent: typeof userAgent === "string" ? userAgent : existingVisitor.userAgent,
                    deviceType: normalizedProfile.deviceType || existingVisitor.deviceType,
                    platform: normalizedProfile.platform || existingVisitor.platform,
                    timezone: normalizedProfile.timezone || existingVisitor.timezone,
                    language: normalizedProfile.language || existingVisitor.language,
                    lastSeenAt: now,
                },
            });
        }
    }

    if (!visitorToken) {
        return null;
    }

    return prisma.visitor.upsert({
        where: {
            botId_visitorToken: {
                botId: bot.id,
                visitorToken,
            },
        },
        create: {
            botId: bot.id,
            visitorToken,
            sessionId: sessionId || null,
            name,
            email,
            skippedProfile: normalizedProfile.skippedProfile ?? false,
            country,
            ipAddress,
            userAgent: typeof userAgent === "string" ? userAgent : null,
            deviceType: normalizedProfile.deviceType || null,
            platform: normalizedProfile.platform || null,
            timezone: normalizedProfile.timezone || null,
            language: normalizedProfile.language || null,
            firstSeenAt: now,
            lastSeenAt: now,
        },
        update: {
            sessionId: sessionId || undefined,
            name,
            email,
            skippedProfile: normalizedProfile.skippedProfile ?? false,
            country,
            ipAddress,
            userAgent: typeof userAgent === "string" ? userAgent : undefined,
            deviceType: normalizedProfile.deviceType || undefined,
            platform: normalizedProfile.platform || undefined,
            timezone: normalizedProfile.timezone || undefined,
            language: normalizedProfile.language || undefined,
            lastSeenAt: now,
        },
    });
}

/** Anonymous visitor continuity. A caller-provided visitorId is never proof of identity. */
export async function upsertAuthorizedVisitor(params: {
    bot: Bot;
    req: Request | NextRequest;
    accessToken?: string;
    sessionId?: string;
    profile?: VisitorProfileInput;
}): Promise<{ visitor: Awaited<ReturnType<typeof upsertVisitor>>; accessToken: string } | null> {
    const { bot, req, accessToken, sessionId, profile } = params;
    const verifiedId = accessToken
        ? verifyVisitorAccessToken(accessToken, bot.id)
        : null;
    if (accessToken && !verifiedId) return null;

    const visitor = await upsertVisitor({
        bot,
        req,
        visitorId: verifiedId || undefined,
        visitorToken: verifiedId ? undefined : createVisitorRecordToken(),
        sessionId,
        profile,
    });
    if (!visitor) return null;

    return {
        visitor,
        accessToken: issueVisitorAccessToken(bot.id, visitor.id),
    };
}

export function buildVisitorSummary(visitor: any) {
    return {
        id: visitor.id,
        name: visitor.name,
        email: visitor.email,
        country: visitor.country,
        deviceType: visitor.deviceType,
        platform: visitor.platform,
        timezone: visitor.timezone,
        language: visitor.language,
        ipAddress: visitor.ipAddress,
        userAgent: visitor.userAgent,
        skippedProfile: visitor.skippedProfile,
        firstSeenAt: visitor.firstSeenAt,
        lastSeenAt: visitor.lastSeenAt,
        sessionId: visitor.sessionId,
        totalMessages: visitor._count?.conversations ?? 0,
    };
}

export function groupLegacyConversations(
    conversations: Array<{
        id: string;
        userMessage: string;
        aiResponse: string;
        sessionId: string | null;
        createdAt: Date;
    }>
) {
    const groups = new Map<string, typeof conversations>();

    conversations.forEach((conversation) => {
        const groupKey = conversation.sessionId || `legacy-${conversation.id}`;
        const existing = groups.get(groupKey) || [];
        existing.push(conversation);
        groups.set(groupKey, existing);
    });

    return Array.from(groups.entries()).map(([groupKey, items]) => {
        const latest = items.reduce((current, item) => {
            return item.createdAt > current.createdAt ? item : current;
        }, items[0]);

        return {
            id: `legacy:${groupKey}`,
            name: "Anonymous User",
            email: null,
            country: null,
            deviceType: null,
            platform: null,
            timezone: null,
            language: null,
            ipAddress: null,
            userAgent: null,
            skippedProfile: true,
            firstSeenAt: items[0].createdAt,
            lastSeenAt: latest.createdAt,
            sessionId: latest.sessionId,
            totalMessages: items.length,
            lastMessageAt: latest.createdAt,
            lastMessagePreview: latest.userMessage,
            isLegacy: true,
        };
    });
}
