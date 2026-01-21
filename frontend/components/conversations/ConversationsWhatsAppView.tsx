"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
    ArrowLeft,
    Bot,
    CheckCheck,
    Globe,
    Info,
    Loader2,
    Mail,
    MessageSquare,
    MonitorSmartphone,
    MoreVertical,
    Search,
    User,
    X,
} from "lucide-react";

export interface VisitorEntry {
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

type FilterTab = "all" | "with-email" | "anonymous";

type ChatBubble = {
    id: string;
    role: "visitor" | "assistant";
    text: string;
    createdAt: string;
};

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "?";
}

function avatarHue(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
}

function formatListTime(value: string) {
    const date = new Date(value);
    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (sameDay) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (isYesterday) return "Yesterday";

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatBubbleTime(value: string) {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(value: string) {
    const date = new Date(value);
    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    if (sameDay) return "Today";

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();
    if (isYesterday) return "Yesterday";

    return date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}

function dayKey(value: string) {
    const d = new Date(value);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function VisitorAvatar({
    name,
    id,
    size = "md",
}: {
    name: string;
    id: string;
    size?: "sm" | "md" | "lg";
}) {
    const hue = avatarHue(id || name);
    const sizeClass =
        size === "lg" ? "h-11 w-11 text-sm" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-12 w-12 text-sm";

    return (
        <div
            className={cn(
                "grid shrink-0 place-items-center rounded-full font-semibold text-white",
                sizeClass
            )}
            style={{
                background: `linear-gradient(145deg, hsl(${hue} 42% 42%), hsl(${(hue + 28) % 360} 48% 32%))`,
            }}
        >
            {initials(name)}
        </div>
    );
}

export function ConversationsWhatsAppView({
    botId,
    botName,
    botHandle,
    visitors,
    selectedVisitorId,
    backHref = "/dashboard/conversations",
}: {
    botId: string;
    botName: string;
    botHandle?: string;
    visitors: VisitorEntry[];
    selectedVisitorId?: string;
    backHref?: string;
}) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterTab>("all");
    const [showInfo, setShowInfo] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [visitor, setVisitor] = useState<VisitorDetails | null>(null);
    const [conversations, setConversations] = useState<ConversationEntry[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const filteredVisitors = useMemo(() => {
        const q = search.trim().toLowerCase();
        return visitors.filter((v) => {
            if (filter === "with-email" && !v.email) return false;
            if (filter === "anonymous" && v.email) return false;
            if (!q) return true;
            return (
                v.name.toLowerCase().includes(q) ||
                (v.email?.toLowerCase().includes(q) ?? false) ||
                (v.lastMessagePreview?.toLowerCase().includes(q) ?? false) ||
                (v.country?.toLowerCase().includes(q) ?? false)
            );
        });
    }, [visitors, search, filter]);

    useEffect(() => {
        if (!selectedVisitorId) {
            setVisitor(null);
            setConversations([]);
            setShowInfo(false);
            return;
        }

        let cancelled = false;
        setDetailsLoading(true);

        void api
            .getAdminConversationDetails(botId, selectedVisitorId)
            .then((response: { visitor: VisitorDetails; conversations: ConversationEntry[] }) => {
                if (cancelled) return;
                setVisitor(response.visitor);
                setConversations(response.conversations);
            })
            .catch((error) => {
                console.error("Failed to fetch visitor details:", error);
                if (!cancelled) {
                    setVisitor(null);
                    setConversations([]);
                }
            })
            .finally(() => {
                if (!cancelled) setDetailsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [botId, selectedVisitorId]);

    const bubbles = useMemo<ChatBubble[]>(() => {
        const items: ChatBubble[] = [];
        for (const convo of conversations) {
            if (convo.userMessage?.trim()) {
                items.push({
                    id: `${convo.id}-user`,
                    role: "visitor",
                    text: convo.userMessage,
                    createdAt: convo.createdAt,
                });
            }
            if (convo.aiResponse?.trim()) {
                items.push({
                    id: `${convo.id}-ai`,
                    role: "assistant",
                    text: convo.aiResponse,
                    createdAt: convo.createdAt,
                });
            }
        }
        return items;
    }, [conversations]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [bubbles, selectedVisitorId]);

    const openVisitor = (visitorId: string) => {
        if (visitorId === selectedVisitorId) return;
        router.push(`/dashboard/conversations/${botId}/${encodeURIComponent(visitorId)}`, {
            scroll: false,
        });
    };

    const filters: { id: FilterTab; label: string }[] = [
        { id: "all", label: "All" },
        { id: "with-email", label: "Known" },
        { id: "anonymous", label: "Anonymous" },
    ];

    return (
        <div className="flex h-[calc(100dvh-4rem)] -mx-4 -my-4 overflow-hidden border-y border-border/60 bg-background sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8">
            {/* Sidebar — chat list */}
            <aside
                className={cn(
                    "flex w-full flex-col border-r border-border/70 bg-card sm:w-85 lg:w-95",
                    selectedVisitorId ? "hidden sm:flex" : "flex"
                )}
            >
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => router.push(backHref)}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Back"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="truncate font-display text-xl tracking-tight">Chats</h1>
                            <p className="truncate font-mono text-[11px] tracking-wide text-muted-foreground">
                                {botName}
                                {botHandle ? ` · @${botHandle}` : ""}
                            </p>
                        </div>
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                        <MessageSquare className="h-4 w-4" />
                    </div>
                </div>

                <div className="px-3 pb-2">
                    <div className="flex items-center gap-2 rounded-full bg-muted/80 px-3.5 py-2.5">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search"
                            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto px-3 pb-3">
                    {filters.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFilter(tab.id)}
                            className={cn(
                                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                                filter === tab.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {filteredVisitors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                            <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                                <MessageSquare className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium">No chats found</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {visitors.length === 0
                                        ? "Visitors will appear after someone opens the widget."
                                        : "Try a different search or filter."}
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredVisitors.map((entry) => {
                            const active = entry.id === selectedVisitorId;
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => openVisitor(entry.id)}
                                    className={cn(
                                        "flex w-full items-center gap-3 border-b border-border/40 px-3.5 py-3 text-left transition-colors",
                                        active
                                            ? "bg-secondary"
                                            : "hover:bg-muted/60"
                                    )}
                                >
                                    <VisitorAvatar name={entry.name} id={entry.id} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div className="flex min-w-0 items-baseline gap-1.5">
                                                <p className="truncate text-[15px] font-medium">{entry.name}</p>
                                                {entry.country && (
                                                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                        {entry.country}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="shrink-0 text-[11px] text-muted-foreground">
                                                {formatListTime(entry.lastMessageAt)}
                                            </span>
                                        </div>
                                        <div className="mt-0.5 flex items-center justify-between gap-2">
                                            <p className="truncate text-[13px] text-muted-foreground">
                                                {entry.lastMessagePreview || "No messages yet"}
                                            </p>
                                            {entry.totalMessages > 0 && (
                                                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                                                    {entry.totalMessages}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </aside>

            {/* Main chat pane */}
            <section
                className={cn(
                    "relative flex min-w-0 flex-1 flex-col",
                    selectedVisitorId ? "flex" : "hidden sm:flex"
                )}
            >
                {!selectedVisitorId ? (
                    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
                        <div className="pointer-events-none absolute inset-0 chat-wallpaper opacity-40" />
                        <div className="relative z-10 mx-auto max-w-sm px-6 text-center">
                            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                                <Bot className="h-7 w-7" />
                            </div>
                            <h2 className="font-display text-2xl tracking-tight">{botName}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Select a conversation from the left to view the full chat history —
                                WhatsApp-style, grounded in your assistant.
                            </p>
                        </div>
                    </div>
                ) : detailsLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : visitor ? (
                    <>
                        {/* Chat header */}
                        <header className="relative z-20 flex items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-3 py-2.5 backdrop-blur sm:px-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        router.push(`/dashboard/conversations/${botId}`, {
                                            scroll: false,
                                        })
                                    }
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted sm:hidden"
                                    aria-label="Back to chats"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                <VisitorAvatar name={visitor.name} id={visitor.id} size="sm" />
                                <button
                                    type="button"
                                    onClick={() => setShowInfo(true)}
                                    className="min-w-0 text-left"
                                >
                                    <p className="truncate text-[15px] font-semibold">{visitor.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {[visitor.country, visitor.email || visitor.deviceType]
                                            .filter(Boolean)
                                            .join(" · ") || "Visitor details"}
                                    </p>
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setShowInfo((v) => !v)}
                                    className={cn(
                                        "grid h-9 w-9 place-items-center rounded-full transition-colors",
                                        showInfo
                                            ? "bg-primary/15 text-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                    aria-label="Visitor info"
                                >
                                    <Info className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="More"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </button>
                            </div>
                        </header>

                        {/* Messages */}
                        <div className="relative min-h-0 flex-1 overflow-y-auto">
                            <div className="pointer-events-none absolute inset-0 chat-wallpaper" />
                            <div className="relative z-10 space-y-1 px-3 py-4 sm:px-8 lg:px-16">
                                {bubbles.length === 0 ? (
                                    <div className="flex justify-center py-16">
                                        <div className="rounded-full bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
                                            No messages in this conversation yet
                                        </div>
                                    </div>
                                ) : (
                                    bubbles.map((bubble, index) => {
                                        const key = dayKey(bubble.createdAt);
                                        const prevKey =
                                            index > 0 ? dayKey(bubbles[index - 1].createdAt) : null;
                                        const showDay = key !== prevKey;
                                        const isAssistant = bubble.role === "assistant";

                                        return (
                                            <div key={bubble.id}>
                                                {showDay && (
                                                    <div className="flex justify-center py-3">
                                                        <span className="rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                                                            {formatDayLabel(bubble.createdAt)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div
                                                    className={cn(
                                                        "mb-1 flex",
                                                        isAssistant ? "justify-end" : "justify-start"
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            "relative max-w-[85%] px-3 py-2 text-[14px] leading-relaxed shadow-sm sm:max-w-[70%]",
                                                            isAssistant
                                                                ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
                                                                : "rounded-2xl rounded-tl-sm border border-border/50 bg-card text-foreground"
                                                        )}
                                                    >
                                                        {!isAssistant && (
                                                            <p className="mb-1 text-[12px] font-semibold text-primary">
                                                                {visitor.name}
                                                            </p>
                                                        )}
                                                        <p className="whitespace-pre-wrap wrap-break-word">
                                                            {bubble.text}
                                                        </p>
                                                        <div
                                                            className={cn(
                                                                "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                                                isAssistant
                                                                    ? "text-primary-foreground/70"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            <span>{formatBubbleTime(bubble.createdAt)}</span>
                                                            {isAssistant && (
                                                                <CheckCheck className="h-3.5 w-3.5" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Read-only composer strip */}
                        <div className="relative z-20 border-t border-border/60 bg-card/95 px-3 py-3 backdrop-blur sm:px-4">
                            <div className="flex items-center gap-2 rounded-full bg-muted/70 px-4 py-2.5 text-sm text-muted-foreground">
                                <MessageSquare className="h-4 w-4 shrink-0" />
                                <span>Conversation history is read-only</span>
                            </div>
                        </div>

                        {/* Visitor info panel */}
                        {showInfo && (
                            <>
                                <button
                                    type="button"
                                    className="absolute inset-0 z-30 cursor-default bg-black/20"
                                    onClick={() => setShowInfo(false)}
                                    aria-label="Close contact info"
                                />
                                <aside className="absolute inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-border/70 bg-card shadow-xl animate-[fade-up_0.25s_ease_both]">
                                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                                        <p className="font-display text-lg tracking-tight">Contact info</p>
                                        <button
                                            type="button"
                                            onClick={() => setShowInfo(false)}
                                            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                                            aria-label="Close"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center gap-3 border-b border-border/50 px-6 py-8">
                                        <VisitorAvatar name={visitor.name} id={visitor.id} size="lg" />
                                        <div className="text-center">
                                            <p className="text-lg font-semibold">{visitor.name}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {visitor.email || "No email provided"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                                        <InfoRow
                                            icon={Mail}
                                            label="Email"
                                            value={visitor.email || "Not provided"}
                                        />
                                        <InfoRow
                                            icon={Globe}
                                            label="Country"
                                            value={visitor.country || "Unavailable"}
                                        />
                                        <InfoRow
                                            icon={MonitorSmartphone}
                                            label="Device"
                                            value={
                                                [visitor.deviceType, visitor.platform]
                                                    .filter(Boolean)
                                                    .join(" · ") || "Unknown"
                                            }
                                        />
                                        <InfoRow
                                            icon={User}
                                            label="Language"
                                            value={visitor.language || "Unavailable"}
                                        />
                                        <InfoRow
                                            icon={MessageSquare}
                                            label="Messages"
                                            value={String(visitor.totalMessages)}
                                        />
                                    </div>
                                </aside>
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                        Conversation not found
                    </div>
                )}
            </section>
        </div>
    );
}

function InfoRow({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof User;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-muted/50">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {label}
                </p>
                <p className="mt-0.5 break-all text-sm">{value}</p>
            </div>
        </div>
    );
}
