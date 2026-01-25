"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

type BillingPayment = {
    id: string;
    planId: string;
    planName: string;
    amount: number;
    amountRupees: number;
    currency: string;
    status: "PENDING" | "PAID" | "FAILED";
    razorpayOrderId: string | null;
    razorpaySubscriptionId: string | null;
    razorpayPaymentId: string | null;
    createdAt: string;
};

function statusBadgeClass(status: BillingPayment["status"]) {
    if (status === "PAID") {
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    }
    if (status === "FAILED") {
        return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    }
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function BillingHistoryModal() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payments, setPayments] = useState<BillingPayment[]>([]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await api.getBillingHistory();
                if (!cancelled) {
                    setPayments(data.payments || []);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load billing history"
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-black/10 bg-white/70 dark:border-white/15 dark:bg-white/5"
                >
                    <History className="h-4 w-4" />
                    Billing history
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-black/10 bg-[#f7f7f3] dark:border-white/10 dark:bg-[#121316]">
                <DialogHeader>
                    <DialogTitle>Billing history</DialogTitle>
                    <DialogDescription>
                        Payments and subscription renewals for your account.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto pr-1">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-black/60 dark:text-white/60">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading history...
                        </div>
                    )}

                    {!loading && error && (
                        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                            {error}
                        </p>
                    )}

                    {!loading && !error && payments.length === 0 && (
                        <p className="rounded-xl border border-black/10 bg-white/70 px-4 py-8 text-center text-sm text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
                            No billing history yet. Subscribe to a plan to get started.
                        </p>
                    )}

                    {!loading && !error && payments.length > 0 && (
                        <div className="space-y-3">
                            {payments.map((payment) => (
                                <div
                                    key={payment.id}
                                    className="rounded-xl border border-black/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="font-medium">{payment.planName}</p>
                                            <p className="mt-0.5 text-xs text-black/55 dark:text-white/55">
                                                {formatDate(payment.createdAt)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">
                                                ₹
                                                {payment.amountRupees.toLocaleString(
                                                    "en-IN"
                                                )}
                                            </p>
                                            <Badge
                                                variant="outline"
                                                className={`mt-1 ${statusBadgeClass(payment.status)}`}
                                            >
                                                {payment.status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="mt-3 space-y-1 text-xs text-black/50 dark:text-white/50">
                                        {payment.razorpaySubscriptionId && (
                                            <p className="truncate">
                                                Subscription:{" "}
                                                {payment.razorpaySubscriptionId}
                                            </p>
                                        )}
                                        {payment.razorpayOrderId && (
                                            <p className="truncate">
                                                Order: {payment.razorpayOrderId}
                                            </p>
                                        )}
                                        {payment.razorpayPaymentId && (
                                            <p className="truncate">
                                                Payment: {payment.razorpayPaymentId}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
