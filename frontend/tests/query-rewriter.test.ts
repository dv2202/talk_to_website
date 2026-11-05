import assert from "node:assert/strict";
import { test } from "node:test";
import {
    buildRewritePrompt,
    REWRITE_HISTORY_TURNS,
    rewriteQueryForRetrieval,
    sanitizeRewrittenQuery,
    type HistoryTurn,
} from "../lib/rag/query/queryRewriter";

const history: HistoryTurn[] = [
    { userMessage: "Tell me about the Pro plan", aiResponse: "The Pro plan includes 5 bots and live chat." },
];

test("skips the model call when there is no history", async () => {
    let calls = 0;
    const result = await rewriteQueryForRetrieval({
        message: "What plans do you offer?",
        history: [],
        invoke: async () => { calls++; return "unused"; },
    });
    assert.equal(result, "What plans do you offer?");
    assert.equal(calls, 0);
});

test("uses the rewritten query for a follow-up", async () => {
    const result = await rewriteQueryForRetrieval({
        message: "what's its price?",
        history,
        invoke: async ({ userPrompt }) => {
            assert.match(userPrompt, /Pro plan/);
            assert.match(userPrompt, /Latest message: what's its price\?/);
            return "What is the price of the Pro plan?";
        },
    });
    assert.equal(result, "What is the price of the Pro plan?");
});

test("falls back to the original message on error, timeout or empty output", async () => {
    const message = "what's its price?";
    assert.equal(
        await rewriteQueryForRetrieval({ message, history, invoke: async () => { throw new Error("boom"); } }),
        message
    );
    assert.equal(
        await rewriteQueryForRetrieval({ message, history, invoke: () => new Promise(() => {}), timeoutMs: 20 }),
        message
    );
    assert.equal(await rewriteQueryForRetrieval({ message, history, invoke: async () => "   " }), message);
});

test("sanitizes labels, quotes, extra lines and overlong output", () => {
    assert.equal(sanitizeRewrittenQuery('Query: "Pro plan price"\nBecause the user...'), "Pro plan price");
    assert.equal(sanitizeRewrittenQuery("Standalone search query: Pro plan price"), "Pro plan price");
    assert.equal(sanitizeRewrittenQuery(""), null);
    assert.equal(sanitizeRewrittenQuery("x".repeat(301)), null);
});

test("prompt includes only the latest turns", () => {
    const many: HistoryTurn[] = Array.from({ length: 8 }, (_, i) => ({
        userMessage: `question ${i}`,
        aiResponse: `answer ${i}`,
    }));
    const prompt = buildRewritePrompt(many, "next");
    assert.ok(!prompt.includes("question 3"));
    assert.ok(prompt.includes(`question ${8 - REWRITE_HISTORY_TURNS}`));
    assert.ok(prompt.includes("question 7"));
});
