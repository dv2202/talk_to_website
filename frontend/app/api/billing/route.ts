import { NextResponse } from "next/server";
import { getSession, unauthorizedResponse } from "@/lib/auth-utils";
import { serializeSubscription } from "@/lib/billing";
import { getEntitlementsSummary } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return unauthorizedResponse();

        const { plan, usage, showBranding, subscription } =
            await getEntitlementsSummary(session.user.id);

        return NextResponse.json({
            plans: PLANS,
            subscription: serializeSubscription(subscription),
            effectivePlan: {
                id: plan.id,
                name: plan.name,
                maxBots: plan.maxBots,
                maxConversations: plan.maxConversations,
                showBranding,
                isPaid: plan.isPaid,
            },
            usage,
        });
    } catch (error) {
        console.error("Billing status error:", error);
        return NextResponse.json(
            { error: "Failed to load billing status" },
            { status: 500 }
        );
    }
}
