import { NextRequest, NextResponse } from "next/server";
import {
    findBot,
    extractWidgetApiKey,
    needsWidgetApiKeyValidation,
    validateWidgetApiKey,
    validateOrigin,
    getCorsHeaders,
    corsResponse,
    getRequestOrigin,
    upsertVisitor,
    buildVisitorSummary,
    VisitorProfileInput
} from "@/lib/chat-utils";

export async function OPTIONS(req: NextRequest) {
    const origin = getRequestOrigin(req);
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin, null),
    });
}

export async function POST(req: NextRequest) {
    const origin = getRequestOrigin(req);

    try {
        const body = await req.json();
        const {
            botId,
            botName,
            visitorId,
            visitorToken,
            sessionId,
            profile,
            widgetApiKey,
        } = body as {
            botId?: string;
            botName?: string;
            visitorId?: string;
            visitorToken?: string;
            sessionId?: string;
            profile?: VisitorProfileInput;
            widgetApiKey?: string;
        };

        const bot = await findBot({ botId, botName });
        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        const originCheck = validateOrigin(origin, bot.allowedOrigin, req);
        if (!originCheck.valid) {
            return corsResponse({ error: originCheck.error }, origin, bot.allowedOrigin, originCheck.status);
        }

        const suppliedKey = extractWidgetApiKey(req, { widgetApiKey });
        if (needsWidgetApiKeyValidation({ visitorId, visitorToken, widgetApiKey: suppliedKey })) {
            const validation = validateWidgetApiKey({ bot, suppliedKey });
            if (!validation.valid) {
                return corsResponse({ error: validation.error }, origin, bot.allowedOrigin, validation.status);
            }
        }

        const visitor = await upsertVisitor({
            bot,
            req,
            visitorId,
            visitorToken,
            sessionId,
            profile,
        });

        if (!visitor) {
            return corsResponse({ error: "visitorToken is required" }, origin, bot.allowedOrigin, 400);
        }

        return corsResponse(buildVisitorSummary(visitor), origin, bot.allowedOrigin);
    } catch (error) {
        console.error("Register visitor error:", error);
        return corsResponse({ error: "Failed to register visitor" }, origin, null, 500);
    }
}
