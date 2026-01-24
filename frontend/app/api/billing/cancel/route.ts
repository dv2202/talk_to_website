import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import {
    cancelSubscriptionAtPeriodEnd,
    serializeSubscription,
} from "@/lib/billing";
import { getPlan, isPaidPlanId } from "@/lib/plans";
import { sendBillingEmail } from "@/lib/services/email";

export async function POST() {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        try {
            const { subscription, alreadyCancelled } =
                await cancelSubscriptionAtPeriodEnd(session.user.id);

            if (
                !alreadyCancelled &&
                session.user.email &&
                isPaidPlanId(subscription.planId)
            ) {
                const plan = getPlan(subscription.planId);
                try {
                    await sendBillingEmail({
                        email: session.user.email,
                        name: session.user.name,
                        type: "cancel",
                        planName: plan.name,
                        amountRupees: plan.amountRupees,
                        periodEnd: subscription.currentPeriodEnd,
                    });
                } catch (emailError) {
                    console.error("Billing cancel email failed:", emailError);
                }
            }

            return NextResponse.json({
                success: true,
                message:
                    "Subscription cancelled. You’ll keep paid access until the end of the current period.",
                subscription: serializeSubscription(subscription),
            });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Unable to cancel subscription";
            return NextResponse.json({ error: message }, { status: 400 });
        }
    } catch (error) {
        console.error("Cancel subscription error:", error);
        return NextResponse.json(
            { error: "Failed to cancel subscription" },
            { status: 500 }
        );
    }
}
