const BLOB_HOST_RE = /\.blob\.vercel-storage\.com$/i;
const WIDGET_LOGO_PREFIX = "/widget-logos/";

function getBlobPathname(url: string): string | null {
    try {
        return decodeURIComponent(new URL(url).pathname);
    } catch {
        return null;
    }
}

/** True when the URL points at a Vercel Blob object under widget-logos/. */
export function isWidgetLogoBlobUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        if (!BLOB_HOST_RE.test(parsed.hostname)) return false;
        const pathname = decodeURIComponent(parsed.pathname);
        return pathname.startsWith(WIDGET_LOGO_PREFIX) || pathname.includes(WIDGET_LOGO_PREFIX);
    } catch {
        return false;
    }
}

/** True when the blob pathname is under widget-logos/{userId}/. */
export function isOwnedWidgetLogoBlobUrl(
    url: string | null | undefined,
    userId: string
): boolean {
    if (!url || !userId || !isWidgetLogoBlobUrl(url)) return false;
    const pathname = getBlobPathname(url);
    if (!pathname) return false;
    const ownedPrefix = `${WIDGET_LOGO_PREFIX}${userId}/`;
    return pathname.startsWith(ownedPrefix);
}
