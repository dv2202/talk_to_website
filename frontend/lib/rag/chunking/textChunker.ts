import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { loadRAGConfig } from '../config';

export async function chunkDocuments(documents: Document[]): Promise<Document[]> {
  const config = loadRAGConfig();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunking.size,
    chunkOverlap: config.chunking.overlap,
    separators: ['\n\n', '\n', '. ', ' ', ''],
    keepSeparator: true,
  });

  const chunks = await splitter.splitDocuments(documents);

  return chunks.map((chunk: Document, index: number) => new Document({
    pageContent: chunk.pageContent,
    metadata: {
      ...chunk.metadata,
      chunkIndex: index,
      createdAt: new Date().toISOString(),
    },
  }));
}
