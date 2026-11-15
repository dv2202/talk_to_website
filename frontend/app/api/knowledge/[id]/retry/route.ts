import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { enqueueIngest } from "@/lib/ingest/queue";
import { requeueStaleSources } from "@/lib/ingest/sources";

/** Retries ingestion for one FAILED source. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const source = await prisma.knowledgeSource.findFirst({
        where: { id, bot: { userId: session.user.id } },
        select: { id: true, botId: true },
    });
    if (!source) {
        return NextResponse.json({ error: "Knowledge source not found" }, { status: 404 });
    }

    const queued = await requeueStaleSources(source.botId, [source.id]);
    await enqueueIngest(queued);
    return NextResponse.json({ queued: queued.length > 0 }, { status: 202 });
}
