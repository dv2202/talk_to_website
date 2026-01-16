import { prisma } from '@/lib/prisma';
import { syncKnowledgeBase, syncSingleSource } from '../sync/incrementalSync';
import { getChunkCount, deleteChunksByBot } from '../vector-store/repository';

interface KnowledgeStatus {
  sourceCount: number;
  chunkCount: number;
  lastSyncedAt: Date | null;
}

export async function getKnowledgeStatus(botId: string): Promise<KnowledgeStatus> {
  const sourceCount = await prisma.knowledgeSource.count({
    where: { botId },
  });

  const chunkCount = await getChunkCount(botId);

  const lastChunk = await prisma.knowledgeChunk.findFirst({
    where: { botId },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });

  return {
    sourceCount,
    chunkCount,
    lastSyncedAt: lastChunk?.updatedAt || null,
  };
}

export async function importKnowledge(botId: string): Promise<{
  processed: number;
  updated: number;
  deleted: number;
  skipped: number;
}> {
  return syncKnowledgeBase(botId);
}

export async function syncSource(
  botId: string,
  sourceId: string
): Promise<{ success: boolean; chunksCreated: number }> {
  return syncSingleSource(botId, sourceId);
}

export async function clearKnowledge(botId: string): Promise<{
  sourcesDeleted: number;
  chunksDeleted: number;
}> {
  const chunksDeleted = await deleteChunksByBot(botId);

  const sourcesDeleted = await prisma.knowledgeSource.deleteMany({
    where: { botId },
  });

  return {
    sourcesDeleted: sourcesDeleted.count,
    chunksDeleted,
  };
}
