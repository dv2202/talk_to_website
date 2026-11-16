#!/usr/bin/env node
// Creates TalkToWebsite's own support assistant through the app's public API,
// then crawls the marketing site into its knowledge base.
//
// Usage (the session cookie stays in your shell, never in the repo):
//   TTW_SESSION='<value of the __Host-ttw_session cookie>' node scripts/create-site-assistant.mjs
// Optional: TTW_BASE (default https://chat.dvweb.tech), TTW_BOT_NAME (default talktowebsite-help)

const BASE = (process.env.TTW_BASE || "https://chat.dvweb.tech").replace(/\/$/, "");
const SESSION = process.env.TTW_SESSION;
const BOT_NAME = process.env.TTW_BOT_NAME || "talktowebsite-help";
const COOKIE_NAME = BASE.startsWith("https://") ? "__Host-ttw_session" : "ttw_session";

if (!SESSION) {
    console.error("Set TTW_SESSION to your session cookie value (DevTools > Application > Cookies > __Host-ttw_session).");
    process.exit(1);
}

const KNOWN_PAGES = ["/", "/how-it-works", "/plans", "/docs", "/about", "/contact", "/privacy", "/terms"];

async function call(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: body ? "POST" : "GET",
        headers: {
            "Content-Type": "application/json",
            Cookie: `${COOKIE_NAME}=${SESSION}`,
            Origin: BASE,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${data.error || "request failed"}`);
    return data;
}

const SYSTEM_PROMPT = `You are the support assistant for TalkToWebsite, a platform that turns a company's website and documents into a grounded AI chat widget.
Answer only from the provided knowledge about TalkToWebsite: features, setup, pricing plans, security, and policies.
Be concise and friendly. When you are not sure, say so and suggest the contact page instead of guessing.`;

async function main() {
    // 1. Reuse the bot if it already exists, otherwise create it
    const bots = await call("/api/bots");
    let bot = bots.find((b) => b.botName === BOT_NAME);
    if (bot) {
        console.log(`Bot "${BOT_NAME}" already exists, adding knowledge to it.`);
    } else {
        bot = await call("/api/bots", {
            name: "TalkToWebsite Assistant",
            botName: BOT_NAME,
            description: "Answers questions about TalkToWebsite on chat.dvweb.tech",
            systemPrompt: SYSTEM_PROMPT,
            defaultLanguage: "English",
            mode: "CHAT",
            widgetPosition: "BOTTOM_RIGHT",
            themeColor: "#307766",
            widgetLogoBgColor: "#307766",
            welcomeTitle: "Hi there 👋",
            welcomeSubtitle: "Ask me anything about TalkToWebsite: setup, pricing or how it works.",
            quickQuestions: "How does it work?,How much does it cost?,How do I add it to my site?",
        });
        console.log(`Created bot "${bot.botName}" (${bot.id}).`);
    }

    // 2. Pages: the known marketing routes plus whatever discovery finds on the same site
    let discovered = [];
    try {
        discovered = (await call("/api/knowledge/url/discover", { url: `${BASE}/` })).urls || [];
    } catch (err) {
        console.warn(`Discovery failed, using the known pages only: ${err.message}`);
    }
    const origin = new URL(BASE).origin;
    const urls = [...new Set([...KNOWN_PAGES.map((p) => `${BASE}${p}`), ...discovered])]
        .filter((u) => {
            try {
                const parsed = new URL(u);
                return parsed.origin === origin && !/^\/(dashboard|bot|api|login|signup|admin)/.test(parsed.pathname);
            } catch {
                return false;
            }
        })
        .slice(0, 50);
    console.log(`Scraping ${urls.length} pages...`);

    // 3. Scrape, then save as knowledge (queued for background ingestion)
    const { results } = await call("/api/knowledge/url/scrape-batch", { urls });
    const sources = results
        .filter((r) => r.content && r.content !== "(No content extracted)")
        .map((r) => ({ name: r.title ? `${r.title} (${r.url})` : r.url, content: r.content }));
    if (sources.length === 0) throw new Error("No page content could be scraped.");
    const saved = await call("/api/knowledge/url/save-batch", { botId: bot.id, sources });
    console.log(`Queued ${sources.length} pages for ingestion.`, saved.message || "");

    console.log("\nEmbed values:");
    console.log(`  data-bot="${bot.botName}"`);
    console.log(`  data-api-key="${bot.widgetApiKey}"`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
