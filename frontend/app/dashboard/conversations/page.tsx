"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Bot } from "lucide-react";

interface BotEntry {
    id: string;
    name: string;
    botName: string;
    _count: {
        conversations: number;
        visitors: number;
    };
}

export default function ConversationsIndexPage() {
    const router = useRouter();
    const [bots, setBots] = useState<BotEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBots = async () => {
            try {
                const data = await api.getBots();
                setBots(data);
            } catch (error) {
                console.error("Failed to fetch bots:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBots();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-black/60 dark:text-white/60" />
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-38px_rgba(0,0,0,0.5)] dark:border-white/15 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
                    Dashboard
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">Conversations</h1>
                <p className="text-black/60 dark:text-white/65 mt-1">
                    View chat history across all your assistants
                </p>
            </div>

            {bots.length === 0 ? (
                <Card className="border-dashed border-black/20 bg-white/70 dark:border-white/20 dark:bg-white/5">
                    <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center">
                            <MessageSquare className="h-8 w-8" />
                        </div>
                        <p className="text-sm text-black/60 dark:text-white/65">
                            Create an assistant first to see conversations.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bots.map((bot) => (
                        <Card
                            key={bot.id}
                            className="cursor-pointer rounded-3xl border-black/10 bg-white/85 dark:border-white/15 dark:bg-white/5 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-28px_rgba(0,0,0,0.55)] transition-all"
                            onClick={() => router.push(`/dashboard/conversations/${bot.id}`)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">{bot.name}</CardTitle>
                                        <p className="text-xs text-black/55 dark:text-white/55 font-mono">
                                            @{bot.botName}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-1.5 text-black/60 dark:text-white/65">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    {bot._count.visitors} visitor
                                    {bot._count.visitors !== 1 && "s"}
                                    </div>
                                    <span className="text-xs font-semibold text-black/45 dark:text-white/45">Open</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
