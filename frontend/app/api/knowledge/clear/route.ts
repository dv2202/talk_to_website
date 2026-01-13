import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { clearKnowledge } from "@/lib/rag";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { botId } = await req.json();

        if (!botId) {
            return NextResponse.json({ error: "botId is required" }, { status: 400 });
        }

        const bot = await prisma.bot.findFirst({
            where: { id: botId, userId: session.user.id },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const result = await clearKnowledge(botId);

        return NextResponse.json({
            message: "All knowledge sources deleted successfully",
            ...result,
        });
    } catch (error) {
        console.error("Clear knowledge base error:", error);
        return NextResponse.json(
            { error: "Failed to delete all knowledge sources" },
            { status: 500 }
        );
    }
}
