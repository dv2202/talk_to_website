import { PlaywrightCrawler } from "@crawlee/playwright";

// Store Crawlee data in a writable temp directory (required for serverless environments)
process.env.CRAWLEE_STORAGE_DIR = "/tmp";

const MAX_URLS = 50;
const MIN_USEFUL_CONTENT_LENGTH = 100;

const BROWSER_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FETCH_HEADERS = {
    "User-Agent": BROWSER_USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
};

function isBlockedPage(title: string, content: string, url?: string): boolean {
    const haystack = `${title} ${content} ${url ?? ""}`.toLowerCase();
    return (
        haystack.includes("security checkpoint") ||
        haystack.includes("vercel.link/security-checkpoint") ||
        haystack.includes("access denied")
    );
}

async function fetchHtml(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: FETCH_HEADERS,
        redirect: "follow",
    });

    if (!response.ok) {
        throw new Error(`Request failed with ${response.status} status code`);
    }

    return response.text();
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

async function discoverUrlsWithPlaywright(homepageUrl: string): Promise<string[]> {
    const origin = new URL(homepageUrl).origin;
    const discoveredUrls: string[] = [];

    const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: 1,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: 30,
        navigationTimeoutSecs: 30,
        useSessionPool: false,

        launchContext: {
            launchOptions: {
                headless: true,
            },
        },

        preNavigationHooks: [
            async ({ page }) => {
                await page.setExtraHTTPHeaders(FETCH_HEADERS);
            },
        ],

        async requestHandler({ page, log }) {
            log.info(`Discovering links from ${homepageUrl}`);
            await page.waitForLoadState("networkidle");

            const links = await page.evaluate(() => {
                const anchors = document.querySelectorAll("a[href]");
                return Array.from(anchors).map((a) => (a as HTMLAnchorElement).href);
            });

            const valid = links.filter((l) => l.startsWith("http") && isRelevantUrl(l, origin));
            discoveredUrls.push(...valid);
        },

        headless: true,
    });

    await crawler.run([homepageUrl]);
    return dedupeAndLimitUrls(discoveredUrls);
}

async function scrapePageContentWithPlaywright(
    urls: string[]
): Promise<{ url: string; title: string; content: string }[]> {
    const results: { url: string; title: string; content: string }[] = [];

    const crawler = new PlaywrightCrawler({
        maxRequestsPerCrawl: Math.min(urls.length, MAX_URLS),
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: 30,
        navigationTimeoutSecs: 30,
        useSessionPool: false,

        launchContext: {
            launchOptions: {
                headless: true,
            },
        },

        preNavigationHooks: [
            async ({ page }) => {
                await page.setExtraHTTPHeaders(FETCH_HEADERS);
            },
        ],

        async requestHandler({ page, request, log }) {
            log.info(`Scraping content from ${request.url}`);
            await page.waitForLoadState("networkidle");

            const extracted = await page.evaluate(() => {
                const remove = document.querySelectorAll(
                    "script, style, nav, header, footer, iframe, noscript, .sidebar, .menu"
                );
                remove.forEach((el) => el.remove());

                return {
                    title: document.title || "",
                    content: document.body?.innerText?.trim() || "",
                };
            });

            results.push({
                url: request.loadedUrl || request.url,
                title: extracted.title,
                content: extracted.content,
            });
        },

        headless: true,
    });

    await crawler.run(urls);
    return results;
}

/**
 * Visit a homepage URL and discover all http/https links on the page.
 * Returns a sorted, deduplicated array of discovered URLs.
 */
export async function discoverUrls(homepageUrl: string): Promise<string[]> {
    let fetchError: Error | null = null;

    try {
        const fetchUrls = await discoverUrlsWithFetch(homepageUrl);
        const usefulLinks = fetchUrls.filter((url) => !isBlockedPage("", "", url));
        if (usefulLinks.length >= 2) {
            return usefulLinks;
        }
    } catch (error) {
        fetchError = error instanceof Error ? error : new Error("Fetch discovery failed");
    }

    const playwrightUrls = await discoverUrlsWithPlaywright(homepageUrl);
    const usefulPlaywrightLinks = playwrightUrls.filter((url) => !isBlockedPage("", "", url));
    if (usefulPlaywrightLinks.length > 0) {
        return usefulPlaywrightLinks;
    }

    throw new Error(
        fetchError?.message ||
            "Could not access the website. The site may block automated access or returned no links."
    );
}

/**
 * Scrape text content from each URL in the list.
 * Returns the page title and cleaned body text for each URL.
 */
export async function scrapePageContent(
    urls: string[]
): Promise<{ url: string; title: string; content: string }[]> {
    const results = new Map<string, { url: string; title: string; content: string }>();

    for (const url of urls.slice(0, MAX_URLS)) {
        try {
            const html = await fetchHtml(url);
            const extracted = extractPageContentFromHtml(html);
            if (isUsefulScrapedContent(extracted.title, extracted.content, url)) {
                results.set(url, { url, ...extracted });
            }
        } catch {
            // Retry with Playwright below.
        }
    }

    const missingUrls = urls.filter((url) => !results.has(url));
    if (missingUrls.length > 0) {
        const playwrightResults = await scrapePageContentWithPlaywright(missingUrls);
        for (const result of playwrightResults) {
            if (isUsefulScrapedContent(result.title, result.content, result.url)) {
                results.set(result.url, result);
            }
        }
    }

    return urls
        .filter((url) => results.has(url))
        .map((url) => results.get(url)!)
        .slice(0, MAX_URLS);
}
