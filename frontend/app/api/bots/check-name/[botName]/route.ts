import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ botName: string }> }
) {
    try {
        const { botName } = await params;
        const excludeBotId = req.nextUrl.searchParams.get("excludeBotId");

        if (!botName || botName.length < 3) {
            return NextResponse.json({ error: "Bot name must be at least 3 characters" }, { status: 400 });
        }

        if (!/^[a-zA-Z0-9-]+$/.test(botName)) {
            return NextResponse.json({ error: "Bot name can only contain letters, numbers, and hyphens" }, { status: 400 });
        }

        const existing = await prisma.bot.findFirst({
            where: {
                botName: botName.toLowerCase(),
                ...(excludeBotId ? { NOT: { id: excludeBotId } } : {}),
            },
        });

        return NextResponse.json({ available: !existing });
    } catch (error) {
        console.error("Check bot name error:", error);
        return NextResponse.json({ error: "Failed to check bot name" }, { status: 500 });
    }
}
