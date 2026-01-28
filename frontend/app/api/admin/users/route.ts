import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-utils";
import { ADMIN_EMAILS } from "@/lib/admin";
import { serializeSubscription } from "@/lib/billing";
import type { PlanId } from "@/lib/plans";

type SubscriptionRow = {
    id: string;
    planId: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
};

function effectivePlanId(subscription: SubscriptionRow | null): PlanId {
    if (!subscription) return "FREE";
    if (subscription.currentPeriodEnd <= new Date()) return "FREE";
    if (subscription.status !== "ACTIVE" && subscription.status !== "CANCELLED") {
        return "FREE";
    }
    const planId = subscription.planId as PlanId;
    return planId === "STARTER" || planId === "PRO" ? planId : "FREE";
}

export async function GET() {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const now = new Date();
        const since = new Date();
        since.setDate(since.getDate() - 30);

        // Expire stale paid periods in one write instead of per-user updates.
        await prisma.subscription.updateMany({
            where: {
                status: { in: ["ACTIVE", "CANCELLED"] },
                currentPeriodEnd: { lte: now },
            },
            data: { status: "EXPIRED" },
        });

        const [users, conversationGroups] = await Promise.all([
            prisma.user.findMany({
                where: {
                    email: { notIn: ADMIN_EMAILS },
                },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    emailVerified: true,
                    createdAt: true,
                    updatedAt: true,
                    subscription: true,
                    _count: {
                        select: {
                            bots: true,
                        },
                    },
                },
            }) as Promise<
                Array<{
                    id: string;
                    name: string;
                    email: string;
                    image: string | null;
                    emailVerified: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    subscription: SubscriptionRow | null;
                    _count: { bots: number };
                }>
            >,
            prisma.conversation.groupBy({
                by: ["botId"],
                where: {
                    createdAt: { gte: since },
                },
                _count: { _all: true },
            }) as Promise<Array<{ botId: string; _count: { _all: number } }>>,
        ]);

        const conversationBotIds = conversationGroups.map((row) => row.botId);
        const botOwners =
            conversationBotIds.length === 0
                ? []
                : ((await prisma.bot.findMany({
                      where: { id: { in: conversationBotIds } },
                      select: { id: true, userId: true },
                  })) as Array<{ id: string; userId: string }>);

        const botOwnerById = new Map(botOwners.map((bot) => [bot.id, bot.userId]));
        const conversationCountByUser = new Map<string, number>();

        for (const row of conversationGroups) {
            const userId = botOwnerById.get(row.botId);
            if (!userId) continue;
            conversationCountByUser.set(
                userId,
                (conversationCountByUser.get(userId) || 0) + row._count._all
            );
        }

        const enriched = users.map((user) => {
            const subscription = user.subscription;
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                botCount: user._count.bots,
                conversationCount: conversationCountByUser.get(user.id) || 0,
                planId: effectivePlanId(subscription),
                subscription: serializeSubscription(subscription),
            };
        });

        return NextResponse.json({ users: enriched });
    } catch (error) {
        console.error("Admin list users error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}
