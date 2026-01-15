import { Embeddings } from '@langchain/core/embeddings';
import { loadRAGConfig } from '../config';

function resolveApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
}

export async function createEmbeddings(): Promise<Embeddings> {
  const config = loadRAGConfig();

  switch (config.embedding.provider) {
    case 'openai': {
      const { OpenAIEmbeddings } = await import('@langchain/openai');
      return new OpenAIEmbeddings({
        modelName: config.embedding.model,
        dimensions: config.embedding.dimensions,
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
    case 'gemini': {
      const { VertexAIEmbeddings } = await import('@langchain/google-vertexai');
      const apiKey = resolveApiKey();
      const location =
        process.env.GOOGLE_CLOUD_LOCATION || process.env.VERTEX_LOCATION || 'us-central1';

      return new VertexAIEmbeddings({
        model: config.embedding.model,
        dimensions: config.embedding.dimensions,
        location,
        ...(apiKey ? { apiKey } : {}),
      });
    }
    default:
      throw new Error(`Unsupported embedding provider: ${config.embedding.provider}`);
  }
}
