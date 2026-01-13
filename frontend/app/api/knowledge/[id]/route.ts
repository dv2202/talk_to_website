import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { deleteChunksBySource } from "@/lib/rag";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { id } = await params; // This is botId

        const bot = await prisma.bot.findFirst({
            where: { id: id, userId: session.user.id },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        const sources = await prisma.knowledgeSource.findMany({
            where: { botId: id },
            select: {
                id: true,
                type: true,
                name: true,
                content: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(sources);
    } catch (error) {
        console.error("Get knowledge sources error:", error);
        return NextResponse.json({ error: "Failed to fetch knowledge sources" }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { id } = await params; // This is sourceId

        const source = await prisma.knowledgeSource.findUnique({
            where: { id: id },
            include: { bot: true },
        });

        if (!source || source.bot.userId !== session.user.id) {
            return NextResponse.json({ error: "Knowledge source not found" }, { status: 404 });
        }

        // Delete chunks first
        await deleteChunksBySource(id);

        // Then delete the source (cascade will handle any remaining chunks)
        await prisma.knowledgeSource.delete({
            where: { id: id },
        });

        return NextResponse.json({ message: "Knowledge source deleted successfully" });
    } catch (error) {
        console.error("Delete knowledge source error:", error);
        return NextResponse.json({ error: "Failed to delete knowledge source" }, { status: 500 });
    }
}
