import { NextRequest, NextResponse } from "next/server";
import { recordSubscriptionRenewal } from "@/lib/billing";
import { isPaidPlanId, type PaidPlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { authenticateRazorpayWebhook } from "@/lib/razorpay-webhook";

export async function POST(req: NextRequest) {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const rawBody = await req.text();
        const signature = req.headers.get("x-razorpay-signature");
        const authentication = authenticateRazorpayWebhook(rawBody, signature, secret);

        if (authentication === "missing-secret") {
            console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
            return NextResponse.json(
                { error: "Webhook unavailable" },
                { status: 503 }
            );
        }

        if (authentication !== "valid") {
            return NextResponse.json(
                { error: "Invalid webhook signature" },
                { status: 400 }
            );
        }

        const event = JSON.parse(rawBody) as {
            event?: string;
            payload?: {
                subscription?: { entity?: Record<string, unknown> };
                payment?: { entity?: Record<string, unknown> };
            };
        };

        const eventName = event.event;
        const subscriptionEntity = event.payload?.subscription?.entity;
        const paymentEntity = event.payload?.payment?.entity;

        if (
            eventName === "subscription.charged" &&
            subscriptionEntity &&
            paymentEntity
        ) {
            const razorpaySubscriptionId = String(subscriptionEntity.id || "");
            const razorpayPaymentId = String(paymentEntity.id || "");
            const amount = Number(paymentEntity.amount || 0);
            const currency = String(paymentEntity.currency || "INR");
            const notes = (subscriptionEntity.notes || {}) as Record<
                string,
                string
            >;

            let userId = notes.userId;
            let planId = notes.planId as PaidPlanId | undefined;

            if (!userId || !isPaidPlanId(planId)) {
                const local = await prisma.subscription.findUnique({
                    where: { razorpaySubscriptionId },
                });
                if (local) {
                    userId = local.userId;
                    if (isPaidPlanId(local.planId)) {
                        planId = local.planId;
                    }
                }
            }

            if (
                userId &&
                isPaidPlanId(planId) &&
                razorpaySubscriptionId &&
                razorpayPaymentId
            ) {
                await recordSubscriptionRenewal({
                    userId,
                    planId,
                    amount,
                    currency,
                    razorpaySubscriptionId,
                    razorpayPaymentId,
                });
            }
        }

        if (
            (eventName === "subscription.cancelled" ||
                eventName === "subscription.completed") &&
            subscriptionEntity?.id
        ) {
            const razorpaySubscriptionId = String(subscriptionEntity.id);
            const local = await prisma.subscription.findUnique({
                where: { razorpaySubscriptionId },
            });

            if (local && local.status === "ACTIVE") {
                await prisma.subscription.update({
                    where: { id: local.id },
                    data: {
                        status:
                            eventName === "subscription.cancelled"
                                ? "CANCELLED"
                                : "EXPIRED",
                    },
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Razorpay webhook error:", error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}
