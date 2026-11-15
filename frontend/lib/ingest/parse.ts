import pdfParse from "pdf-parse";

export class IngestError extends Error {
  /** Permanent errors are not retried (bad file, empty text, etc.). */
  permanent: boolean;
  constructor(message: string, permanent = false) {
    super(message);
    this.name = "IngestError";
    this.permanent = permanent;
  }
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_PDF_PAGES = 500;

export type FileKind = "pdf" | "txt";

export function detectFileKind(name: string, bytes: Uint8Array): FileKind | null {
  const ext = name.toLowerCase().split(".").pop();
  const isPdfMagic =
    bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; // %PDF-
  if (ext === "pdf") return isPdfMagic ? "pdf" : null;
  if (ext === "txt") return isPdfMagic ? null : "txt";
  return null;
}

type PdfTextItem = { str: string; transform: number[] };
type PdfPageData = {
  getTextContent: (opts: Record<string, boolean>) => Promise<{ items: PdfTextItem[] }>;
};

/** Extracts text page by page so chunks can keep their page number. */
export async function parsePdfPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];
  try {
    const result = await pdfParse(buffer, {
      max: MAX_PDF_PAGES,
      pagerender: async (pageData: PdfPageData) => {
        const content = await pageData.getTextContent({
          normalizeWhitespace: false,
          disableCombineTextItems: false,
        });
        let lastY: number | undefined;
        let text = "";
        for (const item of content.items) {
          const y = item.transform[5];
          text += lastY === undefined || lastY === y ? item.str : `\n${item.str}`;
          lastY = y;
        }
        pages.push(text);
        return text;
      },
    });
    if (result.numpages > MAX_PDF_PAGES) {
      console.warn(`[ingest] PDF has ${result.numpages} pages; only first ${MAX_PDF_PAGES} indexed`);
    }
  } catch (error) {
    throw new IngestError(
      `Could not read PDF: ${error instanceof Error ? error.message : "unknown error"}`,
      true,
    );
  }
  return pages;
}

/** TXT files are split on form feeds (if any) so very long files still get "pages". */
export function parseTxtPages(buffer: Buffer): string[] {
  let text = buffer.toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\uFFFD")) {
    // Not valid UTF-8 — fall back to latin1 rather than storing replacement chars.
    text = buffer.toString("latin1");
  }
  return text.split("\f");
}

export async function parseFile(kind: FileKind, buffer: Buffer): Promise<string[]> {
  return kind === "pdf" ? parsePdfPages(buffer) : parseTxtPages(buffer);
}
