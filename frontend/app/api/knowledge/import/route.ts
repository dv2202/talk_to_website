import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, unauthorizedResponse } from '@/lib/auth-utils';
import { enqueueIngest } from '@/lib/ingest/queue';
import { requeueStaleSources } from '@/lib/ingest/sources';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const { botId } = await req.json();

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.user.id },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Changed or failed sources go back on the queue; progress streams over SSE.
    const queued = await requeueStaleSources(botId);
    await enqueueIngest(queued);

    return NextResponse.json({ success: true, queued: queued.length }, { status: 202 });
  } catch (error) {
    console.error('Knowledge import error:', error);
    return NextResponse.json(
      { error: 'Failed to import knowledge base' },
      { status: 500 }
    );
  }
}
