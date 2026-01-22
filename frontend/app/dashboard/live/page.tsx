"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { LiveChatRoomDto, LiveChatMessageDto } from "@/lib/live-chat-shared";
import { VISITOR_SWITCHED_TO_AI_MESSAGE } from "@/lib/live-chat-shared";
import { setLiveOwnerSelectedRoom } from "@/lib/live-owner-selection";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Headset, User, Sparkles, Check, RefreshCw, MessageSquare, AlertCircle } from "lucide-react";

type Filter = "WAITING" | "ACTIVE" | "CLOSED" | "ALL";

const POLL_MS = 3000;
const WS_RECONNECT_MIN_MS = 2000;
const WS_RECONNECT_MAX_MS = 30000;

interface OwnerTokenEntry {
    botId: string;
    botName: string;
    name: string;
    humanChatEnabled: boolean;
    token: string;
}

export default function LiveChatDashboardPage() {
    const [rooms, setRooms] = useState<LiveChatRoomDto[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activeRoom, setActiveRoom] = useState<LiveChatRoomDto | null>(null);
    const [messages, setMessages] = useState<LiveChatMessageDto[]>([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [filter, setFilterState] = useState<Filter>("WAITING");
    const [loading, setLoading] = useState(true);
    const [visitorTyping, setVisitorTyping] = useState(false);
    const [ownerTokensVersion, setOwnerTokensVersion] = useState(0);
    const [wsConnected, setWsConnected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const wsSocketsRef = useRef<WebSocket[]>([]);
    const tokensRef = useRef<Record<string, string>>({});
    const seenIdsRef = useRef<Record<string, boolean>>({});
    const activeRoomRef = useRef<LiveChatRoomDto | null>(null);
    const roomsRef = useRef<LiveChatRoomDto[]>([]);
    const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const selectedIdRef = useRef<string | null>(null);
    const filterRef = useRef<Filter>("WAITING");
    const wsConnectedRef = useRef(false);

    const setFilter = useCallback((f: Filter) => {
        filterRef.current = f;
        setFilterState(f);
    }, []);
    const ownerTypingActiveRef = useRef(false);
    const ownerTypingIdleRef = useRef<number | null>(null);
    const LIVE_TYPING_IDLE_MS = 1800;
    const pollInFlightRef = useRef(false);

    const clearOwnerTypingTimer = useCallback(() => {
        if (ownerTypingIdleRef.current) {
            window.clearTimeout(ownerTypingIdleRef.current);
            ownerTypingIdleRef.current = null;
        }
    }, []);

    const emitOwnerTyping = useCallback((isTyping: boolean) => {
        const roomId = selectedIdRef.current;
        const room = activeRoomRef.current;
        if (!roomId || room?.status !== "ACTIVE") return;
        if (ownerTypingActiveRef.current === isTyping) return;
        ownerTypingActiveRef.current = isTyping;

        let sent = false;
        for (const ws of wsSocketsRef.current) {
            if (ws.readyState === 1) {
                try {
                    ws.send(JSON.stringify({ type: "typing", roomId, isTyping }));
                    sent = true;
                } catch {
                    /* ignore */
                }
            }
        }
        if (!sent && wsRef.current && wsRef.current.readyState === 1) {
            try {
                wsRef.current.send(JSON.stringify({ type: "typing", roomId, isTyping }));
                sent = true;
            } catch {
                /* ignore */
            }
        }
        if (!sent) {
            void api.sendLiveTyping(roomId, { isTyping }).catch(() => {});
        }
    }, []);

    const notifyOwnerTypingActivity = useCallback(() => {
        const room = activeRoomRef.current;
        if (room?.status !== "ACTIVE") return;
        emitOwnerTyping(true);
        clearOwnerTypingTimer();
        ownerTypingIdleRef.current = window.setTimeout(() => {
            emitOwnerTyping(false);
        }, LIVE_TYPING_IDLE_MS);
    }, [clearOwnerTypingTimer, emitOwnerTyping]);

    const clearSelection = useCallback(() => {
        selectedIdRef.current = null;
        setSelectedId(null);
        setLiveOwnerSelectedRoom(null);
        activeRoomRef.current = null;
        setActiveRoom(null);
        setMessages([]);
        setVisitorTyping(false);
        clearOwnerTypingTimer();
        ownerTypingActiveRef.current = false;
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has("room")) {
                url.searchParams.delete("room");
                window.history.replaceState({}, "", `${url.pathname}${url.search}`);
            }
        } catch {
            /* ignore */
        }
    }, [clearOwnerTypingTimer]);

    const updateRooms = useCallback((next: LiveChatRoomDto[]) => {
        roomsRef.current = next;
        setRooms(next);
        const selected = selectedIdRef.current;
        const f = filterRef.current;
        // Drop selection when the room left the current filter (e.g. WAITING → EXPIRED)
        // so we stop join-room / per-room polling against a dead room.
        if (selected && (f === "WAITING" || f === "ACTIVE") && !next.some((r) => r.id === selected)) {
            selectedIdRef.current = null;
            setSelectedId(null);
            setLiveOwnerSelectedRoom(null);
            activeRoomRef.current = null;
            setActiveRoom(null);
            setMessages([]);
            setVisitorTyping(false);
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has("room")) {
                    url.searchParams.delete("room");
                    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
                }
            } catch {
                /* ignore */
            }
        }
    }, []);

    const playNotify = useCallback(() => {
        try {
            const audio = new Audio("/bot.mp3");
            audio.volume = 0.5;
            const p = audio.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
        } catch {
            /* ignore */
        }
    }, []);

    const refreshRooms = useCallback(async (f: Filter) => {
        try {
            const data = (await api.listLiveRooms({ status: f })) as LiveChatRoomDto[];
            updateRooms(Array.isArray(data) ? data : []);
        } catch {
            /* keep stale list */
        }
    }, [updateRooms]);

    const joinSelectedRoom = useCallback((roomId: string) => {
        if (wsSocketsRef.current.length) {
            for (const ws of wsSocketsRef.current) {
                if (ws.readyState === 1) {
                    try {
                        ws.send(JSON.stringify({ type: "join-room", roomId }));
                    } catch {
                        /* ignore */
                    }
                }
            }
        } else if (wsRef.current && wsRef.current.readyState === 1) {
            try {
                wsRef.current.send(JSON.stringify({ type: "join-room", roomId }));
            } catch {
                /* ignore */
            }
        }
    }, []);

    const openRoom = useCallback(async (roomId: string, _opts?: { silent?: boolean }) => {
        const previousId = selectedIdRef.current;
        const switching = previousId !== roomId;
        if (switching && previousId && activeRoomRef.current?.status === "ACTIVE") {
            clearOwnerTypingTimer();
            // Emit stop for the room we're leaving (before selectedId changes).
            if (ownerTypingActiveRef.current) {
                ownerTypingActiveRef.current = false;
                let sent = false;
                for (const ws of wsSocketsRef.current) {
                    if (ws.readyState === 1) {
                        try {
                            ws.send(JSON.stringify({ type: "typing", roomId: previousId, isTyping: false }));
                            sent = true;
                        } catch {
                            /* ignore */
                        }
                    }
                }
                if (!sent) {
                    void api.sendLiveTyping(previousId, { isTyping: false }).catch(() => {});
                }
            }
        }
        selectedIdRef.current = roomId;
        setSelectedId(roomId);
        setLiveOwnerSelectedRoom(roomId);
        if (switching) {
            setMessages([]);
            setVisitorTyping(false);
        }
        try {
            const data = (await api.getLiveRoom(roomId)) as { room: LiveChatRoomDto; messages: LiveChatMessageDto[] };
            // Drop stale responses if the user already switched rooms.
            if (selectedIdRef.current !== roomId) return;
            activeRoomRef.current = data.room;
            setActiveRoom(data.room);
            if (Array.isArray(data.messages)) {
                const msgs = data.messages;
                // Mark history as seen — opening/joining a room must never beep.
                // Notify only for messages that arrive later via poll / WebSocket.
                msgs.forEach((m) => {
                    seenIdsRef.current[m.id] = true;
                });
                setMessages(msgs);
            }
            // Only subscribe over WS for live rooms. Joining EXPIRED/CLOSED always
            // echoes `expired`/`closed`, and re-opening on that event caused an infinite loop.
            if (data.room.status === "WAITING" || data.room.status === "ACTIVE") {
                joinSelectedRoom(roomId);
            } else if (filterRef.current === "WAITING" || filterRef.current === "ACTIVE") {
                clearSelection();
            }
        } catch {
            /* ignore */
        }
    }, [clearOwnerTypingTimer, clearSelection, joinSelectedRoom]);

    const loadInitial = useCallback(async () => {
        setLoading(true);
        try {
            const tokensData = (await api.getOwnerLiveTokens()) as { bots: OwnerTokenEntry[] };
            if (Array.isArray(tokensData?.bots)) {
                const map: Record<string, string> = {};
                for (const entry of tokensData.bots) {
                    if (entry.humanChatEnabled) {
                        map[entry.botId] = entry.token;
                    }
                }
                tokensRef.current = map;
                setOwnerTokensVersion((v) => v + 1);
            }

            const data = (await api.listLiveRooms({ status: "WAITING" })) as LiveChatRoomDto[];
            const waiting = Array.isArray(data) ? data : [];
            updateRooms(waiting);
            setFilter("WAITING");

            if (waiting.length > 0) {
                void openRoom(waiting[0].id, { silent: true });
            }
        } catch (error) {
            console.error("Failed to load live chats:", error);
        } finally {
            setLoading(false);
        }
    }, [openRoom, updateRooms]);

    useEffect(() => {
        void loadInitial();
    }, [loadInitial]);

    // Deep-link from alert banners: /dashboard/live?room=... or in-page open event
    useEffect(() => {
        if (loading) return;
        const roomId = new URLSearchParams(window.location.search).get("room");
        if (roomId && selectedIdRef.current !== roomId) {
            void openRoom(roomId, { silent: true });
        }
    }, [loading, openRoom]);

    useEffect(() => {
        const onOpen = (event: Event) => {
            const roomId = (event as CustomEvent<{ roomId: string }>).detail?.roomId;
            if (!roomId) return;
            void openRoom(roomId, { silent: true });
        };
        window.addEventListener("live-owner-open-room", onOpen);
        return () => window.removeEventListener("live-owner-open-room", onOpen);
    }, [openRoom]);

    useEffect(() => {
        return () => setLiveOwnerSelectedRoom(null);
    }, []);

    // REST polling fallback. Under plain `next dev`, Vercel WebSockets do not
    // upgrade, so this is the primary delivery path. When a socket is live we
    // still refresh the room list occasionally but skip per-room message GETs.
    useEffect(() => {
        const tick = async () => {
            if (pollInFlightRef.current) return;
            pollInFlightRef.current = true;
            const f = filterRef.current || "WAITING";
            try {
                const data = (await api.listLiveRooms({ status: f })) as LiveChatRoomDto[];
                if (Array.isArray(data)) updateRooms(data);
            } catch {
                /* ignore */
            }
            try {
                if (wsConnectedRef.current) return;
                if (selectedIdRef.current) {
                    try {
                        const data = (await api.getLiveRoom(selectedIdRef.current)) as {
                            room: LiveChatRoomDto;
                            messages: LiveChatMessageDto[];
                            typing?: { visitor?: boolean; owner?: boolean };
                        };
                        if (data.room) {
                            activeRoomRef.current = data.room;
                            setActiveRoom(data.room);
                        }
                        if (Array.isArray(data.messages)) {
                            const unseen = data.messages.filter((m) => m?.id && !seenIdsRef.current[m.id]);
                            if (unseen.length) {
                                unseen.forEach((m) => {
                                    seenIdsRef.current[m.id] = true;
                                });
                                setMessages((prev) => {
                                    const existing = new Set(prev.map((m) => m.id));
                                    const fresh = unseen.filter((m) => !existing.has(m.id));
                                    return fresh.length ? [...prev, ...fresh] : prev;
                                });
                                if (unseen.some((m) => m.sender === "VISITOR")) {
                                    setVisitorTyping(false);
                                    playNotify();
                                }
                            }
                        }
                        if (data.typing) {
                            setVisitorTyping(Boolean(data.typing.visitor));
                        }
                    } catch {
                        /* ignore */
                    }
                }
            } finally {
                pollInFlightRef.current = false;
            }
        };

        void tick();
        const id = window.setInterval(() => void tick(), POLL_MS);
        return () => window.clearInterval(id);
    }, [filter, playNotify, updateRooms]);

    // WebSocket for instant notifications (works on Vercel with Fluid compute)
    useEffect(() => {
        const tokenEntries = Object.entries(tokensRef.current);
        if (tokenEntries.length === 0) return;

        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${proto}//${window.location.host}/api/live/ws`;
        const sockets: WebSocket[] = [];
        const reconnectTimers: number[] = [];
        let alive = true;
        let backoffMs = WS_RECONNECT_MIN_MS;

        const markDisconnected = () => {
            if (!alive) return;
            const anyOpen = sockets.some((s) => s.readyState === WebSocket.OPEN);
            if (!anyOpen) {
                wsConnectedRef.current = false;
                setWsConnected(false);
            }
        };

        const attach = (botId: string, token: string) => {
            if (!alive) return;
            let ws: WebSocket;
            try {
                ws = new WebSocket(url);
            } catch {
                return;
            }
            sockets.push(ws);
            if (!wsRef.current) wsRef.current = ws;
            wsSocketsRef.current = sockets;

            ws.onopen = () => {
                if (!alive) return;
                backoffMs = WS_RECONNECT_MIN_MS;
                try {
                    ws.send(JSON.stringify({ type: "hello", role: "owner", botId, token }));
                } catch {
                    /* ignore */
                }
                wsConnectedRef.current = true;
                setWsConnected(true);
                const selected = activeRoomRef.current;
                const roomId = selectedIdRef.current;
                // Re-subscribe only for live rooms — EXPIRED/CLOSED echo back and must not loop.
                if (
                    roomId &&
                    selected?.id === roomId &&
                    (selected.status === "WAITING" || selected.status === "ACTIVE")
                ) {
                    try {
                        ws.send(JSON.stringify({ type: "join-room", roomId }));
                    } catch {
                        /* ignore */
                    }
                }
            };
            ws.onmessage = (event) => {
                let payload: {
                    type?: string;
                    room?: LiveChatRoomDto;
                    roomId?: string;
                    message?: LiveChatMessageDto;
                    sender?: string;
                    isTyping?: boolean;
                };
                try {
                    payload = JSON.parse(String(event.data));
                } catch {
                    return;
                }
                if (!payload) return;

                // New human requests: alarm/banner is handled by LiveChatOwnerAlerts
                // in the dashboard layout so it fires even when this page isn't open.
                if (
                    payload.type === "request" ||
                    payload.type === "accepted" ||
                    payload.type === "expired" ||
                    payload.type === "closed"
                ) {
                    const acceptedRoomId = payload.room?.id || payload.roomId;
                    // If we just accepted the selected room, stay on ACTIVE — don't
                    // refresh WAITING (which would wipe the list to empty).
                    if (
                        payload.type === "accepted" &&
                        payload.room?.status === "ACTIVE" &&
                        acceptedRoomId &&
                        selectedIdRef.current === acceptedRoomId
                    ) {
                        if (filterRef.current !== "ACTIVE") {
                            setFilter("ACTIVE");
                        }
                        void refreshRooms("ACTIVE");
                        void openRoom(acceptedRoomId, { silent: true });
                    } else if (payload.type === "request" && payload.room?.id) {
                        void refreshRooms(filterRef.current);
                        void openRoom(payload.room.id, { silent: true });
                    } else if (
                        (payload.type === "expired" || payload.type === "closed") &&
                        payload.roomId &&
                        selectedIdRef.current === payload.roomId
                    ) {
                        // Never re-open here: join-room on an ended room re-emits expired/closed → infinite loop.
                        if (filterRef.current === "WAITING" || filterRef.current === "ACTIVE") {
                            clearSelection();
                        } else if (activeRoomRef.current?.id === payload.roomId) {
                            const nextStatus = payload.type === "closed" ? "CLOSED" : "EXPIRED";
                            const updated = { ...activeRoomRef.current, status: nextStatus as LiveChatRoomDto["status"] };
                            activeRoomRef.current = updated;
                            setActiveRoom(updated);
                        }
                        void refreshRooms(filterRef.current);
                    } else {
                        void refreshRooms(filterRef.current);
                    }
                } else if (payload.type === "message" && payload.message) {
                    const roomId = payload.message.roomId;
                    const message = payload.message as LiveChatMessageDto;
                    if (!message.id) return;
                    const isSelected = Boolean(roomId && selectedIdRef.current === roomId);
                    if (isSelected && message.sender === "VISITOR") {
                        setVisitorTyping(false);
                    }
                    if (isSelected && !seenIdsRef.current[message.id]) {
                        seenIdsRef.current[message.id] = true;
                        setMessages((prev) =>
                            prev.some((m) => m.id === message.id) ? prev : [...prev, message]
                        );
                        if (message.sender === "VISITOR") {
                            playNotify();
                        }
                    } else if (!isSelected && roomId) {
                        if (message.sender === "VISITOR") {
                            // Banner for other rooms is handled by LiveChatOwnerAlerts.
                            void refreshRooms(filterRef.current);
                        } else {
                            void refreshRooms(filterRef.current);
                        }
                    }
                } else if (payload.type === "typing") {
                    if (payload.sender === "VISITOR" && payload.roomId === selectedIdRef.current) {
                        setVisitorTyping(Boolean(payload.isTyping));
                    }
                }
            };
            ws.onclose = () => {
                const idx = sockets.indexOf(ws);
                if (idx >= 0) sockets.splice(idx, 1);
                if (wsRef.current === ws) wsRef.current = sockets[0] || null;
                wsSocketsRef.current = sockets;
                markDisconnected();
                if (!alive) return;
                const wait = backoffMs;
                backoffMs = Math.min(backoffMs * 2, WS_RECONNECT_MAX_MS);
                const timer = window.setTimeout(() => attach(botId, token), wait);
                reconnectTimers.push(timer);
            };
            ws.onerror = markDisconnected;
        };

        for (const [botId, token] of tokenEntries) {
            attach(botId, token);
        }

        return () => {
            alive = false;
            wsConnectedRef.current = false;
            setWsConnected(false);
            wsRef.current = null;
            for (const timer of reconnectTimers) window.clearTimeout(timer);
            for (const ws of sockets) {
                try {
                    ws.onclose = null;
                    ws.close();
                } catch {
                    /* ignore */
                }
            }
            wsSocketsRef.current = [];
        };
    }, [playNotify, refreshRooms, ownerTokensVersion, openRoom, setFilter, clearSelection]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, visitorTyping]);

    const acceptRoom = useCallback(async (roomId: string) => {
        try {
            await api.acceptLiveRoom(roomId);
            // Accepted rooms leave WAITING — switch to ACTIVE so the room
            // stays visible and the chat panel (not the empty waiting state) shows.
            setFilter("ACTIVE");
            await refreshRooms("ACTIVE");
            void openRoom(roomId, { silent: true });
            try {
                const url = new URL(window.location.href);
                url.searchParams.set("room", roomId);
                window.history.replaceState({}, "", `${url.pathname}${url.search}`);
            } catch {
                /* ignore */
            }
        } catch (error) {
            console.error("Failed to accept chat:", error);
        }
    }, [openRoom, refreshRooms, setFilter]);

    const resizeDraftInput = useCallback(() => {
        const el = draftInputRef.current;
        if (!el) return;
        el.style.height = "auto";
        const maxHeight = 160; // ~8 lines, WhatsApp-style grow then scroll
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
        el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }, []);

    useEffect(() => {
        resizeDraftInput();
    }, [draft, resizeDraftInput]);

    const sendOwnerMessage = useCallback(async () => {
        const roomId = selectedIdRef.current;
        const content = draft.trim();
        if (!roomId || !content || sending) return;
        setSending(true);
        setDraft("");
        clearOwnerTypingTimer();
        emitOwnerTyping(false);
        try {
            const data = (await api.sendLiveMessage(roomId, { content })) as { message: LiveChatMessageDto };
            if (data?.message) {
                // Mark seen before append so the WS broadcast / poll fallback
                // cannot add the same server message a second time.
                if (!seenIdsRef.current[data.message.id]) {
                    seenIdsRef.current[data.message.id] = true;
                    setMessages((prev) =>
                        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
                    );
                }
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            setDraft(content);
        } finally {
            setSending(false);
        }
    }, [clearOwnerTypingTimer, draft, emitOwnerTyping, sending]);

    const suggestReply = useCallback(async () => {
        const roomId = selectedIdRef.current;
        if (!roomId || suggesting) return;
        setSuggesting(true);
        try {
            const data = (await api.suggestLiveReply(roomId)) as { reply?: string };
            if (data?.reply) setDraft(data.reply);
        } catch (error) {
            console.error("Failed to generate reply:", error);
        } finally {
            setSuggesting(false);
        }
    }, [suggesting]);

    const changeFilter = useCallback(async (f: Filter) => {
        setFilter(f);
        clearSelection();
        const data = (await api.listLiveRooms({ status: f })) as LiveChatRoomDto[];
        updateRooms(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
            void openRoom(data[0].id, { silent: true });
        }
    }, [clearSelection, openRoom, setFilter, updateRooms]);

    const roomList = useMemo(() => {
        return rooms;
    }, [rooms]);

    const selected = activeRoom;

    const statusLabel = (status: LiveChatRoomDto["status"]) => {
        switch (status) {
            case "WAITING":
                return { text: "Waiting", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" };
            case "ACTIVE":
                return { text: "Active", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" };
            case "EXPIRED":
                return { text: "Expired", className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
            case "CLOSED":
                return { text: "Closed", className: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400" };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-black/60 dark:text-white/60" />
            </div>
        );
    }

    const filters: Filter[] = ["WAITING", "ACTIVE", "CLOSED", "ALL"];

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-[0_20px_60px_-38px_rgba(0,0,0,0.5)] dark:border-white/15 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55 dark:text-white/55">
                    Dashboard
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">Live Chat</h1>
                <p className="text-black/60 dark:text-white/65 mt-1">
                    Answer visitor requests in real time. You&apos;ll hear an alarm anywhere in the dashboard when a visitor asks for a human.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {filters.map((f) => (
                    <button
                        key={f}
                        onClick={() => void changeFilter(f)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            filter === f
                                ? "bg-black text-white dark:bg-white dark:text-black"
                                : "bg-white/70 text-black/60 hover:bg-black/5 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                        }`}
                    >
                        {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-black/60 dark:text-white/60"
                    onClick={() => void refreshRooms(filter)}
                >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Refresh
                </Button>
            </div>

            {roomList.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-black/20 bg-white/70 dark:border-white/20 dark:bg-white/5 flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center">
                        <Headset className="h-8 w-8" />
                    </div>
                    <p className="text-sm text-black/60 dark:text-white/65 text-center max-w-sm">
                        No {filter === "ALL" ? "" : filter.toLowerCase() + " "}live chats right now. Visitors see the
                        &quot;Chat with a real person&quot; button when the assistant has Human Live Chat enabled.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                    {/* Room list */}
                    <div className="rounded-3xl border border-black/10 bg-white/80 dark:border-white/15 dark:bg-white/5 overflow-hidden flex flex-col max-h-[540px]">
                        <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 text-sm font-semibold">
                            Requests
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-black/5 dark:divide-white/5">
                            {roomList.map((room) => {
                                const label = statusLabel(room.status);
                                const isSelected = selectedId === room.id;
                                return (
                                    <button
                                        key={room.id}
                                        onClick={() => void openRoom(room.id, { silent: true })}
                                        className={`w-full text-left px-4 py-3.5 transition-colors ${
                                            isSelected ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/[0.03] dark:hover:bg-white/5"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0">
                                                    <User className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {room.visitorName || "Visitor"}
                                                    </p>
                                                    <p className="text-xs text-black/50 dark:text-white/50 truncate">
                                                        {room.botName}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${label.className}`}>
                                                {label.text}
                                            </span>
                                        </div>
                                        {room.status === "WAITING" && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                                                Accept within ~{(Math.max(0, Math.ceil((new Date(room.expiresAt).getTime() - Date.now()) / 1000)))}s
                                            </p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat panel */}
                    <div className="rounded-3xl border border-black/10 bg-white/80 dark:border-white/15 dark:bg-white/5 flex flex-col h-[540px] overflow-hidden">
                        {!selected ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-black/50 dark:text-white/50">
                                <MessageSquare className="h-8 w-8" />
                                <p className="text-sm">Select a chat to answer it.</p>
                            </div>
                        ) : (
                            <>
                                {/* Chat header */}
                                <div className="px-4 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate">
                                                {selected.visitorName || "Visitor"}
                                            </p>
                                            <p className="text-xs text-black/50 dark:text-white/50 truncate">
                                                {selected.botName} · {selected.visitorId ? "registered visitor" : "anonymous session"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusLabel(selected.status).className}`}>
                                            {statusLabel(selected.status).text}
                                        </span>
                                        {selected.status === "WAITING" && (
                                            <Button
                                                size="sm"
                                                onClick={() => void acceptRoom(selected.id)}
                                                className="gap-1.5 text-xs rounded-full"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                                Accept
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin">
                                    {messages.map((msg) => {
                                        const isModeSwitch = msg.content === VISITOR_SWITCHED_TO_AI_MESSAGE;
                                        if (isModeSwitch) {
                                            return (
                                                <div key={msg.id} className="flex justify-center py-1">
                                                    <div className="max-w-[90%] rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3.5 py-1.5 text-center">
                                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                                            {msg.content}
                                                        </p>
                                                        <span className="text-[10px] text-amber-700/70 dark:text-amber-300/70">
                                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                            {" · chat expired"}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        const isOwner = msg.sender === "OWNER";
                                        return (
                                            <div key={msg.id} className={`flex flex-col gap-1 ${isOwner ? "items-end" : "items-start"}`}>
                                                <div
                                                    className={`max-w-[80%] rounded-[18px] px-3.5 py-2 text-sm leading-relaxed ${
                                                        isOwner
                                                            ? "bg-black text-white rounded-br-none dark:bg-zinc-700"
                                                            : "bg-slate-100 text-slate-800 rounded-bl-none dark:bg-zinc-800 dark:text-zinc-100"
                                                    }`}
                                                >
                                                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                                </div>
                                                <span className="text-[10px] text-black/40 dark:text-white/40 px-1">
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                    {isOwner ? " · you" : ""}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {visitorTyping && (
                                        <div className="flex items-end gap-2">
                                            <div className="bg-slate-100 dark:bg-zinc-800 rounded-[18px] rounded-bl-none px-4 py-3 flex gap-1 items-center">
                                                <span className="w-2 h-2 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:0ms]" />
                                                <span className="w-2 h-2 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:150ms]" />
                                                <span className="w-2 h-2 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:300ms]" />
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-1">Visitor typing…</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Composer */}
                                {selected.status === "ACTIVE" && (
                                    <div className="px-4 py-3 border-t border-black/10 dark:border-white/10 space-y-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs gap-1.5 rounded-full"
                                            onClick={() => void suggestReply()}
                                            disabled={suggesting}
                                        >
                                            {suggesting ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Sparkles className="h-3.5 w-3.5" />
                                            )}
                                            {suggesting ? "Generating…" : "Generate AI reply"}
                                        </Button>
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 flex items-end gap-2 bg-slate-50 dark:bg-zinc-900 rounded-[22px] px-3.5 py-2 border border-black/10 dark:border-white/10">
                                                <textarea
                                                    ref={draftInputRef}
                                                    rows={1}
                                                    placeholder="Type your reply…"
                                                    value={draft}
                                                    onChange={(e) => {
                                                        setDraft(e.target.value);
                                                        notifyOwnerTypingActivity();
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" && !e.shiftKey) {
                                                            e.preventDefault();
                                                            void sendOwnerMessage();
                                                        }
                                                    }}
                                                    className="flex-1 resize-none bg-transparent border-0 outline-none text-sm leading-5 focus:ring-0 placeholder-black/40 dark:placeholder-white/40 max-h-40 py-1.5"
                                                />
                                                <button
                                                    onClick={() => void sendOwnerMessage()}
                                                    disabled={!draft.trim() || sending}
                                                    className="shrink-0 mb-0.5 p-2 rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                                                    aria-label="Send reply"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-black/45 dark:text-white/45 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            AI replies are suggestions — review and edit before sending.
                                        </p>
                                    </div>
                                )}

                                {selected.status === "WAITING" && (
                                    <div className="px-4 py-3 border-t border-black/10 dark:border-white/10">
                                        <Button
                                            className="w-full gap-1.5"
                                            onClick={() => void acceptRoom(selected.id)}
                                        >
                                            <Check className="h-4 w-4" />
                                            Accept and join this chat
                                        </Button>
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 text-center">
                                            If you don&apos;t accept within ~30s, the visitor is shown your fallback contact options.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
