import { del } from "@vercel/blob";
import { isWidgetLogoBlobUrl } from "@/lib/widget-logo-blob";

/**
 * Deletes a widget logo from Vercel Blob when the URL is one of ours.
 * Failures are logged and swallowed so callers (e.g. bot updates) are not blocked.
 */
export async function deleteWidgetLogoBlob(
    url: string | null | undefined
): Promise<void> {
    if (!url || !isWidgetLogoBlobUrl(url)) return;
    try {
        await del(url);
    } catch (error) {
        console.error("Failed to delete widget logo blob:", error);
    }
}

/**
 * If the previous logo was a Vercel Blob widget logo and it is no longer used,
 * delete it from Blob storage.
 */
export async function deleteReplacedWidgetLogoBlob(
    previousLogo: string | null | undefined,
    nextLogo: string | null | undefined
): Promise<void> {
    if (!previousLogo || previousLogo === nextLogo) return;
    await deleteWidgetLogoBlob(previousLogo);
}
