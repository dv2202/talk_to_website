import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { getCorsHeaders, corsResponse } from "@/lib/chat-utils";
import { getEffectivePlan } from "@/lib/entitlements";

function generateWidgetApiKey() {
    return `ttw_${crypto.randomBytes(24).toString("hex")}`;
}

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get("origin");
    return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin, null),
    });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ botName: string }> }
) {
    const origin = req.headers.get("origin");

    try {
        const { botName } = await params;

        if (!botName) {
            return corsResponse({ error: "Bot name is required" }, origin, null, 400);
        }

        const keyFromHeader = req.headers.get("x-widget-api-key");
        const suppliedKey = keyFromHeader?.trim();

        const widgetConfigSelect = {
            id: true,
            name: true,
            botName: true,
            userId: true,
            widgetApiKey: true,
            description: true,
            defaultLanguage: true,
            mode: true,
            widgetPosition: true,
            allowedOrigin: true,
            logo: true,
            themeColor: true,
            logoBgColor: true,
            widgetLogo: true,
            widgetLogoBgColor: true,
            welcomeTitle: true,
            welcomeSubtitle: true,
            quickQuestions: true,
            teaserMessage: true,
            teaserDelay: true,
            fallbackContacts: true,
            humanChatEnabled: true,
            _count: {
                select: { knowledgeSources: true },
            },
        } as const;

        const bot = await prisma.bot.findUnique({
            where: { botName: botName.toLowerCase() },
            select: widgetConfigSelect,
        });

        if (!bot) {
            return corsResponse({ error: "Bot not found" }, origin, null, 404);
        }

        const ensuredBot = bot.widgetApiKey
            ? bot
            : await prisma.bot.update({
                  where: { id: bot.id },
                  data: { widgetApiKey: generateWidgetApiKey() },
                  select: widgetConfigSelect,
              });

        if (suppliedKey && suppliedKey !== ensuredBot.widgetApiKey) {
            return corsResponse({ error: "Invalid widget API key" }, origin, ensuredBot.allowedOrigin, 401);
        }

        const ownerPlan = await getEffectivePlan(ensuredBot.userId);

        return corsResponse({
            id: ensuredBot.id,
            name: ensuredBot.name,
            botName: ensuredBot.botName,
            widgetApiKey: ensuredBot.widgetApiKey,
            description: ensuredBot.description,
            defaultLanguage: ensuredBot.defaultLanguage,
            mode: ensuredBot.mode,
            widgetPosition: ensuredBot.widgetPosition,
            logo: ensuredBot.logo,
            themeColor: ensuredBot.themeColor,
            logoBgColor: ensuredBot.logoBgColor,
            widgetLogo: ensuredBot.widgetLogo,
            widgetLogoBgColor: ensuredBot.widgetLogoBgColor,
            welcomeTitle: ensuredBot.welcomeTitle,
            welcomeSubtitle: ensuredBot.welcomeSubtitle,
            quickQuestions: ensuredBot.quickQuestions,
            teaserMessage: ensuredBot.teaserMessage,
            teaserDelay: ensuredBot.teaserDelay,
            fallbackContacts: ensuredBot.fallbackContacts ?? [],
            knowledgeSourcesCount: ensuredBot._count?.knowledgeSources ?? 0,
            humanChatEnabled: ensuredBot.humanChatEnabled,
            liveChatAvailable: ownerPlan.id === "PRO" && ensuredBot.humanChatEnabled,
            showBranding: ownerPlan.showBranding,
        }, origin, ensuredBot.allowedOrigin);
    } catch (error) {
        console.error("Get widget config error:", error);
        return corsResponse({ error: "Failed to fetch widget config" }, origin, null, 500);
    }
}
