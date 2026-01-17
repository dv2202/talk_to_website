import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import crypto from "crypto";

function generateWidgetApiKey() {
    return `ttw_${crypto.randomBytes(24).toString("hex")}`;
}

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { id } = await params;

        const bot = await prisma.bot.findFirst({
            where: {
                id: id,
                userId: session.user.id,
            },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const updated = await prisma.bot.update({
            where: { id: id },
            data: {
                widgetApiKey: generateWidgetApiKey(),
            },
            select: {
                id: true,
                name: true,
                botName: true,
                widgetApiKey: true,
                updatedAt: true,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Regenerate widget API key error:", error);
        return NextResponse.json({ error: "Failed to regenerate API key" }, { status: 500 });
    }
}
