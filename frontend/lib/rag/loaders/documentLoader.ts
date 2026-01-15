import { Document } from '@langchain/core/documents';
import { parseMarkdown } from '../parsers/markdownParser';

interface LoadOptions {
  sourceId: string;
  botId: string;
  filePath?: string;
  content?: string;
  metadata?: Record<string, any>;
}

export async function loadDocument(options: LoadOptions): Promise<Document[]> {
  const { sourceId, botId, content, metadata = {} } = options;

  if (!content) {
    throw new Error('Content must be provided');
  }

  const baseMetadata = {
    ...metadata,
    sourceId,
    botId,
    sourceType: metadata.sourceType || 'unknown',
    title: metadata.title || metadata.name || 'Unknown Document',
  };

  const documents = parseMarkdown(content, baseMetadata);

  return documents.map((doc, index) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      chunkIndex: index,
      createdAt: new Date().toISOString(),
    },
  }));
}
