"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft,
    Bot,
    Loader2,
    MessageSquare,
    Pencil,
    Save,
} from "lucide-react";

type PlanId = "FREE" | "STARTER" | "PRO";

type AdminUserDetail = {
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
        emailVerified: boolean;
        createdAt: string;
        updatedAt: string;
    };
    planId: PlanId;
    subscription: {
        planId: string;
        status: string;
        currentPeriodEnd: string;
    } | null;
    usage: {
        botCount: number;
        conversationCount: number;
        windowDays: number;
    };
    bots: {
        id: string;
        name: string;
        botName: string;
        description: string | null;
        mode: string;
        themeColor: string | null;
        createdAt: string;
        conversationCount: number;
        visitorCount: number;
        knowledgeSourceCount: number;
    }[];
    payments: {
        id: string;
        planId: string;
        amount: number;
        currency: string;
        status: string;
        createdAt: string;
    }[];
};

export default function AdminUserDetailPage({
    params,
}: {
    params: Promise<{ userId: string }>;
}) {
    const { userId } = use(params);
    const router = useRouter();
    const [data, setData] = useState<AdminUserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<PlanId>("FREE");
    const [savingPlan, setSavingPlan] = useState(false);
    const [planMessage, setPlanMessage] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await api.getAdminUser(userId);
                setData(response);
                setSelectedPlan(response.planId);
            } catch (error) {
                console.error("Failed to load user:", error);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [userId]);

    const handleSavePlan = async () => {
        if (!data) return;
        setSavingPlan(true);
        setPlanMessage(null);
        try {
            const result = await api.setAdminUserPlan(userId, selectedPlan);
            setData({
                ...data,
                planId: result.planId,
                subscription: result.subscription,
            });
            setPlanMessage(`Plan updated to ${result.planId}`);
        } catch (error) {
            console.error("Failed to update plan:", error);
            setPlanMessage(
                error instanceof Error ? error.message : "Failed to update plan"
            );
        } finally {
            setSavingPlan(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">User not found</p>
            </div>
        );
    }

    const { user, bots, payments, usage, planId, subscription } = data;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight truncate">{user.name}</h1>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Current plan</CardDescription>
                        <CardTitle className="text-xl">{planId}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        {subscription
                            ? `${subscription.status} · ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                            : "No paid subscription"}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Assistants</CardDescription>
                        <CardTitle className="text-xl">{usage.botCount}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Total bots owned by this user
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Conversations (30d)</CardDescription>
                        <CardTitle className="text-xl">{usage.conversationCount}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Rolling {usage.windowDays}-day window
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Billing</CardTitle>
                    <CardDescription>Manually set this user&apos;s plan without Razorpay</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium">Plan</label>
                        <Select
                            value={selectedPlan}
                            onValueChange={(value) => setSelectedPlan(value as PlanId)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FREE">FREE</SelectItem>
                                <SelectItem value="STARTER">STARTER</SelectItem>
                                <SelectItem value="PRO">PRO</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        className="gap-2"
                        onClick={handleSavePlan}
                        disabled={savingPlan || selectedPlan === planId}
                    >
                        {savingPlan ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save plan
                    </Button>
                </CardContent>
                {planMessage && (
                    <CardContent className="pt-0 text-sm text-muted-foreground">
                        {planMessage}
                    </CardContent>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">User ID</p>
                        <p className="font-mono break-all">{user.id}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">Email verified</p>
                        <p>{user.emailVerified ? "Yes" : "No"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">Joined</p>
                        <p>{new Date(user.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider">Updated</p>
                        <p>{new Date(user.updatedAt).toLocaleString()}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h2 className="text-lg font-semibold">Bots</h2>
                {bots.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            This user has no assistants yet.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {bots.map((bot) => (
                            <Card key={bot.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 space-y-1">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Bot className="h-4 w-4 shrink-0" />
                                                <span className="truncate">{bot.name}</span>
                                            </CardTitle>
                                            <CardDescription className="truncate">
                                                @{bot.botName} · {bot.mode}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline">
                                            {bot.conversationCount} chats
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-10">
                                        {bot.description || "No description"}
                                    </p>
                                    <div className="text-xs text-muted-foreground">
                                        {bot.visitorCount} visitors · {bot.knowledgeSourceCount} knowledge sources
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2"
                                            onClick={() =>
                                                router.push(`/admin/bots/${bot.id}/chats`)
                                            }
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            Chats
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="gap-2"
                                            onClick={() =>
                                                router.push(`/dashboard/edit/${bot.id}`)
                                            }
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {payments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recent payments</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {payments.map((payment) => (
                            <div
                                key={payment.id}
                                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                            >
                                <div>
                                    <p className="font-medium">{payment.planId}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(payment.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p>
                                        ₹{(payment.amount / 100).toLocaleString("en-IN")}
                                    </p>
                                    <Badge variant="outline">{payment.status}</Badge>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
