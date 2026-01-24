import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { getPlan, isPlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const payments = await prisma.payment.findMany({
            where: { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return NextResponse.json({
            payments: payments.map((payment: {
                id: string;
                planId: string;
                amount: number;
                currency: string;
                status: string;
                razorpayOrderId: string | null;
                razorpaySubscriptionId: string | null;
                razorpayPaymentId: string | null;
                createdAt: Date;
            }) => {
                const planId = isPlanId(payment.planId) ? payment.planId : "FREE";
                const plan = getPlan(planId);
                return {
                    id: payment.id,
                    planId,
                    planName: plan.name,
                    amount: payment.amount,
                    amountRupees: payment.amount / 100,
                    currency: payment.currency,
                    status: payment.status,
                    razorpayOrderId: payment.razorpayOrderId,
                    razorpaySubscriptionId: payment.razorpaySubscriptionId,
                    razorpayPaymentId: payment.razorpayPaymentId,
                    createdAt: payment.createdAt.toISOString(),
                };
            }),
        });
    } catch (error) {
        console.error("Billing history error:", error);
        return NextResponse.json(
            { error: "Failed to load billing history" },
            { status: 500 }
        );
    }
}
