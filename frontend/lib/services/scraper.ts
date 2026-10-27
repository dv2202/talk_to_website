import { assertSafeScrapeUrl, fetchPublicHtml } from "@/lib/services/safe-scrape-http";

const MAX_URLS = 50;
const MIN_USEFUL_CONTENT_LENGTH = 100;

function isBlockedPage(title: string, content: string, url?: string): boolean {
    const haystack = `${title} ${content} ${url ?? ""}`.toLowerCase();
    return (
        haystack.includes("security checkpoint") ||
        haystack.includes("vercel.link/security-checkpoint") ||
        haystack.includes("access denied")
    );
}

async function fetchHtml(url: string): Promise<string> {
    return fetchPublicHtml(url);
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
    const base = new URL(baseUrl);
    const links: string[] = [];
    const hrefPattern = /href=["']([^"']+)["']/gi;

    for (const match of html.matchAll(hrefPattern)) {
        try {
            const resolved = new URL(match[1], base).href;
            if (resolved.startsWith("http")) {
                links.push(resolved);
            }
        } catch {
            // Ignore malformed href values.
        }
    }

    return links;
}

function extractPageContentFromHtml(html: string): { title: string; content: string } {
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";

    let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
    body = body
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<(nav|header|footer|iframe|noscript)[\s\S]*?<\/\1>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

    return { title, content: body };
}

/** File extensions we treat as non-content static assets. */
const STATIC_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".bmp",
    ".css", ".js", ".json", ".woff", ".woff2", ".ttf", ".eot",
    ".pdf", ".zip", ".tar", ".gz", ".mp4", ".mp3", ".webm",
]);

function isRelevantUrl(url: string, origin: string): boolean {
    try {
        const parsed = new URL(url);
        // Only keep same-origin links.
        if (parsed.origin !== origin) return false;
        // Skip static assets by file extension.
        const path = parsed.pathname.toLowerCase();
        if (STATIC_EXTENSIONS.has(path.match(/\.[a-z0-9]+$/)?.[0] ?? "")) return false;
        // Skip common non-content paths.
        if (
            path.startsWith("/_next/") ||
            path.startsWith("/__nextjs") ||
            path.includes("/favicon") ||
            path.startsWith("/auth/") ||
            path.startsWith("/login")
        ) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

function dedupeAndLimitUrls(urls: string[]): string[] {
    return [...new Set(urls)].sort().slice(0, MAX_URLS);
}

function isUsefulScrapedContent(title: string, content: string, url?: string): boolean {
    if (isBlockedPage(title, content, url)) return false;
    return content.length >= MIN_USEFUL_CONTENT_LENGTH;
}

async function discoverUrlsWithFetch(homepageUrl: string): Promise<string[]> {
    const html = await fetchHtml(homepageUrl);
    const origin = new URL(homepageUrl).origin;
    return dedupeAndLimitUrls(
        extractLinksFromHtml(html, homepageUrl).filter((url) => isRelevantUrl(url, origin))
    );
}

/**
 * Visit a homepage URL and discover all http/https links on the page.
 * Returns a sorted, deduplicated array of discovered URLs.
 */
export async function discoverUrls(homepageUrl: string): Promise<string[]> {
    assertSafeScrapeUrl(homepageUrl);
    const fetchUrls = await discoverUrlsWithFetch(homepageUrl);
    const usefulLinks = fetchUrls.filter((url) => !isBlockedPage("", "", url));
    return usefulLinks.length ? usefulLinks : [homepageUrl];
}

/**
 * Scrape text content from each URL in the list.
 * Returns the page title and cleaned body text for each URL.
 */
export async function scrapePageContent(
    urls: string[]
): Promise<{ url: string; title: string; content: string }[]> {
    urls.forEach(assertSafeScrapeUrl);
    const results = new Map<string, { url: string; title: string; content: string }>();

    for (const url of urls.slice(0, MAX_URLS)) {
        try {
            const html = await fetchHtml(url);
            const extracted = extractPageContentFromHtml(html);
            if (isUsefulScrapedContent(extracted.title, extracted.content, url)) {
                results.set(url, { url, ...extracted });
            }
        } catch {
            // Skip pages that cannot be safely retrieved.
        }
    }

    return urls
        .filter((url) => results.has(url))
        .map((url) => results.get(url)!)
        .slice(0, MAX_URLS);
}
