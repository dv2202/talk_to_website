import { retrieveRelevantChunks, RetrievedChunk } from '../retriever/retriever';
import { buildRAGPrompt } from '../prompt/promptBuilder';
import { prisma } from '@/lib/prisma';
import { invokeChatVertexAI } from '@/lib/gemini';

interface QueryOptions {
  botId: string;
  message: string;
  sessionId?: string;
  visitorId?: string;
  userId?: string;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    title: string;
    similarity: number;
  }>;
  chunksUsed: number;
}

function metaString(metadata: RetrievedChunk['metadata'] | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function queryWithRAG(options: QueryOptions): Promise<RAGResponse> {
  const { botId, message, sessionId, userId } = options;

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: {
      name: true,
      systemPrompt: true,
      defaultLanguage: true,
      description: true,
      userId: true,
    },
  });

  if (!bot) {
    throw new Error('Bot not found');
  }

  const retrievedChunks = await retrieveRelevantChunks({
    botId,
    query: message,
  });

  const { systemInstruction, userPrompt } = buildRAGPrompt({
    systemPrompt: bot.systemPrompt,
    userMessage: message,
    retrievedChunks,
    defaultLanguage: bot.defaultLanguage,
    assistantName: bot.name,
  });

  const answer =
    (await invokeChatVertexAI({
      systemInstruction,
      userPrompt,
      type: 'text',
      userId: userId || bot.userId,
      sessionId,
      metadata: { botId, botName: bot.name, source: 'ragService' },
    })) || "I'm sorry, I couldn't generate a response.";

  const sources = retrievedChunks.map((chunk) => ({
    title: metaString(chunk.metadata, 'title') || metaString(chunk.metadata, 'section') || 'Unknown',
    similarity: chunk.similarity,
  }));

  return {
    answer,
    sources,
    chunksUsed: retrievedChunks.length,
  };
}
