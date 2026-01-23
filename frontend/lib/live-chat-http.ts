import { NextRequest } from "next/server";
import type { Bot } from "@prisma/client";
import {
    corsResponse,
    extractWidgetApiKey,
    getRequestOrigin,
    needsWidgetApiKeyValidation,
    validateOrigin,
    validateWidgetApiKey,
} from "@/lib/chat-utils";

/**
 * Validate a live-chat request coming from the visitor side (widget / bot page).
 * Mirrors the `/api/chat` visitor auth: origin + widget API key (+ visitor match).
 */
export function authorizeLiveChatVisitor(req: NextRequest, params: {
    bot: Bot;
    room: {
        visitorId: string | null;
    };
    visitorId?: string;
    widgetApiKey?: string;
}) {
    const { bot, room } = params;
    const origin = getRequestOrigin(req);

    const originCheck = validateOrigin(origin, bot.allowedOrigin, req);
    if (!originCheck.valid) {
        return {
            ok: false as const,
            response: corsResponse({ error: originCheck.error }, origin, bot.allowedOrigin, originCheck.status),
        };
    }

    const suppliedKey = extractWidgetApiKey(req, { widgetApiKey: params.widgetApiKey });
    if (needsWidgetApiKeyValidation({ visitorId: params.visitorId, visitorToken: undefined, widgetApiKey: suppliedKey })) {
        const validation = validateWidgetApiKey({ bot, suppliedKey });
        if (!validation.valid) {
            return {
                ok: false as const,
                response: corsResponse({ error: validation.error }, origin, bot.allowedOrigin, validation.status),
            };
        }
    }

    if (room.visitorId && params.visitorId && room.visitorId !== params.visitorId) {
        return {
            ok: false as const,
            response: corsResponse({ error: "Not authorized for this chat" }, origin, bot.allowedOrigin, 403),
        };
    }

    return { ok: true as const, origin };
}
