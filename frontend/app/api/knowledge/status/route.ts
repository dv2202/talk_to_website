import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, unauthorizedResponse } from '@/lib/auth-utils';
import { getKnowledgeStatus } from '@/lib/rag';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorizedResponse();

    const botId = req.nextUrl.searchParams.get('botId');

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: session.user.id },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const status = await getKnowledgeStatus(botId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Knowledge status error:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge status' },
      { status: 500 }
    );
  }
}
