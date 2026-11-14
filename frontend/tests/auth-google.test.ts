import assert from "node:assert/strict";
import { test } from "node:test";
import { validateGoogleClaims } from "../lib/auth/google";

const clientId = "client-123.apps.googleusercontent.com";
const now = 1_700_000_000;
const base = {
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "1234567890",
    exp: now + 300,
    email: "User@Example.com",
    email_verified: true,
};

test("accepts valid claims", () => {
    assert.equal(validateGoogleClaims(base, clientId, now).sub, "1234567890");
});

test("rejects wrong issuer, audience, expiry and unverified email", () => {
    assert.throws(() => validateGoogleClaims({ ...base, iss: "https://evil.example" }, clientId, now));
    assert.throws(() => validateGoogleClaims({ ...base, aud: "other" }, clientId, now));
    assert.throws(() => validateGoogleClaims({ ...base, exp: now - 1 }, clientId, now));
    assert.throws(() => validateGoogleClaims({ ...base, email_verified: false }, clientId, now));
    assert.throws(() => validateGoogleClaims({ ...base, sub: "" }, clientId, now));
    assert.throws(() => validateGoogleClaims(null, clientId, now));
});
