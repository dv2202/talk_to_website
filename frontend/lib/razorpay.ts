import Razorpay from "razorpay";
import { getPlan, type PaidPlanId } from "@/lib/plans";

let razorpayClient: Razorpay | null = null;

/** Cache auto-created Razorpay plan IDs for the process lifetime. */
const planIdCache: Partial<Record<PaidPlanId, string>> = {};

/** ~10 years of monthly cycles; Razorpay requires a finite total_count. */
export const RAZORPAY_SUBSCRIPTION_TOTAL_COUNT = 120;

export function getRazorpayCredentials() {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    if (!keyId || !keySecret) {
        throw new Error("Razorpay credentials are not configured");
    }

    return { keyId, keySecret };
}

export function getRazorpayClient() {
    if (razorpayClient) return razorpayClient;

    const { keyId, keySecret } = getRazorpayCredentials();
    razorpayClient = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });

    return razorpayClient;
}

function envPlanId(planId: PaidPlanId): string | undefined {
    const value =
        planId === "STARTER"
            ? process.env.RAZORPAY_PLAN_STARTER
            : process.env.RAZORPAY_PLAN_PRO;
    const trimmed = value?.trim();
    return trimmed || undefined;
}

/**
 * Resolve a Razorpay monthly plan ID for STARTER/PRO.
 * Prefers env plan IDs; otherwise creates a plan via API and caches it.
 */
export async function getRazorpayPlanId(planId: PaidPlanId): Promise<string> {
    const fromEnv = envPlanId(planId);
    if (fromEnv) return fromEnv;

    if (planIdCache[planId]) return planIdCache[planId]!;

    const plan = getPlan(planId);
    const razorpay = getRazorpayClient();

    const created = await razorpay.plans.create({
        period: "monthly",
        interval: 1,
        item: {
            name: `BotWebAI ${plan.name}`,
            amount: plan.amountPaise,
            currency: "INR",
            description: `${plan.name} monthly subscription`,
        },
        notes: {
            appPlanId: planId,
        },
    });

    planIdCache[planId] = created.id;
    console.info(
        `[razorpay] Created monthly plan ${created.id} for ${planId}. ` +
            `Set RAZORPAY_PLAN_${planId}=${created.id} in .env to reuse it.`
    );

    return created.id;
}

export async function createRazorpaySubscription(params: {
    planId: PaidPlanId;
    userId: string;
    userEmail?: string | null;
}) {
    const { planId, userId, userEmail } = params;
    const razorpayPlanId = await getRazorpayPlanId(planId);
    const razorpay = getRazorpayClient();
    const plan = getPlan(planId);

    return razorpay.subscriptions.create({
        plan_id: razorpayPlanId,
        total_count: RAZORPAY_SUBSCRIPTION_TOTAL_COUNT,
        quantity: 1,
        customer_notify: true,
        notes: {
            userId,
            userEmail: userEmail || "",
            planId,
            planName: plan.name,
        },
    });
}

export async function cancelRazorpaySubscription(
    razorpaySubscriptionId: string,
    cancelAtCycleEnd = true
) {
    const razorpay = getRazorpayClient();
    // SDK typings accept boolean; true = cancel at end of current billing cycle.
    return razorpay.subscriptions.cancel(
        razorpaySubscriptionId,
        cancelAtCycleEnd
    );
}
