import { prisma } from "@/lib/prisma";
import { getPlan, type Plan, type PlanId } from "@/lib/plans";

const ROLLING_WINDOW_DAYS = 30;

export class EntitlementError extends Error {
    status: number;

    constructor(message: string, status = 403) {
        super(message);
        this.name = "EntitlementError";
        this.status = status;
    }
}

function hasPaidAccessRemaining(subscription: {
    status: string;
    currentPeriodEnd: Date;
} | null): boolean {
    if (!subscription) return false;
    if (subscription.currentPeriodEnd <= new Date()) return false;
    return (
        subscription.status === "ACTIVE" || subscription.status === "CANCELLED"
    );
}

export async function getSubscriptionRecord(userId: string) {
    const subscription = await prisma.subscription.findUnique({
        where: { userId },
    });

    if (
        subscription &&
        (subscription.status === "ACTIVE" ||
            subscription.status === "CANCELLED") &&
        subscription.currentPeriodEnd <= new Date()
    ) {
        return prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: "EXPIRED" },
        });
    }

    return subscription;
}

export async function getEffectivePlanId(userId: string): Promise<PlanId> {
    const subscription = await getSubscriptionRecord(userId);
    if (hasPaidAccessRemaining(subscription) && subscription) {
        const planId = subscription.planId as PlanId;
        if (planId === "STARTER" || planId === "PRO") {
            return planId;
        }
    }
    return "FREE";
}

export async function getEffectivePlan(userId: string): Promise<Plan> {
    return getPlan(await getEffectivePlanId(userId));
}

export async function getUsage(userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - ROLLING_WINDOW_DAYS);

    const [botCount, conversationCount] = await Promise.all([
        prisma.bot.count({ where: { userId } }),
        prisma.conversation.count({
            where: {
                createdAt: { gte: since },
                bot: { userId },
            },
        }),
    ]);

    return {
        botCount,
        conversationCount,
        windowDays: ROLLING_WINDOW_DAYS,
    };
}

export async function assertCanCreateBot(userId: string) {
    const plan = await getEffectivePlan(userId);
    const { botCount } = await getUsage(userId);

    if (botCount >= plan.maxBots) {
        throw new EntitlementError(
            `Your ${plan.name} plan allows ${plan.maxBots} assistant${plan.maxBots === 1 ? "" : "s"}. Upgrade to create more.`,
            403
        );
    }
}

export async function assertCanCreateConversation(userId: string) {
    const plan = await getEffectivePlan(userId);
    const { conversationCount } = await getUsage(userId);

    if (conversationCount >= plan.maxConversations) {
        throw new EntitlementError(
            `You've reached the ${plan.maxConversations.toLocaleString("en-IN")} conversation limit for your ${plan.name} plan in the last ${ROLLING_WINDOW_DAYS} days. Upgrade to continue.`,
            429
        );
    }
}

export async function getEntitlementsSummary(userId: string) {
    const [plan, usage, subscription] = await Promise.all([
        getEffectivePlan(userId),
        getUsage(userId),
        getSubscriptionRecord(userId),
    ]);

    return {
        plan,
        usage: {
            bots: usage.botCount,
            conversations: usage.conversationCount,
            windowDays: usage.windowDays,
            maxBots: plan.maxBots,
            maxConversations: plan.maxConversations,
        },
        showBranding: plan.showBranding,
        subscription,
    };
}
