import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, validatePassword, verifyPassword } from "../lib/auth/password";

// Better Auth stored `<hex salt>:<hex scrypt key>`; the hex salt string itself is the salt input.
const LEGACY_SALT = "0123456789abcdef0123456789abcdef";

test("hash round-trips and rejects wrong passwords", async () => {
    const hash = await hashPassword("correct horse battery");
    assert.match(hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(await verifyPassword("correct horse battery", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
});

test("verifies hashes in the legacy Better Auth format", async () => {
    // Re-derive with the documented legacy params to pin the format.
    const { scryptSync } = await import("node:crypto");
    const key = scryptSync("pässword".normalize("NFKC"), LEGACY_SALT, 64, {
        N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2,
    });
    const legacy = `${LEGACY_SALT}:${key.toString("hex")}`;
    assert.equal(await verifyPassword("pässword", legacy), true);
});

test("malformed hashes fail closed", async () => {
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", "salt-only"), false);
    assert.equal(await verifyPassword("x", "salt:not-hex"), false);
});

test("password policy", () => {
    assert.ok(validatePassword("short"));
    assert.ok(validatePassword("a".repeat(129)));
    assert.equal(validatePassword("longenough"), null);
});
