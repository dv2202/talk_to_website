import { NextRequest, NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { getPlan, isPaidPlanId } from "@/lib/plans";
import {
    createRazorpaySubscription,
    getRazorpayCredentials,
} from "@/lib/razorpay";

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        try {
            getRazorpayCredentials();
        } catch {
            return NextResponse.json(
                { error: "Payment provider is not configured" },
                { status: 500 }
            );
        }

        const body = await req.json().catch(() => null);
        const planId = body?.planId;

        if (!isPaidPlanId(planId)) {
            return NextResponse.json(
                { error: "Invalid plan. Choose STARTER or PRO." },
                { status: 400 }
            );
        }

        const plan = getPlan(planId);
        const currency = "INR";
        const receipt = `sub_${planId.toLowerCase()}_${Date.now()}`.slice(0, 40);

        const existing = await prisma.subscription.findUnique({
            where: { userId: session.user.id },
        });

        if (
            existing &&
            existing.planId === planId &&
            existing.status === "ACTIVE" &&
            existing.currentPeriodEnd > new Date() &&
            existing.razorpaySubscriptionId
        ) {
            return NextResponse.json(
                {
                    error:
                        "You already have an active monthly subscription for this plan. Cancel it first to change billing.",
                },
                { status: 400 }
            );
        }

        const subscription = await createRazorpaySubscription({
            planId,
            userId: session.user.id,
            userEmail: session.user.email,
        });

        await prisma.payment.create({
            data: {
                userId: session.user.id,
                planId,
                amount: plan.amountPaise,
                currency,
                status: "PENDING",
                // Unique checkout reference (subscriptions have no order_id).
                razorpayOrderId: subscription.id,
                razorpaySubscriptionId: subscription.id,
                receipt,
            },
        });

        return NextResponse.json({
            subscription_id: subscription.id,
            amount: plan.amountPaise,
            currency,
            planId,
            planName: plan.name,
        });
    } catch (error: unknown) {
        console.error("Create subscription error:", error);

        const statusCode =
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            typeof (error as { statusCode?: unknown }).statusCode === "number"
                ? (error as { statusCode: number }).statusCode
                : undefined;

        if (statusCode === 401) {
            return NextResponse.json(
                {
                    error:
                        "Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env (regenerate from Razorpay Dashboard → API Keys).",
                },
                { status: 401 }
            );
        }

        const message =
            typeof error === "object" &&
            error !== null &&
            "error" in error &&
            typeof (error as { error?: { description?: unknown } }).error
                ?.description === "string"
                ? (error as { error: { description: string } }).error.description
                : "Failed to create subscription";

        return NextResponse.json({ error: message }, { status: 500 });
    }
}
