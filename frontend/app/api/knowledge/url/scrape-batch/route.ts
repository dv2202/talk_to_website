import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { scrapePageContent } from "@/lib/services/scraper";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { urls } = await req.json();

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json({ error: "URLs array is required" }, { status: 400 });
        }

        if (urls.length > 50) {
            return NextResponse.json({ error: "Maximum 50 URLs per batch" }, { status: 400 });
        }

        // Validate all URLs
        for (const u of urls) {
            try {
                new URL(u);
            } catch {
                return NextResponse.json({ error: `Invalid URL: ${u}` }, { status: 400 });
            }
        }

        const results = await scrapePageContent(urls);
        return NextResponse.json({ results });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Scrape batch error:", message);
        return NextResponse.json({ error: `Failed to scrape URLs: ${message}` }, { status: 500 });
    }
}
