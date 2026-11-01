import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookAuthentication = "valid" | "missing-secret" | "invalid-signature";

export function authenticateRazorpayWebhook(
    rawBody: string,
    signature: string | null,
    secret: string | undefined
): WebhookAuthentication {
    const key = secret?.trim();
    if (!key) return "missing-secret";
    if (!signature || !/^[a-f\d]{64}$/i.test(signature)) return "invalid-signature";

    const expected = createHmac("sha256", key).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    return timingSafeEqual(expected, received) ? "valid" : "invalid-signature";
}
