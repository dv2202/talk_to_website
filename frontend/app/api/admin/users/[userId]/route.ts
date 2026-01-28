import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, forbiddenResponse } from "@/lib/auth-utils";
import { isAdminEmail } from "@/lib/admin";
import { getEffectivePlanId, getSubscriptionRecord, getUsage } from "@/lib/entitlements";
import { serializeSubscription } from "@/lib/billing";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const { userId } = await params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
                bots: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        name: true,
                        botName: true,
                        description: true,
                        mode: true,
                        themeColor: true,
                        createdAt: true,
                        updatedAt: true,
                        _count: {
                            select: {
                                conversations: true,
                                visitors: true,
                                knowledgeSources: true,
                            },
                        },
                    },
                },
                payments: {
                    orderBy: { createdAt: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        planId: true,
                        amount: true,
                        currency: true,
                        status: true,
                        createdAt: true,
                        razorpayPaymentId: true,
                    },
                },
            },
        });

        if (!user || isAdminEmail(user.email)) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const [planId, subscription, usage] = await Promise.all([
            getEffectivePlanId(user.id),
            getSubscriptionRecord(user.id),
            getUsage(user.id),
        ]);

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
            planId,
            subscription: serializeSubscription(subscription),
            usage,
            bots: user.bots.map((bot: (typeof user.bots)[number]) => ({
                id: bot.id,
                name: bot.name,
                botName: bot.botName,
                description: bot.description,
                mode: bot.mode,
                themeColor: bot.themeColor,
                createdAt: bot.createdAt,
                updatedAt: bot.updatedAt,
                conversationCount: bot._count.conversations,
                visitorCount: bot._count.visitors,
                knowledgeSourceCount: bot._count.knowledgeSources,
            })),
            payments: user.payments,
        });
    } catch (error) {
        console.error("Admin get user error:", error);
        return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const session = await requireAdmin();
        if (!session) return forbiddenResponse();

        const { userId } = await params;

        if (userId === session.user.id) {
            return NextResponse.json(
                { error: "You cannot delete your own admin account" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (isAdminEmail(user.email)) {
            return NextResponse.json(
                { error: "Admin accounts cannot be deleted" },
                { status: 400 }
            );
        }

        const email = user.email;

        // User delete cascades sessions, accounts, bots (+ knowledge/chats/visitors),
        // subscription, and payments via Prisma onDelete: Cascade.
        await prisma.$transaction([
            prisma.verification.deleteMany({
                where: { identifier: email },
            }),
            prisma.pendingSignup.deleteMany({
                where: { email },
            }),
            prisma.user.delete({
                where: { id: userId },
            }),
        ]);

        return NextResponse.json({
            success: true,
            deletedUserId: user.id,
            deletedEmail: email,
        });
    } catch (error) {
        console.error("Admin delete user error:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}
