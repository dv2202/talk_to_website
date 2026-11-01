import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { authenticateRazorpayWebhook } from "../lib/razorpay-webhook";

const body = JSON.stringify({ event: "subscription.charged" });
const secret = "webhook-test-secret";
const signature = createHmac("sha256", secret).update(body).digest("hex");

test("webhooks fail closed when the secret is missing or blank", () => {
    assert.equal(authenticateRazorpayWebhook(body, signature, undefined), "missing-secret");
    assert.equal(authenticateRazorpayWebhook(body, signature, "  "), "missing-secret");
});

test("webhooks reject missing, malformed, and incorrect signatures", () => {
    assert.equal(authenticateRazorpayWebhook(body, null, secret), "invalid-signature");
    assert.equal(authenticateRazorpayWebhook(body, "not-hex", secret), "invalid-signature");
    assert.equal(authenticateRazorpayWebhook(body, "0".repeat(64), secret), "invalid-signature");
    assert.equal(authenticateRazorpayWebhook(`${body} `, signature, secret), "invalid-signature");
});

test("webhooks accept a matching signature over the exact raw body", () => {
    assert.equal(authenticateRazorpayWebhook(body, signature, secret), "valid");
});
