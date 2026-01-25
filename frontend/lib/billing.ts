import { prisma } from "@/lib/prisma";
import {
    addBillingPeriod,
    getPlan,
    isPaidPlanId,
    type PaidPlanId,
    type PlanId,
} from "@/lib/plans";

export async function activateSubscriptionForPayment(params: {
    userId: string;
    planId: PaidPlanId;
    paymentId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string | null;
    razorpaySubscriptionId?: string | null;
}) {
    const {
        userId,
        planId,
        paymentId,
        razorpayPaymentId,
        razorpaySignature,
        razorpaySubscriptionId,
    } = params;
    const now = new Date();

    return prisma.$transaction(async (tx: typeof prisma) => {
        const existing = await tx.subscription.findUnique({
            where: { userId },
        });

        const shouldExtend =
            existing &&
            existing.status === "ACTIVE" &&
            existing.planId === planId &&
            existing.currentPeriodEnd > now;

        const periodStart = shouldExtend ? existing.currentPeriodStart : now;
        const periodEnd = addBillingPeriod(
            shouldExtend ? existing.currentPeriodEnd : now
        );

        const subscription = await tx.subscription.upsert({
            where: { userId },
            create: {
                userId,
                planId,
                status: "ACTIVE",
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                ...(razorpaySubscriptionId
                    ? { razorpaySubscriptionId }
                    : {}),
            },
            update: {
                planId,
                status: "ACTIVE",
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                ...(razorpaySubscriptionId
                    ? { razorpaySubscriptionId }
                    : {}),
            },
        });

        const payment = await tx.payment.update({
            where: { id: paymentId },
            data: {
                status: "PAID",
                razorpayPaymentId,
                razorpaySignature: razorpaySignature ?? undefined,
                razorpaySubscriptionId:
                    razorpaySubscriptionId ?? undefined,
                subscriptionId: subscription.id,
            },
        });

        return {
            subscription,
            payment,
            wasRenewal: Boolean(shouldExtend),
        };
    });
}

export async function recordSubscriptionRenewal(params: {
    userId: string;
    planId: PaidPlanId;
    amount: number;
    currency?: string;
    razorpaySubscriptionId: string;
    razorpayPaymentId: string;
}) {
    const {
        userId,
        planId,
        amount,
        currency = "INR",
        razorpaySubscriptionId,
        razorpayPaymentId,
    } = params;

    const existingPayment = await prisma.payment.findUnique({
        where: { razorpayPaymentId },
    });
    if (existingPayment) {
        const subscription = await prisma.subscription.findUnique({
            where: { userId },
        });
        return { subscription, payment: existingPayment, wasRenewal: true };
    }

    return prisma.$transaction(async (tx: typeof prisma) => {
        const existing = await tx.subscription.findUnique({
            where: { userId },
        });
        const now = new Date();
        const periodStart =
            existing && existing.currentPeriodEnd > now
                ? existing.currentPeriodEnd
                : now;
        const periodEnd = addBillingPeriod(periodStart);

        const subscription = await tx.subscription.upsert({
            where: { userId },
            create: {
                userId,
                planId,
                status: "ACTIVE",
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                razorpaySubscriptionId,
            },
            update: {
                planId,
                status: "ACTIVE",
                currentPeriodStart: existing?.currentPeriodStart ?? now,
                currentPeriodEnd: periodEnd,
                razorpaySubscriptionId,
            },
        });

        const payment = await tx.payment.create({
            data: {
                userId,
                planId,
                amount,
                currency,
                status: "PAID",
                razorpayOrderId: razorpayPaymentId,
                razorpaySubscriptionId,
                razorpayPaymentId,
                subscriptionId: subscription.id,
                receipt: `renew_${Date.now()}`.slice(0, 40),
            },
        });

        return { subscription, payment, wasRenewal: true };
    });
}

export function serializeSubscription(
    subscription: {
        id: string;
        planId: string;
        status: string;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
    } | null
) {
    if (!subscription) return null;

    const planId = subscription.planId as "FREE" | "STARTER" | "PRO";
    if (planId === "FREE") return null;

    const plan = getPlan(planId);
    const now = new Date();
    const periodRemaining = subscription.currentPeriodEnd > now;
    const cancelAtPeriodEnd =
        subscription.status === "CANCELLED" && periodRemaining;

    let status: "ACTIVE" | "CANCELLED" | "EXPIRED";
    if (cancelAtPeriodEnd) {
        status = "CANCELLED";
    } else if (subscription.status === "ACTIVE" && periodRemaining) {
        status = "ACTIVE";
    } else {
        status = "EXPIRED";
    }

    return {
        id: subscription.id,
        planId,
        planName: plan.name,
        status,
        cancelAtPeriodEnd,
        accessUntil: periodRemaining
            ? subscription.currentPeriodEnd.toISOString()
            : null,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        amountRupees: plan.amountRupees,
    };
}

export async function adminSetUserPlan(userId: string, planId: PlanId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error("User not found");
    }

    if (planId === "FREE") {
        await prisma.subscription.deleteMany({ where: { userId } });
        return { userId, planId: "FREE" as const, subscription: null };
    }

    if (!isPaidPlanId(planId)) {
        throw new Error("Invalid plan");
    }

    const now = new Date();
    const subscription = await prisma.subscription.upsert({
        where: { userId },
        create: {
            userId,
            planId,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: addBillingPeriod(now),
        },
        update: {
            planId,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: addBillingPeriod(now),
        },
    });

    return { userId, planId, subscription };
}

export async function cancelSubscriptionAtPeriodEnd(userId: string) {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
    });

    if (!subscription) {
        throw new Error("No subscription found");
    }

    if (subscription.currentPeriodEnd <= new Date()) {
        throw new Error("Subscription period has already ended");
    }

    if (subscription.status === "CANCELLED") {
        return { subscription, alreadyCancelled: true };
    }

    if (subscription.status !== "ACTIVE") {
        throw new Error("Only an active subscription can be cancelled");
    }

    if (subscription.razorpaySubscriptionId) {
        try {
            const { cancelRazorpaySubscription } = await import("@/lib/razorpay");
            await cancelRazorpaySubscription(
                subscription.razorpaySubscriptionId,
                true
            );
        } catch (error) {
            console.error("Razorpay subscription cancel failed:", error);
            throw new Error(
                "Could not cancel the Razorpay mandate. Try again or cancel from the Razorpay dashboard."
            );
        }
    }

    const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELLED" },
    });

    return { subscription: updated, alreadyCancelled: false };
}
