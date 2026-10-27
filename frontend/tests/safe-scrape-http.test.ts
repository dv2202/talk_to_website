import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSafeScrapeUrl, fetchPublicHtml, isPublicIpAddress } from "../lib/services/safe-scrape-http";

test("rejects private, local, and special-use addresses, including IPv4-mapped IPv6", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "100.64.1.1", "192.168.1.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "64:ff9b::a9fe:a9fe", "2001:db8::1", "2002:c0a8:101::1", "3fff::1"]) {
        assert.equal(isPublicIpAddress(address), false, address);
    }
    assert.equal(isPublicIpAddress("8.8.8.8"), true);
    assert.equal(isPublicIpAddress("2001:4860:4860::8888"), true);
});

test("accepts only ordinary public web URLs", () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com/", "http://127.1/", "http://0177.0.0.1/", "http://0x7f000001/", "http://[::1]/", "http://[::ffff:169.254.169.254]/", "http://localhost/", "http://user:pass@example.com/", "https://example.com:8443/"]) {
        assert.throws(() => assertSafeScrapeUrl(url), { name: "Error" }, url);
    }
    assert.equal(assertSafeScrapeUrl("https://example.com/docs").hostname, "example.com");
});

test("redirects are checked before a second request, and connections use the checked IP", async () => {
    const calls: string[] = [];
    const deps = {
        resolve: async () => [{ address: "8.8.8.8", family: 4 }],
        requestPage: async (url: URL, address: string) => {
            calls.push(`${url.hostname}:${address}`);
            return { statusCode: 302, headers: { location: "http://169.254.169.254/latest/meta-data" }, body: "" };
        },
    };
    await assert.rejects(fetchPublicHtml("https://example.com/", deps));
    assert.deepEqual(calls, ["example.com:8.8.8.8"]);
});

test("rejects a hostname if any DNS answer is non-public", async () => {
    let requested = false;
    await assert.rejects(fetchPublicHtml("https://example.com/", {
        resolve: async () => [
            { address: "8.8.8.8", family: 4 },
            { address: "127.0.0.1", family: 4 },
        ],
        requestPage: async () => { requested = true; return { statusCode: 200, headers: {}, body: "" }; },
    }));
    assert.equal(requested, false);
});

test("each public redirect is resolved and pinned independently", async () => {
    const calls: string[] = [];
    const html = await fetchPublicHtml("https://first.example/", {
        resolve: async (hostname) => [{ address: hostname === "first.example" ? "8.8.8.8" : "1.1.1.1", family: 4 }],
        requestPage: async (url, address) => {
            calls.push(`${url.hostname}:${address}`);
            return url.hostname === "first.example"
                ? { statusCode: 301, headers: { location: "https://second.example/page" }, body: "" }
                : { statusCode: 200, headers: { "content-type": "text/html" }, body: "<html>OK</html>" };
        },
    });
    assert.equal(html, "<html>OK</html>");
    assert.deepEqual(calls, ["first.example:8.8.8.8", "second.example:1.1.1.1"]);
});
