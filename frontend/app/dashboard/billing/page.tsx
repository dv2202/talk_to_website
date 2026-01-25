"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { RazorpayCheckout } from "@/components/RazorpayCheckout";
import { BillingHistoryModal } from "@/components/BillingHistoryModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
    formatPlanPrice,
    type PaidPlanId,
    type Plan,
    type PlanId,
} from "@/lib/plans";

type SubscriptionInfo = {
    id: string;
    planId: PlanId;
    planName: string;
    status: "ACTIVE" | "CANCELLED" | "EXPIRED";
    cancelAtPeriodEnd?: boolean;
    accessUntil?: string | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    amountRupees: number;
};

type UsageInfo = {
    bots: number;
    conversations: number;
    windowDays: number;
    maxBots: number;
    maxConversations: number;
};

type EffectivePlanInfo = {
    id: PlanId;
    name: string;
    maxBots: number;
    maxConversations: number;
    showBranding: boolean;
    isPaid: boolean;
};

function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export default function BillingPage() {
    const { data: session } = useSession();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [effectivePlan, setEffectivePlan] = useState<EffectivePlanInfo | null>(
        null
    );
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const loadBilling = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getBilling();
            setPlans(data.plans || []);
            setSubscription(data.subscription || null);
            setEffectivePlan(data.effectivePlan || null);
            setUsage(data.usage || null);
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to load billing"
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadBilling();
    }, [loadBilling]);

    const isCurrentPlan = (planId: PlanId) => {
        if (planId === "FREE") {
            return effectivePlan?.id === "FREE";
        }
        return (
            !!subscription &&
            subscription.planId === planId &&
            (subscription.status === "ACTIVE" ||
                subscription.status === "CANCELLED")
        );
    };

    const handleCancel = async () => {
        setCancelling(true);
        setError(null);
        try {
            const result = await api.cancelSubscription();
            setShowCancelDialog(false);
            setSuccessMessage(
                result.message || "Subscription cancelled at period end."
            );
            await loadBilling();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to cancel plan"
            );
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                        Choose a plan, track usage, and manage your subscription.
                    </p>
                </div>
                <BillingHistoryModal />
            </div>

            {(subscription || effectivePlan || usage) && (
                <Card className="border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5">
                    <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-lg">Current plan</CardTitle>
                            <Badge
                                variant="outline"
                                className={
                                    subscription?.status === "ACTIVE"
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                        : subscription?.status === "CANCELLED"
                                          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                                          : "border-black/15 bg-black/5 text-black/70 dark:border-white/20 dark:bg-white/10 dark:text-white/70"
                                }
                            >
                                {subscription?.status === "CANCELLED"
                                    ? "CANCELLED"
                                    : subscription?.status === "ACTIVE"
                                      ? "ACTIVE"
                                      : effectivePlan?.name || "FREE"}
                            </Badge>
                        </div>
                        <CardDescription>
                            {effectivePlan?.name || "Free"}
                            {effectivePlan?.isPaid
                                ? ` · ₹${subscription?.amountRupees.toLocaleString("en-IN")}/month`
                                : " · ₹0"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-black/65 dark:text-white/65">
                        {subscription?.status === "ACTIVE" && (
                            <p>
                                Renews on {formatDate(subscription.currentPeriodEnd)}.
                                Paying again for the same plan extends your billing period.
                            </p>
                        )}
                        {subscription?.status === "CANCELLED" &&
                            subscription.accessUntil && (
                                <p>
                                    Cancelled. Paid access continues until{" "}
                                    {formatDate(subscription.accessUntil)}, then you’ll
                                    move to Free.
                                </p>
                            )}
                        {(!subscription || subscription.status === "EXPIRED") && (
                            <p>
                                You’re on the Free plan. Upgrade anytime for more
                                assistants and conversations.
                            </p>
                        )}

                        {usage && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-black/10 bg-[#f7f7f3] px-4 py-3 dark:border-white/10 dark:bg-black/20">
                                    <p className="text-xs text-black/55 dark:text-white/55">
                                        Assistants
                                    </p>
                                    <p className="mt-1 text-lg font-semibold">
                                        {usage.bots} / {usage.maxBots}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-black/10 bg-[#f7f7f3] px-4 py-3 dark:border-white/10 dark:bg-black/20">
                                    <p className="text-xs text-black/55 dark:text-white/55">
                                        Conversations (last {usage.windowDays} days)
                                    </p>
                                    <p className="mt-1 text-lg font-semibold">
                                        {usage.conversations.toLocaleString("en-IN")} /{" "}
                                        {usage.maxConversations.toLocaleString("en-IN")}
                                    </p>
                                </div>
                            </div>
                        )}

                        {subscription?.status === "ACTIVE" && (
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                disabled={cancelling}
                                onClick={() => setShowCancelDialog(true)}
                            >
                                Cancel plan
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            <Dialog
                open={showCancelDialog}
                onOpenChange={(open) => {
                    if (!cancelling) setShowCancelDialog(open);
                }}
            >
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950">
                    <DialogHeader>
                        <DialogTitle>Cancel your plan?</DialogTitle>
                        <DialogDescription>
                            You’ll keep paid access until the end of the current
                            billing period, then move to Free.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            disabled={cancelling}
                            onClick={() => setShowCancelDialog(false)}
                        >
                            Keep plan
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="rounded-xl"
                            disabled={cancelling}
                            onClick={() => void handleCancel()}
                        >
                            {cancelling ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Cancelling...
                                </>
                            ) : (
                                "Cancel plan"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {successMessage && (
                <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
                    {successMessage}
                </p>
            )}

            {error && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    {error}
                </p>
            )}

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-black/60 dark:text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading plans...
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-3">
                    {plans.map((plan) => {
                        const current = isCurrentPlan(plan.id);
                        return (
                            <Card
                                key={plan.id}
                                className={`relative border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/5 ${
                                    plan.popular
                                        ? "ring-2 ring-[#121212] dark:ring-white"
                                        : ""
                                }`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-4">
                                        <Badge className="bg-[#121212] text-white dark:bg-white dark:text-black">
                                            Most popular
                                        </Badge>
                                    </div>
                                )}
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between gap-2">
                                        <span>{plan.name}</span>
                                        {current && (
                                            <Badge
                                                variant="outline"
                                                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                            >
                                                Current
                                            </Badge>
                                        )}
                                    </CardTitle>
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div>
                                        <p className="text-3xl font-semibold tracking-tight">
                                            {formatPlanPrice(plan)}
                                        </p>
                                        <p className="text-sm text-black/55 dark:text-white/55">
                                            {plan.isPaid ? "per month" : "forever"}
                                        </p>
                                    </div>

                                    <ul className="space-y-2">
                                        {plan.features.map((feature) => (
                                            <li
                                                key={feature}
                                                className="flex items-start gap-2 text-sm text-black/70 dark:text-white/70"
                                            >
                                                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {plan.isPaid ? (
                                        <RazorpayCheckout
                                            planId={plan.id as PaidPlanId}
                                            description={`BotWebAI ${plan.name} plan`}
                                            label={
                                                current
                                                    ? `Renew ${formatPlanPrice(plan)}`
                                                    : `Subscribe ${formatPlanPrice(plan)}`
                                            }
                                            className="w-full rounded-xl"
                                            prefill={{
                                                name: session?.user?.name || undefined,
                                                email: session?.user?.email || undefined,
                                            }}
                                            onSuccess={async (result) => {
                                                setSuccessMessage(
                                                    result.message ||
                                                        `${plan.name} plan activated`
                                                );
                                                await loadBilling();
                                            }}
                                            onError={(message) => setError(message)}
                                        />
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full rounded-xl"
                                            disabled={current}
                                        >
                                            {current ? "Current plan" : "Included free"}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <p className="text-xs text-black/50 dark:text-white/50">
                Payments are monthly Razorpay mandates (auto-renew).
            </p>
        </div>
    );
}
