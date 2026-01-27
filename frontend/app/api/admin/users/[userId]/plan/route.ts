import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-utils";
import { adminSetUserPlan, serializeSubscription } from "@/lib/billing";
import { isPlanId } from "@/lib/plans";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const { userId } = await params;
        const body = await req.json();
        const { planId } = body;

        if (!isPlanId(planId)) {
            return NextResponse.json(
                { error: "planId must be FREE, STARTER, or PRO" },
                { status: 400 }
            );
        }

        const result = await adminSetUserPlan(userId, planId);

        return NextResponse.json({
            userId: result.userId,
            planId: result.planId,
            subscription: serializeSubscription(result.subscription),
        });
    } catch (error) {
        console.error("Admin set plan error:", error);
        const message = error instanceof Error ? error.message : "Failed to update plan";
        const status = message === "User not found" ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
