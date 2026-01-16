import { Document } from '@langchain/core/documents';

export function parseMarkdown(
  content: string,
  metadata: Record<string, any>
): Document[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  const sections = splitByHeadings(content);

  if (sections.length === 0) {
    return [
      new Document({
        pageContent: content.trim(),
        metadata: {
          ...metadata,
          title: metadata.title || 'Untitled',
          section: undefined,
          headingLevel: 0,
        },
      }),
    ];
  }

  const documents: Document[] = [];

  for (const section of sections) {
    const { heading, body, level } = section;

    if (!body || body.trim().length === 0) {
      continue;
    }

    documents.push(
      new Document({
        pageContent: body.trim(),
        metadata: {
          ...metadata,
          title: heading || metadata.title,
          section: heading || undefined,
          headingLevel: level,
        },
      })
    );
  }

  return documents;
}

interface Section {
  heading: string | null;
  body: string;
  level: number;
}

function splitByHeadings(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentHeading: string | null = null;
  let currentLevel = 0;
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      if (currentBody.length > 0 || currentHeading) {
        sections.push({
          heading: currentHeading,
          body: currentBody.join('\n').trim(),
          level: currentLevel,
        });
      }

      currentHeading = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentBody.length > 0 || currentHeading) {
    sections.push({
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
      level: currentLevel,
    });
  }

  return sections;
}
