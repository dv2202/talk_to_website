import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { createOwnerLiveToken } from "@/lib/live-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const bots = await prisma.bot.findMany({
            where: { userId: session.user.id },
            select: { id: true, name: true, botName: true, humanChatEnabled: true },
        });

        const entries = bots.map(
            (bot: { id: string; name: string; botName: string; humanChatEnabled: boolean }) => ({
                botId: bot.id,
                botName: bot.botName,
                name: bot.name,
                humanChatEnabled: bot.humanChatEnabled,
                token: createOwnerLiveToken(session.user.id, bot.id),
            })
        );

        return NextResponse.json({ bots: entries });
    } catch (error) {
        console.error("Get owner live tokens error:", error);
        return NextResponse.json({ error: "Failed to prepare live chat" }, { status: 500 });
    }
}
