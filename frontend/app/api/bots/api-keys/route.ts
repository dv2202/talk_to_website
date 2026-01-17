import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import crypto from "crypto";

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
            select: {
                id: true,
                name: true,
                botName: true,
                widgetApiKey: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(bots);
    } catch (error) {
        console.error("Get bot api keys error:", error);
        return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
    }
}
