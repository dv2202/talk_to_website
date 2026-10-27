import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { discoverUrls } from "@/lib/services/scraper";
import { assertSafeScrapeUrl } from "@/lib/services/safe-scrape-http";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        try {
            assertSafeScrapeUrl(url);
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        const urls = await discoverUrls(url);
        return NextResponse.json({ urls });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Discover URLs error:", message);
        return NextResponse.json({ error: `Failed to discover URLs: ${message}` }, { status: 500 });
    }
}
