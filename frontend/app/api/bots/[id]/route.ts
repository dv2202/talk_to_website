import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { isAdminEmail } from "@/lib/admin";
import { normalizeFallbackContacts } from "@/lib/fallback-contact";
import {
    deleteReplacedWidgetLogoBlob,
    deleteWidgetLogoBlob,
} from "@/lib/widget-logo-blob-server";

function normalizeDefaultLanguage(value?: string) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.slice(0, 64) : "English";
}

function botOwnershipWhere(id: string, userId: string, isAdmin: boolean) {
    return {
        id: id,
        ...(isAdmin ? {} : { userId }),
    };
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { id } = await params;
        const isAdmin = isAdminEmail(session.user.email);

        const bot = await prisma.bot.findFirst({
            where: botOwnershipWhere(id, session.user.id, isAdmin),
            include: {
                knowledgeSources: true,
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
        console.error("Get bot error:", error);
        return NextResponse.json({ error: "Failed to fetch bot" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { id } = await params;
        const body = await req.json();
        const isAdmin = isAdminEmail(session.user.email);
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
        } = body;

        const bot = await prisma.bot.findFirst({
            where: botOwnershipWhere(id, session.user.id, isAdmin),
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
                return NextResponse.json({ error: "Bot name must be at least 3 characters" }, { status: 400 });
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
                    return NextResponse.json({ error: "Bot name already taken" }, { status: 409 });
                }
            }

            normalizedBotName = trimmedBotName;
        }

        const nextLogo = logo !== undefined ? logo || null : undefined;

        const updated = await prisma.bot.update({
            where: { id: id },
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
                ...(allowedOrigin !== undefined && { allowedOrigin: allowedOrigin || null }),
                ...(nextLogo !== undefined && { logo: nextLogo }),
                ...(themeColor !== undefined && { themeColor }),
                ...(logoBgColor !== undefined && { logoBgColor }),
                ...(widgetLogo !== undefined && { widgetLogo: widgetLogo || null }),
                ...(widgetLogoBgColor !== undefined && { widgetLogoBgColor }),
                ...(welcomeTitle !== undefined && { welcomeTitle }),
                ...(welcomeSubtitle !== undefined && { welcomeSubtitle }),
                ...(quickQuestions !== undefined && { quickQuestions }),
                ...(teaserMessage !== undefined && { teaserMessage: teaserMessage || null }),
                ...(teaserDelay !== undefined && { teaserDelay: typeof teaserDelay === "number" ? teaserDelay : 5 }),
                ...(fallbackContactsUpdate && fallbackContactsUpdate),
                ...(humanChatEnabled !== undefined && { humanChatEnabled: Boolean(humanChatEnabled) }),
            },
        });

        if (nextLogo !== undefined) {
            await deleteReplacedWidgetLogoBlob(bot.logo, nextLogo);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Update bot error:", error);
        const message = error instanceof Error ? error.message : "Failed to update bot";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { id } = await params;
        const isAdmin = isAdminEmail(session.user.email);

        const bot = await prisma.bot.findFirst({
            where: botOwnershipWhere(id, session.user.id, isAdmin),
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        await prisma.bot.delete({
            where: { id: id },
        });

        await deleteWidgetLogoBlob(bot.logo);

        return NextResponse.json({ message: "Bot deleted successfully" });
    } catch (error) {
        console.error("Delete bot error:", error);
        return NextResponse.json({ error: "Failed to delete bot" }, { status: 500 });
    }
}
