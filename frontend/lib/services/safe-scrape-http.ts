import { lookup } from "node:dns/promises";
import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";
import { Address4, Address6 } from "ip-address";

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

const NON_PUBLIC_IPV4 = [
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
    "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24",
    "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15",
    "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4",
].map((cidr) => new Address4(cidr));
const GLOBAL_IPV6 = new Address6("2000::/3");
const NON_PUBLIC_IPV6 = ["2001::/23", "3fff::/20"].map((cidr) => new Address6(cidr));

function plainHostname(hostname: string): string {
    return hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
}

/** Fail closed on special-use addresses. IPv6 tunneling and mapped IPv4 are excluded. */
export function isPublicIpAddress(address: string): boolean {
    try {
        if (isIP(address) === 4) {
            const ip = new Address4(address);
            return !NON_PUBLIC_IPV4.some((range) => ip.isInSubnet(range));
        }
        if (isIP(address) === 6) {
            const ip = new Address6(address);
            return ip.getType() === "Global unicast" && ip.isInSubnet(GLOBAL_IPV6) &&
                !NON_PUBLIC_IPV6.some((range) => ip.isInSubnet(range)) &&
                !ip.isMapped4() && !ip.is6to4();
        }
    } catch {
        // Invalid addresses are never allowed.
    }
    return false;
}

/** Synchronous URL policy; DNS is checked again for every actual connection. */
export function assertSafeScrapeUrl(input: string): URL {
    if (typeof input !== "string" || input.length > 2048) throw new Error("Invalid website URL");
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS websites are supported");
    if (url.username || url.password) throw new Error("Website URLs cannot contain credentials");
    if (url.port) throw new Error("Website URLs must use the standard HTTP or HTTPS port");

    const hostname = plainHostname(url.hostname).toLowerCase().replace(/\.$/, "");
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
        throw new Error("Local website addresses are not allowed");
    }
    if (isIP(hostname) && !isPublicIpAddress(hostname)) {
        throw new Error("Private or special-use website addresses are not allowed");
    }
    return url;
}

interface PageResponse {
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
}

type ResolvedAddress = { address: string; family: number };

export interface SafeScrapeDependencies {
    resolve(hostname: string): Promise<ResolvedAddress[]>;
    requestPage(url: URL, address: string, family: 4 | 6): Promise<PageResponse>;
}

async function resolveHostname(hostname: string): Promise<ResolvedAddress[]> {
    return lookup(hostname, { all: true });
}

function requestPageOverPinnedIp(url: URL, address: string, family: 4 | 6): Promise<PageResponse> {
    return new Promise((resolve, reject) => {
        const request = (url.protocol === "https:" ? https : http).request({
            protocol: url.protocol,
            hostname: plainHostname(url.hostname),
            port: url.protocol === "https:" ? 443 : 80,
            path: `${url.pathname}${url.search}`,
            method: "GET",
            agent: false,
            lookup: (_hostname, _options, callback) => callback(null, address, family),
            headers: {
                Host: url.host,
                "User-Agent": "TalkToWebsiteKnowledgeBot/1.0",
                Accept: "text/html,application/xhtml+xml",
                "Accept-Encoding": "identity",
            },
        }, (response) => {
            const statusCode = response.statusCode || 0;
            if (statusCode >= 300 && statusCode < 400) {
                response.destroy();
                resolve({ statusCode, headers: response.headers, body: "" });
                return;
            }
            if (statusCode !== 200) {
                response.destroy();
                reject(new Error(`Request failed with ${statusCode} status code`));
                return;
            }
            const contentType = String(response.headers["content-type"] || "").toLowerCase();
            if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
                response.destroy();
                reject(new Error("Website did not return HTML"));
                return;
            }
            if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
                response.destroy();
                reject(new Error("Compressed website responses are not supported"));
                return;
            }
            if (Number(response.headers["content-length"] || 0) > MAX_HTML_BYTES) {
                response.destroy();
                reject(new Error("Website page is too large"));
                return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            response.on("data", (chunk: Buffer) => {
                bytes += chunk.length;
                if (bytes > MAX_HTML_BYTES) {
                    response.destroy(new Error("Website page is too large"));
                    return;
                }
                chunks.push(chunk);
            });
            response.on("error", reject);
            response.on("end", () => resolve({ statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
        });
        request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("Website request timed out")));
        request.on("error", reject);
        request.end();
    });
}

const defaultDependencies: SafeScrapeDependencies = {
    resolve: resolveHostname,
    requestPage: requestPageOverPinnedIp,
};

/** Validate each redirect and pin the actual connection to a validated DNS answer. */
export async function fetchPublicHtml(input: string, dependencies: SafeScrapeDependencies = defaultDependencies): Promise<string> {
    let current = input;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        const url = assertSafeScrapeUrl(current);
        const hostname = plainHostname(url.hostname);
        const literalFamily = isIP(hostname);
        const answers: ResolvedAddress[] = literalFamily
            ? [{ address: hostname, family: literalFamily }]
            : await dependencies.resolve(hostname);
        if (answers.length === 0 || answers.some((answer) => !isPublicIpAddress(answer.address))) {
            throw new Error("Website resolves to a private or special-use address");
        }

        const answer = answers[0];
        const result = await dependencies.requestPage(url, answer.address, answer.family as 4 | 6);
        if (result.statusCode >= 300 && result.statusCode < 400) {
            const location = result.headers.location;
            if (typeof location !== "string" || !location) throw new Error("Website redirect has no destination");
            current = new URL(location, url).href;
            continue;
        }
        if (result.statusCode !== 200) throw new Error(`Request failed with ${result.statusCode} status code`);
        return result.body;
    }
    throw new Error("Website redirected too many times");
}
