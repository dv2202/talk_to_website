"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ArrowLeft,
    Clock3,
    Globe,
    Loader2,
    Mail,
    MessageSquare,
    MonitorSmartphone,
    User,
} from "lucide-react";

interface VisitorEntry {
    id: string;
    name: string;
    email: string | null;
    country: string | null;
    deviceType: string | null;
    platform: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    totalMessages: number;
    lastMessageAt: string;
    lastMessagePreview: string | null;
    isLegacy: boolean;
}

interface ConversationListResponse {
    bot: {
        id: string;
        name: string;
        botName: string;
        userId: string;
    };
    visitors: VisitorEntry[];
}

export default function AdminBotChatsPage({
    params,
}: {
    params: Promise<{ botId: string }>;
}) {
    const { botId } = use(params);
    const router = useRouter();
    const [data, setData] = useState<ConversationListResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                const response = await api.getAdminBotConversations(botId);
                setData(response);
            } catch (error) {
                console.error("Failed to fetch conversations:", error);
            } finally {
                setLoading(false);
            }
        };
        void fetchConversations();
    }, [botId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const visitors = data?.visitors || [];

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                        data?.bot.userId
                            ? router.push(`/admin/users/${data.bot.userId}`)
                            : router.back()
                    }
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {data?.bot.name || "Conversations"}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {visitors.length} visitor{visitors.length !== 1 && "s"} · @
                        {data?.bot.botName}
                    </p>
                </div>
            </div>

            {visitors.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="font-semibold text-lg">No visitors yet</h3>
                            <p className="text-sm text-muted-foreground">
                                Visitors will appear here after someone chats with this bot.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {visitors.map((visitor) => (
                        <Card
                            key={visitor.id}
                            className="cursor-pointer transition-shadow hover:shadow-md"
                            onClick={() =>
                                router.push(
                                    `/admin/bots/${botId}/chats/${encodeURIComponent(visitor.id)}`
                                )
                            }
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 min-w-0">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            <span className="truncate">{visitor.name}</span>
                                        </CardTitle>
                                        <div className="space-y-1 text-sm text-muted-foreground">
                                            <p className="truncate flex items-center gap-2">
                                                <Mail className="h-3.5 w-3.5" />
                                                {visitor.email || "No email provided"}
                                            </p>
                                            <p className="truncate flex items-center gap-2">
                                                <Globe className="h-3.5 w-3.5" />
                                                {visitor.country || "Country unavailable"}
                                            </p>
                                            <p className="truncate flex items-center gap-2">
                                                <MonitorSmartphone className="h-3.5 w-3.5" />
                                                {visitor.deviceType || "Unknown device"}
                                                {visitor.platform ? ` • ${visitor.platform}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                                        {visitor.totalMessages} chat
                                        {visitor.totalMessages !== 1 && "s"}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground min-h-20">
                                    {visitor.lastMessagePreview ||
                                        "No message preview available."}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    Last active{" "}
                                    {new Date(visitor.lastMessageAt).toLocaleString()}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
