import test from "node:test";
import assert from "node:assert/strict";
import { buildRecentHistoryQuery, RECENT_HISTORY_TURNS } from "../lib/visitor-access";

test("scopes history to bot, visitor and session", () => {
    assert.deepEqual(
        buildRecentHistoryQuery({ botId: "bot_1", visitorId: "vis_1", sessionId: "sess_1" }),
        {
            where: { botId: "bot_1", visitorId: "vis_1", sessionId: "sess_1" },
            orderBy: { createdAt: "desc" },
            take: RECENT_HISTORY_TURNS,
        }
    );
});

test("returns null instead of widening the filter when an identifier is missing", () => {
    assert.equal(buildRecentHistoryQuery({ botId: "bot_1", visitorId: "vis_1" }), null);
    assert.equal(buildRecentHistoryQuery({ botId: "bot_1", sessionId: "sess_1" }), null);
    assert.equal(buildRecentHistoryQuery({ botId: "bot_1", visitorId: null, sessionId: "" }), null);
    assert.equal(buildRecentHistoryQuery({ botId: "", visitorId: "vis_1", sessionId: "sess_1" }), null);
});
