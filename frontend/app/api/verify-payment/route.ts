import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { activateSubscriptionForPayment } from "@/lib/billing";
import { getPlan, isPaidPlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { sendBillingEmail } from "@/lib/services/email";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const body = await req.json().catch(() => null);
        const razorpay_subscription_id = body?.razorpay_subscription_id;
        const razorpay_payment_id = body?.razorpay_payment_id;
        const razorpay_signature = body?.razorpay_signature;

        if (
            typeof razorpay_subscription_id !== "string" ||
            typeof razorpay_payment_id !== "string" ||
            typeof razorpay_signature !== "string" ||
            !razorpay_subscription_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return NextResponse.json(
                { error: "Missing subscription verification fields" },
                { status: 400 }
            );
        }

        let keySecret: string;
        try {
            ({ keySecret } = getRazorpayCredentials());
        } catch {
            return NextResponse.json(
                { error: "Payment provider is not configured" },
                { status: 500 }
            );
        }

        // Subscription auth signature: payment_id|subscription_id
        const expectedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest("hex");

        const expected = Buffer.from(expectedSignature, "utf8");
        const received = Buffer.from(razorpay_signature, "utf8");

        if (
            expected.length !== received.length ||
            !crypto.timingSafeEqual(expected, received)
        ) {
            return NextResponse.json(
                { error: "Invalid payment signature", success: false },
                { status: 400 }
            );
        }

        const payment = await prisma.payment.findFirst({
            where: {
                razorpaySubscriptionId: razorpay_subscription_id,
                userId: session.user.id,
                status: "PENDING",
            },
            orderBy: { createdAt: "desc" },
        });

        if (!payment) {
            const alreadyPaid = await prisma.payment.findFirst({
                where: {
                    razorpaySubscriptionId: razorpay_subscription_id,
                    userId: session.user.id,
                    status: "PAID",
                    razorpayPaymentId: razorpay_payment_id,
                },
            });

            if (alreadyPaid && isPaidPlanId(alreadyPaid.planId)) {
                const subscription = await prisma.subscription.findUnique({
                    where: { userId: session.user.id },
                });
                const plan = getPlan(alreadyPaid.planId);

                return NextResponse.json({
                    success: true,
                    subscriptionId: razorpay_subscription_id,
                    paymentId: razorpay_payment_id,
                    planId: alreadyPaid.planId,
                    planName: plan.name,
                    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString(),
                    message: "Payment already verified",
                });
            }

            return NextResponse.json(
                { error: "Subscription payment not found" },
                { status: 404 }
            );
        }

        if (!isPaidPlanId(payment.planId)) {
            return NextResponse.json(
                { error: "Invalid payment plan" },
                { status: 400 }
            );
        }

        const { subscription, wasRenewal } = await activateSubscriptionForPayment({
            userId: session.user.id,
            planId: payment.planId,
            paymentId: payment.id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            razorpaySubscriptionId: razorpay_subscription_id,
        });

        const plan = getPlan(payment.planId);

        if (session.user.email) {
            try {
                await sendBillingEmail({
                    email: session.user.email,
                    name: session.user.name,
                    type: wasRenewal ? "renew" : "subscribe",
                    planName: plan.name,
                    amountRupees: plan.amountRupees,
                    periodEnd: subscription.currentPeriodEnd,
                });
            } catch (emailError) {
                console.error("Billing email failed:", emailError);
            }
        }

        return NextResponse.json({
            success: true,
            subscriptionId: razorpay_subscription_id,
            paymentId: razorpay_payment_id,
            planId: payment.planId,
            planName: plan.name,
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            message: wasRenewal
                ? `${plan.name} plan renewed successfully`
                : `${plan.name} monthly plan activated successfully`,
        });
    } catch (error) {
        console.error("Verify payment error:", error);
        return NextResponse.json(
            { error: "Failed to verify payment" },
            { status: 500 }
        );
    }
}
