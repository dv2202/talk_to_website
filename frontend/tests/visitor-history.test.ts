import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
    issueVisitorAccessToken,
    readVisitorHistory,
    verifyVisitorAccessToken,
} from "../lib/visitor-access";

const previousSecret = process.env.AUTH_SECRET;
before(() => { process.env.AUTH_SECRET = "test-secret-for-visitor-history"; });
after(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
});

test("an anonymous visitor token is bot-bound and expires", () => {
    const token = issueVisitorAccessToken("bot-a", "visitor-a", 1_000);
    assert.equal(verifyVisitorAccessToken(token, "bot-a", 1_001), "visitor-a");
    assert.equal(verifyVisitorAccessToken(token, "bot-b", 1_001), null);
    assert.equal(verifyVisitorAccessToken(token, "bot-a", 1_000 + 31 * 24 * 60 * 60 * 1000), null);
    assert.equal(verifyVisitorAccessToken(`${token}x`, "bot-a", 1_001), null);
    assert.equal(verifyVisitorAccessToken(42 as unknown as string, "bot-a", 1_001), null);
});

test("history rejects missing or forged proof without querying conversations", async () => {
    let queries = 0;
    const db = {
        findVisitor: async () => ({ id: "visitor-a" }),
        findConversations: async () => { queries++; return []; },
    };
    assert.equal(await readVisitorHistory(db, "bot-a", undefined), null);
    assert.equal(await readVisitorHistory(db, "bot-a", "visitor-a"), null);
    assert.equal(queries, 0);
});

test("history always queries by bot and verified visitor, never by caller session ID", async () => {
    const token = issueVisitorAccessToken("bot-a", "visitor-a");
    let where: unknown;
    const db = {
        findVisitor: async (where: { id: string; botId: string }) => {
            assert.deepEqual(where, { id: "visitor-a", botId: "bot-a" });
            return { id: "visitor-a" };
        },
        findConversations: async (args: { where: unknown }) => {
            where = args.where;
            return [{ id: "conversation-a" }];
        },
    };
    const result = await readVisitorHistory(db, "bot-a", token);
    assert.deepEqual(result, [{ id: "conversation-a" }]);
    assert.deepEqual(where, { botId: "bot-a", visitorId: "visitor-a" });
});

test("a deleted visitor cannot use an otherwise valid token", async () => {
    const token = issueVisitorAccessToken("bot-a", "deleted-visitor");
    const db = {
        findVisitor: async () => null,
        findConversations: async () => { throw new Error("must not query history"); },
    };
    assert.equal(await readVisitorHistory(db, "bot-a", token), null);
});
