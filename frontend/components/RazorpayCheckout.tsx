"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { PaidPlanId } from "@/lib/plans";

type RazorpayCheckoutProps = {
    planId: PaidPlanId;
    currency?: string;
    description?: string;
    label?: string;
    name?: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    onSuccess?: (result: {
        subscriptionId?: string;
        paymentId: string;
        planId?: PaidPlanId;
        planName?: string;
        currentPeriodEnd?: string;
        message: string;
    }) => void;
    onError?: (message: string) => void;
    onDismiss?: () => void;
    className?: string;
    disabled?: boolean;
};

type RazorpaySuccessResponse = {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
};

type RazorpayFailureResponse = {
    error: {
        code?: string;
        description?: string;
        reason?: string;
        source?: string;
        step?: string;
    };
};

type RazorpayOptions = {
    key: string;
    name: string;
    description?: string;
    subscription_id: string;
    prefill?: RazorpayCheckoutProps["prefill"];
    theme?: { color?: string };
    handler: (response: RazorpaySuccessResponse) => void;
    modal?: {
        ondismiss?: () => void;
    };
};

type RazorpayInstance = {
    open: () => void;
    on: (
        event: "payment.failed",
        callback: (response: RazorpayFailureResponse) => void
    ) => void;
};

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript() {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Razorpay can only load in the browser"));
    }

    if (window.Razorpay) {
        return Promise.resolve();
    }

    if (razorpayScriptPromise) {
        return razorpayScriptPromise;
    }

    razorpayScriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            razorpayScriptPromise = null;
            reject(new Error("Failed to load Razorpay checkout"));
        };
        document.body.appendChild(script);
    });

    return razorpayScriptPromise;
}

export function RazorpayCheckout({
    planId,
    description = "BotWebAI monthly subscription",
    label = "Subscribe",
    name = "BotWebAI",
    prefill,
    onSuccess,
    onError,
    onDismiss,
    className,
    disabled = false,
}: RazorpayCheckoutProps) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePay = async () => {
        setLoading(true);
        setError(null);
        setStatus(null);

        try {
            const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
            if (!key) {
                throw new Error("Razorpay key is not configured");
            }

            await loadRazorpayScript();

            if (!window.Razorpay) {
                throw new Error("Razorpay checkout is unavailable");
            }

            const order = await api.createOrder({ planId });

            if (!order?.subscription_id) {
                throw new Error("Failed to create monthly subscription");
            }

            const rzp = new window.Razorpay({
                key,
                name,
                description,
                subscription_id: order.subscription_id,
                prefill,
                theme: { color: "#121212" },
                handler: async (response) => {
                    try {
                        setStatus("Verifying subscription...");
                        const verified = await api.verifyPayment({
                            razorpay_subscription_id:
                                response.razorpay_subscription_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        setStatus(verified.message || "Subscription active");
                        onSuccess?.(verified);
                    } catch (verifyError: unknown) {
                        const message =
                            verifyError instanceof Error
                                ? verifyError.message
                                : "Payment verification failed";
                        setError(message);
                        onError?.(message);
                    } finally {
                        setLoading(false);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        setStatus(null);
                        setError("Payment cancelled");
                        onDismiss?.();
                    },
                },
            });

            rzp.on("payment.failed", (response) => {
                const message =
                    response?.error?.description ||
                    response?.error?.reason ||
                    "Payment failed";
                setLoading(false);
                setError(message);
                onError?.(message);
            });

            rzp.open();
        } catch (payError: unknown) {
            const message =
                payError instanceof Error ? payError.message : "Unable to start payment";
            setError(message);
            onError?.(message);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-2">
            <Button
                type="button"
                onClick={handlePay}
                disabled={loading || disabled}
                className={className}
            >
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    label
                )}
            </Button>
            {status && (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>
            )}
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
        </div>
    );
}
