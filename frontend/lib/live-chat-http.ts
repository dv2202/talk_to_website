import { NextRequest } from "next/server";
import type { Bot } from "@prisma/client";
import {
    corsResponse,
    extractWidgetApiKey,
    getRequestOrigin,
    validateOrigin,
    validateWidgetApiKey,
} from "@/lib/chat-utils";
import { matchesRoomVisitor } from "@/lib/live-chat-access";

/**
 * Validate a live-chat request coming from the visitor side (widget / bot page).
 * The public widget key identifies an integration, not the visitor. Room access
 * requires the signed visitor proof issued by registration or room creation.
 */
export function authorizeLiveChatVisitor(req: NextRequest, params: {
    bot: Bot;
    room?: { botId: string; visitorId: string | null };
    accessToken?: string;
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
    if (suppliedKey) {
        const validation = validateWidgetApiKey({ bot, suppliedKey });
        if (!validation.valid) {
            return {
                ok: false as const,
                response: corsResponse({ error: validation.error }, origin, bot.allowedOrigin, validation.status),
            };
        }
    }

    if (room && !matchesRoomVisitor(room, params.accessToken || req.headers.get("x-visitor-access-token") || undefined)) {
        return {
            ok: false as const,
            response: corsResponse({ error: "Not authorized for this chat" }, origin, bot.allowedOrigin, 401),
        };
    }

    return { ok: true as const, origin };
}
