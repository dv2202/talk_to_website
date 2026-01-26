"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ArrowLeft,
    Bot,
    Globe,
    Laptop,
    Link2,
    Loader2,
    Mail,
    MapPin,
    MonitorSmartphone,
    Shield,
    Sparkles,
    User,
} from "lucide-react";

interface ConversationEntry {
    id: string;
    userMessage: string;
    aiResponse: string;
    sessionId: string | null;
    createdAt: string;
}

interface VisitorDetails {
    id: string;
    name: string;
    email: string | null;
    country: string | null;
    deviceType: string | null;
    platform: string | null;
    timezone: string | null;
    language: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    skippedProfile: boolean;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    sessionId: string | null;
    totalMessages: number;
    isLegacy?: boolean;
}

interface ConversationDetailsResponse {
    bot?: { id: string; name: string; botName: string; userId: string };
    visitor: VisitorDetails;
    conversations: ConversationEntry[];
}

function DetailRow({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof User;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-muted p-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {label}
                    </p>
                    <p className="mt-1 text-sm font-medium break-all">{value}</p>
                </div>
            </div>
        </div>
    );
}

function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleString() : "Unavailable";
}

export default function AdminVisitorConversationPage({
    params,
}: {
    params: Promise<{ botId: string; visitorId: string }>;
}) {
    const { botId, visitorId } = use(params);
    const router = useRouter();
    const [data, setData] = useState<ConversationDetailsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const response = await api.getAdminBotConversationDetails(
                    botId,
                    visitorId
                );
                setData(response);
            } catch (error) {
                console.error("Failed to fetch visitor details:", error);
            } finally {
                setLoading(false);
            }
        };
        void fetchDetails();
    }, [botId, visitorId]);

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
                <p className="text-muted-foreground">Conversation not found</p>
            </div>
        );
    }

    const { visitor, conversations } = data;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/admin/bots/${botId}/chats`)}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{visitor.name}</h1>
                    <p className="text-muted-foreground text-sm">
                        {visitor.email || "No email provided"}
                        {data.bot ? ` · ${data.bot.name}` : ""}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[400px,1fr]">
                <div className="space-y-6">
                    <Card className="overflow-hidden border-border/60 shadow-sm">
                        <CardContent className="space-y-4 p-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-2xl border bg-muted/30 p-4">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        First seen
                                    </p>
                                    <p className="mt-2 text-sm font-semibold leading-relaxed">
                                        {formatDate(visitor.firstSeenAt)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border bg-muted/30 p-4">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Last active
                                    </p>
                                    <p className="mt-2 text-sm font-semibold leading-relaxed">
                                        {formatDate(visitor.lastSeenAt)}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border bg-muted/20 p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                    Visitor snapshot
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline" className="rounded-md px-2.5 py-1 text-xs">
                                        {visitor.country || "Country unavailable"}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-md px-2.5 py-1 text-xs">
                                        {visitor.deviceType || "Unknown device"}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-md px-2.5 py-1 text-xs">
                                        {visitor.platform || "Unknown platform"}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-border/60 shadow-sm">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <CardTitle className="text-base">Identity & Access</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <DetailRow
                                    icon={Mail}
                                    label="Email"
                                    value={visitor.email || "Not provided"}
                                />
                                <DetailRow
                                    icon={Shield}
                                    label="IP Address"
                                    value={visitor.ipAddress || "Unavailable"}
                                />
                                <DetailRow
                                    icon={Link2}
                                    label="Session ID"
                                    value={visitor.sessionId || "Unavailable"}
                                />
                                <DetailRow
                                    icon={User}
                                    label="User Agent"
                                    value={visitor.userAgent || "Unavailable"}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="overflow-hidden border-border/60 shadow-sm">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <CardTitle className="text-base">Device & Location</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <DetailRow
                                    icon={Globe}
                                    label="Country"
                                    value={visitor.country || "Unavailable"}
                                />
                                <DetailRow
                                    icon={MapPin}
                                    label="Timezone"
                                    value={visitor.timezone || "Unavailable"}
                                />
                                <DetailRow
                                    icon={MonitorSmartphone}
                                    label="Device"
                                    value={visitor.deviceType || "Unknown device"}
                                />
                                <DetailRow
                                    icon={Laptop}
                                    label="Platform"
                                    value={visitor.platform || "Unknown platform"}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-lg">Chat History</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {conversations.length} conversation
                                    {conversations.length !== 1 && "s"} with this visitor
                                </p>
                            </div>
                            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
                                {visitor.name}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5 p-6">
                        {conversations.map((convo) => (
                            <div
                                key={convo.id}
                                className="rounded-3xl border bg-background/70 p-5 shadow-sm"
                            >
                                <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
                                    <div>
                                        <p className="text-sm font-semibold">
                                            Conversation snapshot
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(convo.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                {visitor.name}
                                            </p>
                                            <div className="rounded-2xl rounded-tl-sm border bg-muted/25 px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                                                {convo.userMessage}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary">
                                            <Bot className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                AI Assistant
                                            </p>
                                            <div className="rounded-2xl rounded-tl-sm border border-primary/10 bg-primary/5 px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                                                {convo.aiResponse}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
