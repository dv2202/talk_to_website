import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { assertCanCreateBot, EntitlementError } from "@/lib/entitlements";
import { normalizeFallbackContacts } from "@/lib/fallback-contact";
import crypto from "crypto";

function normalizeDefaultLanguage(value?: string) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.slice(0, 64) : "English";
}

function generateWidgetApiKey() {
    return `ttw_${crypto.randomBytes(24).toString("hex")}`;
}

async function ensureWidgetApiKeysForUserBots(userId: string) {
    const botsMissingKey = await prisma.bot.findMany({
        where: {
            userId,
            widgetApiKey: null,
        },
        select: { id: true },
    });

    if (botsMissingKey.length === 0) {
        return;
    }

    await prisma.$transaction(
        botsMissingKey.map((bot: { id: string }) =>
            prisma.bot.update({
                where: { id: bot.id },
                data: { widgetApiKey: generateWidgetApiKey() },
            })
        )
    );
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        await ensureWidgetApiKeysForUserBots(session.user.id);

        const bots = await prisma.bot.findMany({
            where: { userId: session.user.id },
            include: {
                _count: {
                    select: {
                        knowledgeSources: true,
                        conversations: true,
                        visitors: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(bots);
    } catch (error) {
        console.error("Get bots error:", error);
        return NextResponse.json({ error: "Failed to fetch bots" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const {
            name,
            botName,
            description,
            systemPrompt,
            defaultLanguage,
            mode,
            widgetPosition,
            allowedOrigin,
            logo,
            themeColor,
            logoBgColor,
            widgetLogo,
            widgetLogoBgColor,
            welcomeTitle,
            welcomeSubtitle,
            quickQuestions,
            teaserMessage,
            teaserDelay,
            fallbackContacts,
            humanChatEnabled,
        } = await req.json();

        if (!name || !botName) {
            return NextResponse.json({ error: "Name and bot name are required" }, { status: 400 });
        }

        const normalizedContacts = normalizeFallbackContacts(fallbackContacts ?? []);
        if (normalizedContacts.error) {
            return NextResponse.json({ error: normalizedContacts.error }, { status: 400 });
        }

        try {
            await assertCanCreateBot(session.user.id);
        } catch (err) {
            if (err instanceof EntitlementError) {
                return NextResponse.json({ error: err.message }, { status: err.status });
            }
            throw err;
        }

        const normalizedBotName = botName.toLowerCase();

        const existing = await prisma.bot.findUnique({
            where: { botName: normalizedBotName },
        });

        if (existing) {
            return NextResponse.json({ error: "Bot name already taken" }, { status: 409 });
        }

        const bot = await prisma.bot.create({
            data: {
                name,
                botName: normalizedBotName,
                description: description || null,
                systemPrompt:
                    systemPrompt ||
                    "Answer users politely and help them understand our services.",
                defaultLanguage: normalizeDefaultLanguage(defaultLanguage),
                mode: mode || "CHAT",
                widgetPosition: widgetPosition || "BOTTOM_RIGHT",
                allowedOrigin: allowedOrigin || null,
                logo: logo || null,
                themeColor: themeColor || "#2563eb",
                logoBgColor: logoBgColor || "#ffffff",
                widgetLogo: widgetLogo || null,
                widgetLogoBgColor: widgetLogoBgColor || "#2678FF",
                welcomeTitle: welcomeTitle || null,
                welcomeSubtitle: welcomeSubtitle || null,
                quickQuestions: quickQuestions || "What do you do?,How can you help me?,Tell me more",
                teaserMessage: teaserMessage || null,
                teaserDelay: typeof teaserDelay === "number" ? teaserDelay : 5,
                fallbackContacts: normalizedContacts.contacts,
                humanChatEnabled: Boolean(humanChatEnabled),
                widgetApiKey: generateWidgetApiKey(),
                userId: session.user.id,
            },
        });

        return NextResponse.json(bot, { status: 201 });
    } catch (error) {
        console.error("Create bot error:", error);
        const message = error instanceof Error ? error.message : "Failed to create bot";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
