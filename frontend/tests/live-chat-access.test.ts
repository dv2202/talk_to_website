import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { issueVisitorAccessToken } from "../lib/visitor-access";
import { canControlLiveRoom, matchesRoomVisitor } from "../lib/live-chat-access";
import { authorizeLiveChatVisitor } from "../lib/live-chat-http";
import { NextRequest } from "next/server";
import type { Bot } from "@prisma/client";

const previousSecret = process.env.AUTH_SECRET;
before(() => { process.env.AUTH_SECRET = "test-secret-for-live-chat"; });
after(() => {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
});

const room = { id: "room-a", botId: "bot-a", visitorId: "visitor-a", bot: { userId: "owner-a" } };

test("a live room requires a token for its exact bot and visitor", () => {
    const valid = issueVisitorAccessToken("bot-a", "visitor-a");
    assert.equal(matchesRoomVisitor(room, valid), "visitor-a");
    assert.equal(matchesRoomVisitor(room, undefined), null);
    assert.equal(matchesRoomVisitor(room, issueVisitorAccessToken("bot-a", "visitor-b")), null);
    assert.equal(matchesRoomVisitor(room, issueVisitorAccessToken("bot-b", "visitor-a")), null);
    assert.equal(matchesRoomVisitor({ ...room, visitorId: null }, valid), null);
});

test("a visitor socket controls only its own joined room", () => {
    const visitor = { role: "visitor" as const, botId: "bot-a", visitorId: "visitor-a", roomId: "room-a" };
    assert.equal(canControlLiveRoom(visitor, room), true);
    assert.equal(canControlLiveRoom({ ...visitor, visitorId: "visitor-b" }, room), false);
    assert.equal(canControlLiveRoom({ ...visitor, roomId: "room-b" }, room), false);
    assert.equal(canControlLiveRoom(visitor, { ...room, botId: "bot-b" }), false);
    assert.equal(canControlLiveRoom({}, room), false);
});

test("an owner socket controls only rooms of its verified bot and account", () => {
    const owner = { role: "owner" as const, botId: "bot-a", userId: "owner-a" };
    assert.equal(canControlLiveRoom(owner, room), true);
    assert.equal(canControlLiveRoom({ ...owner, userId: "owner-b" }, room), false);
    assert.equal(canControlLiveRoom({ ...owner, botId: "bot-b" }, room), false);
});

test("REST room access rejects a public widget key without visitor proof", () => {
    const bot = {
        id: "bot-a",
        widgetApiKey: "public-widget-key",
        allowedOrigin: "https://client.example",
    } as Bot;
    const req = new NextRequest("https://api.example/api/live/rooms/room-a", {
        headers: { origin: "https://client.example", "x-widget-api-key": "public-widget-key" },
    });
    const denied = authorizeLiveChatVisitor(req, { bot, room, widgetApiKey: "public-widget-key" });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.response.status, 401);

    const allowed = authorizeLiveChatVisitor(req, {
        bot,
        room,
        accessToken: issueVisitorAccessToken("bot-a", "visitor-a"),
    });
    assert.equal(allowed.ok, true);
});
