import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, unauthorizedResponse } from '@/lib/auth-utils';
import { importKnowledge } from '@/lib/rag';

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

    const result = await importKnowledge(botId);

    return NextResponse.json({
      success: true,
      message: 'Knowledge base synced successfully',
      ...result,
    });
  } catch (error) {
    console.error('Knowledge sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync knowledge base' },
      { status: 500 }
    );
  }
}
