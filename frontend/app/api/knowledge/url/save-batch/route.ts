import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { syncSingleSource } from "@/lib/rag";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { botId, sources } = await req.json();

        if (!botId || !sources || !Array.isArray(sources) || sources.length === 0) {
            return NextResponse.json({ error: "botId and sources array are required" }, { status: 400 });
        }

        // Verify bot belongs to user
        const bot = await prisma.bot.findFirst({
            where: { id: botId, userId: session.user.id },
        });

        if (!bot) {
            return NextResponse.json({ error: "Bot not found" }, { status: 404 });
        }

        // Hash-fragment docs URLs often scrape to identical full-page text — keep one copy
        const seenContentHashes = new Set<string>();
        const uniqueSources: Array<{ name: string; content: string }> = [];
        for (const source of sources as Array<{ name: string; content: string }>) {
            const content = typeof source.content === "string" ? source.content : "";
            const hash = createHash("sha256").update(content).digest("hex");
            if (seenContentHashes.has(hash)) continue;
            seenContentHashes.add(hash);
            uniqueSources.push({
                name: source.name,
                content,
            });
        }

        if (uniqueSources.length === 0) {
            return NextResponse.json({ error: "No unique sources to save" }, { status: 400 });
        }

        // Bulk insert in one query — avoids interactive transaction timeout when saving many large pages
        const saved = await prisma.knowledgeSource.createManyAndReturn({
            data: uniqueSources.map((s) => ({
                type: "URL" as const,
                name: s.name,
                content: s.content,
                botId,
            })),
        });

        // Await sync so serverless runtimes do not kill embedding mid-write.
        // Fire-and-forget left sources saved but chunks truncated/missing.
        const syncResults: Array<{ sourceId: string; success: boolean; chunksCreated?: number; error?: string }> = [];
        for (const source of saved) {
            try {
                const result = await syncSingleSource(botId, source.id);
                syncResults.push({
                    sourceId: source.id,
                    success: result.success,
                    chunksCreated: result.chunksCreated,
                });
            } catch (syncError) {
                const message = syncError instanceof Error ? syncError.message : "Unknown sync error";
                console.error(`RAG sync failed for source ${source.id}:`, syncError);
                syncResults.push({ sourceId: source.id, success: false, error: message });
            }
        }

        return NextResponse.json({
            saved,
            syncResults,
            deduplicatedCount: sources.length - uniqueSources.length,
        }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Save batch error:", message);
        return NextResponse.json({ error: `Failed to save knowledge sources: ${message}` }, { status: 500 });
    }
}
