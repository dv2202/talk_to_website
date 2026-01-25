export type PlanId = "FREE" | "STARTER" | "PRO";
export type PaidPlanId = "STARTER" | "PRO";

export type Plan = {
    id: PlanId;
    name: string;
    description: string;
    amountRupees: number;
    amountPaise: number;
    interval: "month";
    popular?: boolean;
    maxBots: number;
    maxConversations: number;
    showBranding: boolean;
    isPaid: boolean;
    features: string[];
};

export const PLANS: Plan[] = [
    {
        id: "FREE",
        name: "Free",
        description: "Try BotWebAI with a single assistant and light usage.",
        amountRupees: 0,
        amountPaise: 0,
        interval: "month",
        maxBots: 1,
        maxConversations: 100,
        showBranding: true,
        isPaid: false,
        features: [
            "1 AI assistant",
            "100 conversations monthly",
            "Chat mode",
            "BotWebAI branding",
        ],
    },
    {
        id: "STARTER",
        name: "Starter",
        description: "For solo founders launching their first AI assistant.",
        amountRupees: 999,
        amountPaise: 99900,
        interval: "month",
        maxBots: 1,
        maxConversations: 1000,
        showBranding: false,
        isPaid: true,
        features: [
            "1 AI assistant",
            "1,000 conversations / 30 days",
            "Chat mode",
            "No BotWebAI branding",
            "Email support",
        ],
    },
    {
        id: "PRO",
        name: "Pro",
        description: "For growing teams that need more assistants and higher usage.",
        amountRupees: 1999,
        amountPaise: 199900,
        interval: "month",
        popular: true,
        maxBots: 2,
        maxConversations: 2500,
        showBranding: false,
        isPaid: true,
        features: [
            "2 AI assistants",
            "2,500 conversations / 30 days",
            "Chat mode",
            "No BotWebAI branding",
            "Priority support",
        ],
    },
];

const PLAN_MAP = Object.fromEntries(PLANS.map((plan) => [plan.id, plan])) as Record<
    PlanId,
    Plan
>;

export function isPlanId(value: unknown): value is PlanId {
    return value === "FREE" || value === "STARTER" || value === "PRO";
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
    return value === "STARTER" || value === "PRO";
}

export function getPlan(planId: PlanId): Plan {
    return PLAN_MAP[planId];
}

export function formatPlanPrice(plan: Plan): string {
    if (!plan.isPaid) return "Free";
    return `₹${plan.amountRupees.toLocaleString("en-IN")}`;
}

export function addBillingPeriod(from: Date, months = 1): Date {
    const next = new Date(from);
    next.setMonth(next.getMonth() + months);
    return next;
}
