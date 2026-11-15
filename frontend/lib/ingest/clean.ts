/**
 * Text cleanup applied to every parsed page before chunking.
 * Pure functions — no I/O — so they're cheap to unit test.
 */

// Control chars except \t \n
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\uFEFF\u200B-\u200D]/g;
const PAGE_NUMBER_LINE = /^\s*(?:page\s+)?\d{1,4}(?:\s*(?:\/|of)\s*\d{1,4})?\s*$/i;

/** Normalises a single block of text. */
export function normalizeText(text: string): string {
  return (
    text
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(CONTROL_CHARS, "")
      // Ligature/quote variants that NFKC leaves alone
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      // Re-join words hyphenated across a line break: "infor-\nmation" -> "information"
      .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
      .replace(/[ \t\u00A0]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Lines that repeat on many pages (running headers/footers, "Confidential",
 * company name) add noise to every chunk. Detect them across pages.
 */
export function findRepeatedLines(pages: string[], minPages = 3, ratio = 0.5): Set<string> {
  const repeated = new Set<string>();
  if (pages.length < minPages) return repeated;

  const counts = new Map<string, number>();
  for (const page of pages) {
    const lines = new Set(
      page
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && line.length <= 120),
    );
    for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  }

  const threshold = Math.max(minPages, Math.ceil(pages.length * ratio));
  for (const [line, count] of counts) {
    if (count >= threshold) repeated.add(line);
  }
  return repeated;
}

export type CleanPage = { pageNumber: number; text: string };

/** Cleans parsed pages; drops pages left empty. Page numbers are 1-based and preserved. */
export function cleanPages(rawPages: string[]): CleanPage[] {
  const normalized = rawPages.map(normalizeText);
  const repeated = findRepeatedLines(normalized);

  const result: CleanPage[] = [];
  normalized.forEach((page, index) => {
    const text = page
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        if (repeated.has(trimmed)) return false;
        if (PAGE_NUMBER_LINE.test(trimmed)) return false;
        return true;
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Pages with only a couple of characters are usually scan artefacts.
    if (text.replace(/\s/g, "").length >= 3) {
      result.push({ pageNumber: index + 1, text });
    }
  });
  return result;
}
