"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Plus,
    Copy,
    ExternalLink,
    Trash2,
    Pencil,
    MessageSquare,
    FileText,
    Bot,
    Loader2,
    Check,
    Globe,
} from "lucide-react";

interface BotData {
    id: string;
    name: string;
    botName: string;
    widgetApiKey: string;
    allowedOrigin: string | null;
    description: string | null;
    mode: string;
    widgetPosition: string;
    createdAt: string;
    _count: {
        knowledgeSources: number;
        conversations: number;
        visitors: number;
    };
}

export default function DashboardPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [bots, setBots] = useState<BotData[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [embedBot, setEmbedBot] = useState<BotData | null>(null);
    const [editingOrigin, setEditingOrigin] = useState(false);
    const [originInput, setOriginInput] = useState("");
    const [savingOrigin, setSavingOrigin] = useState(false);
    const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
    const [planLimit, setPlanLimit] = useState<{
        planName: string;
        maxBots: number;
    } | null>(null);

    const fetchBots = async () => {
        try {
            const [data, billing] = await Promise.all([
                api.getBots(),
                api.getBilling().catch(() => null),
            ]);
            setBots(data);
            if (billing?.effectivePlan && billing?.usage) {
                setPlanLimit({
                    planName: billing.effectivePlan.name,
                    maxBots: billing.usage.maxBots,
                });
            }
        } catch (error) {
            console.error("Failed to fetch bots:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchBots();
        }
    }, [session]);

    const atBotLimit =
        planLimit !== null && bots.length >= planLimit.maxBots;

    const handleCreateAssistant = () => {
        if (atBotLimit) {
            setShowUpgradeDialog(true);
            return;
        }
        router.push("/dashboard/create");
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await api.deleteBot(deleteId);
            setBots(bots.filter((b) => b.id !== deleteId));
            setDeleteId(null);
        } catch (error) {
            console.error("Failed to delete:", error);
        } finally {
            setDeleting(false);
        }
    };

    const getEmbedCode = (botName: string, widgetApiKey: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        return `<script src="${apiUrl}/api/widget/widget.js" data-bot="${botName}" data-api-key="${widgetApiKey}"></script>`;
    };

    const copyCodeFromDialog = () => {
        if (!embedBot) return;
        navigator.clipboard.writeText(getEmbedCode(embedBot.botName, embedBot.widgetApiKey));
        setCopiedId("embed-dialog");
        setTimeout(() => setCopiedId(null), 2000);
    };

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
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
                            Dashboard
                        </p>
                        <h1 className="text-3xl font-semibold tracking-tight">AI Assistants</h1>
                        <p className="text-black/60 dark:text-white/65 mt-1">
                            Manage your AI assistants and chatbots
                        </p>
                    </div>
                    <Button
                        className="gap-2 rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        id="create-assistant-btn"
                        onClick={handleCreateAssistant}
                    >
                        <Plus className="h-4 w-4" />
                        Create Assistant
                    </Button>
                </div>
            </div>

            {bots.length === 0 ? (
                <Card className="border-dashed border-black/20 bg-white/70 dark:border-white/20 dark:bg-white/5">
                    <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center">
                            <Bot className="h-8 w-8" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="font-semibold text-lg">No assistants yet</h3>
                            <p className="text-sm text-black/60 dark:text-white/65 max-w-sm">
                                Create your first AI assistant to start helping your customers
                                automatically.
                            </p>
                        </div>
                        <Button className="gap-2" onClick={handleCreateAssistant}>
                            <Plus className="h-4 w-4" />
                            Create your first assistant
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {bots.map((bot) => (
                        <Card key={bot.id} className="group rounded-3xl border-black/10 bg-white/85 dark:border-white/15 dark:bg-white/5 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-28px_rgba(0,0,0,0.55)] transition-all">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg">{bot.name}</CardTitle>
                                        <CardDescription className="font-mono text-xs text-black/55 dark:text-white/55">
                                            @{bot.botName}
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px] rounded-full border border-black/10 bg-black/5 text-black dark:border-white/15 dark:bg-white/10 dark:text-white">
                                        {bot.mode}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {bot.description && (
                                    <p className="text-sm text-black/60 dark:text-white/65 line-clamp-2">
                                        {bot.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-4 text-xs text-black/55 dark:text-white/55">
                                    <span className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        {bot._count.knowledgeSources} sources
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        {bot._count.visitors} users
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 text-xs rounded-full border-black/15 bg-white/80 dark:border-white/20 dark:bg-white/5"
                                        onClick={() => setEmbedBot(bot)}
                                        id={`show-embed-${bot.botName}`}
                                    >
                                        <Copy className="h-3 w-3" />
                                        Embed Code
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 text-xs rounded-full border-black/15 bg-white/80 dark:border-white/20 dark:bg-white/5"
                                        onClick={() => window.open(`/bot/${bot.botName}`, "_blank")}
                                        id={`open-link-${bot.botName}`}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Chat Link
                                    </Button>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                                    <Link href={`/dashboard/edit/${bot.id}`} className="flex-1">
                                        <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                                            <Pencil className="h-3 w-3" />
                                            Edit
                                        </Button>
                                    </Link>
                                    <Link href={`/dashboard/conversations/${bot.id}`} className="flex-1">
                                        <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                                            <MessageSquare className="h-3 w-3" />
                                            Chats
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive gap-1.5 text-xs rounded-full"
                                        onClick={() => setDeleteId(bot.id)}
                                        id={`delete-${bot.botName}`}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Plan limit upgrade dialog */}
            <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950">
                    <DialogHeader>
                        <DialogTitle>Assistant limit reached</DialogTitle>
                        <DialogDescription>
                            {planLimit
                                ? `Your ${planLimit.planName} plan allows ${planLimit.maxBots} assistant${planLimit.maxBots === 1 ? "" : "s"}. Upgrade to create more.`
                                : "You've reached your plan's assistant limit. Upgrade to create more."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                            Not now
                        </Button>
                        <Button
                            className="rounded-full bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                            onClick={() => router.push("/dashboard/billing")}
                        >
                            Upgrade plan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation dialog */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950">
                    <DialogHeader>
                        <DialogTitle>Delete Assistant</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this assistant? This action cannot
                            be undone. All conversations and knowledge sources will be permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Embed Code Dialog */}
            <Dialog open={!!embedBot} onOpenChange={(open) => {
                if (!open) {
                    setEmbedBot(null);
                    setEditingOrigin(false);
                }
            }}>
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950">
                    <DialogHeader>
                        <DialogTitle>Embed Code</DialogTitle>
                        <DialogDescription>
                            Copy the code below and paste it into your website's HTML to display the chat widget.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 mt-2">
                        <div className="relative">
                            <pre className="p-4 pr-12 bg-black/[0.04] dark:bg-white/[0.07] rounded-md overflow-x-auto text-sm text-black/70 dark:text-white/75 whitespace-pre-wrap break-all">
                                <code>{embedBot && getEmbedCode(embedBot.botName, embedBot.widgetApiKey)}</code>
                            </pre>
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8"
                                onClick={copyCodeFromDialog}
                            >
                                {copiedId === "embed-dialog" ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5" />
                                Allowed Website Origin
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="https://example.com"
                                    value={editingOrigin ? originInput : (embedBot?.allowedOrigin || "")}
                                    onChange={(e) => {
                                        setEditingOrigin(true);
                                        setOriginInput(e.target.value);
                                    }}
                                    disabled={savingOrigin}
                                    className="flex-1"
                                />
                                {editingOrigin && (
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            if (!embedBot) return;
                                            setSavingOrigin(true);
                                            try {
                                                await api.updateBot(embedBot.id, {
                                                    allowedOrigin: originInput || null,
                                                });
                                                const updatedBots = bots.map((b) =>
                                                    b.id === embedBot.id
                                                        ? { ...b, allowedOrigin: originInput || null }
                                                        : b
                                                );
                                                setBots(updatedBots);
                                                setEmbedBot({ ...embedBot, allowedOrigin: originInput || null });
                                            } catch (error) {
                                                console.error("Failed to save origin:", error);
                                            } finally {
                                                setSavingOrigin(false);
                                                setEditingOrigin(false);
                                            }
                                        }}
                                        disabled={savingOrigin}
                                        className="gap-1.5 rounded-full"
                                    >
                                        {savingOrigin ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Check className="h-3.5 w-3.5" />
                                        )}
                                        Save
                                    </Button>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Restrict this widget to only work on specific domains. Leave empty to allow any website.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setEmbedBot(null); setEditingOrigin(false); }}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
