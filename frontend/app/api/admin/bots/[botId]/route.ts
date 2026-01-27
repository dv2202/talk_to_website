import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-utils";
import { normalizeFallbackContacts } from "@/lib/fallback-contact";
import { deleteReplacedWidgetLogoBlob } from "@/lib/widget-logo-blob-server";

function normalizeDefaultLanguage(value?: string) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.slice(0, 64) : "English";
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const { botId } = await params;

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
            include: {
                knowledgeSources: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                _count: {
                    select: { conversations: true, visitors: true },
                },
            },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        return NextResponse.json(bot);
    } catch (error) {
        console.error("Admin get bot error:", error);
        return NextResponse.json({ error: "Failed to fetch bot" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ botId: string }> }
) {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const { botId } = await params;
        const body = await req.json();
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
        } = body;

        const bot = await prisma.bot.findUnique({
            where: { id: botId },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        let fallbackContactsUpdate: { fallbackContacts: unknown } | undefined;

        if (fallbackContacts !== undefined) {
            const normalizedContacts = normalizeFallbackContacts(fallbackContacts);
            if (normalizedContacts.error) {
                return NextResponse.json({ error: normalizedContacts.error }, { status: 400 });
            }
            fallbackContactsUpdate = {
                fallbackContacts: normalizedContacts.contacts,
            };
        }

        let normalizedBotName: string | undefined;
        if (botName !== undefined) {
            const trimmedBotName = botName.toLowerCase().trim();

            if (trimmedBotName.length < 3) {
                return NextResponse.json(
                    { error: "Bot name must be at least 3 characters" },
                    { status: 400 }
                );
            }

            if (!/^[a-z0-9-]+$/.test(trimmedBotName)) {
                return NextResponse.json(
                    { error: "Bot name can only contain letters, numbers, and hyphens" },
                    { status: 400 }
                );
            }

            if (trimmedBotName !== bot.botName) {
                const existing = await prisma.bot.findUnique({
                    where: { botName: trimmedBotName },
                });

                if (existing) {
                    return NextResponse.json(
                        { error: "Bot name already taken" },
                        { status: 409 }
                    );
                }
            }

            normalizedBotName = trimmedBotName;
        }

        const nextLogo = logo !== undefined ? logo || null : undefined;

        const updated = await prisma.bot.update({
            where: { id: botId },
            data: {
                ...(name && { name }),
                ...(normalizedBotName && { botName: normalizedBotName }),
                ...(description !== undefined && { description }),
                ...(systemPrompt && { systemPrompt }),
                ...(defaultLanguage !== undefined && {
                    defaultLanguage: normalizeDefaultLanguage(defaultLanguage),
                }),
                ...(mode && { mode }),
                ...(widgetPosition && { widgetPosition }),
                ...(allowedOrigin !== undefined && {
                    allowedOrigin: allowedOrigin || null,
                }),
                ...(nextLogo !== undefined && { logo: nextLogo }),
                ...(themeColor !== undefined && { themeColor }),
                ...(logoBgColor !== undefined && { logoBgColor }),
                ...(widgetLogo !== undefined && { widgetLogo: widgetLogo || null }),
                ...(widgetLogoBgColor !== undefined && { widgetLogoBgColor }),
                ...(welcomeTitle !== undefined && { welcomeTitle }),
                ...(welcomeSubtitle !== undefined && { welcomeSubtitle }),
                ...(quickQuestions !== undefined && { quickQuestions }),
                ...(teaserMessage !== undefined && {
                    teaserMessage: teaserMessage || null,
                }),
                ...(teaserDelay !== undefined && {
                    teaserDelay: typeof teaserDelay === "number" ? teaserDelay : 5,
                }),
                ...(fallbackContactsUpdate && fallbackContactsUpdate),
            },
        });

        if (nextLogo !== undefined) {
            await deleteReplacedWidgetLogoBlob(bot.logo, nextLogo);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Admin update bot error:", error);
        return NextResponse.json({ error: "Failed to update bot" }, { status: 500 });
    }
}
