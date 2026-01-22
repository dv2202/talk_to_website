"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { LiveChatMessageDto, LiveChatRoomDto } from "@/lib/live-chat-shared";
import { getLiveOwnerSelectedRoom } from "@/lib/live-owner-selection";
import { Headset, MessageSquare, X } from "lucide-react";

const POLL_MS = 4000;
const TOKEN_REFRESH_MS = 10 * 60 * 1000;
const ALARM_BURSTS = 8;
const SEEN_REQUESTS_KEY = "botwebai:live-seen-requests";
const WS_RECONNECT_MIN_MS = 2000;
const WS_RECONNECT_MAX_MS = 30000;

function loadSeenRequestIds(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = sessionStorage.getItem(SEEN_REQUESTS_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === "string")) : new Set();
    } catch {
        return new Set();
    }
}

function persistSeenRequestIds(ids: Set<string>) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(SEEN_REQUESTS_KEY, JSON.stringify([...ids].slice(-200)));
    } catch {
        /* ignore quota */
    }
}

interface OwnerTokenEntry {
    botId: string;
    botName: string;
    name: string;
    humanChatEnabled: boolean;
    token: string;
}

type RequestBanner = {
    kind: "request";
    roomId: string;
    visitorName: string;
    botName: string;
};

type MessageBanner = {
    kind: "message";
    roomId: string;
    visitorName: string;
    botName: string;
    preview: string;
};

type Banner = RequestBanner | MessageBanner;

function unlockAudioContext(ctx: AudioContext) {
    if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
    }
}

/** Urgent alternating-tone alarm (Web Audio) — works without shipping a new asset. */
function playAlarmSound(getCtx: () => AudioContext | null) {
    try {
        const ctx = getCtx();
        if (!ctx) return;
        unlockAudioContext(ctx);
        const now = ctx.currentTime;
        for (let i = 0; i < ALARM_BURSTS; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "square";
            osc.frequency.value = i % 2 === 0 ? 980 : 720;
            const t0 = now + i * 0.22;
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 0.2);
        }
    } catch {
        /* ignore autoplay / AudioContext errors */
    }
}

function playMessageSound() {
    try {
        const audio = new Audio("/bot.mp3");
        audio.volume = 0.45;
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
        /* ignore */
    }
}

function showBrowserNotification(title: string, body: string, tag: string, roomId: string) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
        const n = new Notification(title, {
            body,
            tag,
            requireInteraction: true,
        });
        n.onclick = () => {
            window.focus();
            window.location.href = `/dashboard/live?room=${encodeURIComponent(roomId)}`;
            n.close();
        };
    } catch {
        /* ignore */
    }
}

function truncate(text: string, max = 80) {
    const t = text.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

export function LiveChatOwnerAlerts() {
    const pathname = usePathname();
    const router = useRouter();
    const [requestBanner, setRequestBanner] = useState<RequestBanner | null>(null);
    const [messageBanner, setMessageBanner] = useState<MessageBanner | null>(null);

    const tokensRef = useRef<Record<string, string>>({});
    const seenRequestIdsRef = useRef<Set<string>>(loadSeenRequestIds());
    const seenMessageIdsRef = useRef<Set<string>>(new Set());
    const seededRef = useRef(false);
    const pollInFlightRef = useRef(false);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const originalTitleRef = useRef<string | null>(null);
    const titleFlashRef = useRef<number | null>(null);
    const socketsRef = useRef<WebSocket[]>([]);
    const [tokensVersion, setTokensVersion] = useState(0);

    const getAudioCtx = useCallback(() => {
        if (typeof window === "undefined") return null;
        const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        if (!audioCtxRef.current) {
            try {
                audioCtxRef.current = new AC();
            } catch {
                return null;
            }
        }
        return audioCtxRef.current;
    }, []);

    const stopTitleFlash = useCallback(() => {
        if (titleFlashRef.current) {
            window.clearInterval(titleFlashRef.current);
            titleFlashRef.current = null;
        }
        if (originalTitleRef.current != null) {
            document.title = originalTitleRef.current;
            originalTitleRef.current = null;
        }
    }, []);

    const startTitleFlash = useCallback((label: string) => {
        if (originalTitleRef.current == null) {
            originalTitleRef.current = document.title;
        }
        if (titleFlashRef.current) {
            window.clearInterval(titleFlashRef.current);
        }
        let on = false;
        titleFlashRef.current = window.setInterval(() => {
            on = !on;
            document.title = on ? label : originalTitleRef.current || "Live Chat";
        }, 900);
    }, []);

    const pathnameRef = useRef(pathname);
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    const alertForRequest = useCallback(
        (room: LiveChatRoomDto) => {
            if (!room?.id || room.status !== "WAITING") return;
            if (seenRequestIdsRef.current.has(room.id)) return;
            seenRequestIdsRef.current.add(room.id);
            persistSeenRequestIds(seenRequestIdsRef.current);

            playAlarmSound(getAudioCtx);
            showBrowserNotification(
                "Live chat request",
                `${room.visitorName || "A visitor"} wants to chat on ${room.botName || "your assistant"}`,
                `live-request-${room.id}`,
                room.id
            );

            const onLivePage = pathnameRef.current?.startsWith("/dashboard/live");
            if (onLivePage) return;

            startTitleFlash("🔔 Live chat request!");
            setRequestBanner({
                kind: "request",
                roomId: room.id,
                visitorName: room.visitorName || "A visitor",
                botName: room.botName || "your assistant",
            });
        },
        [getAudioCtx, startTitleFlash]
    );

    const alertForMessage = useCallback(
        (message: LiveChatMessageDto, room?: LiveChatRoomDto | null) => {
            if (!message?.id || message.sender !== "VISITOR") return;
            if (seenMessageIdsRef.current.has(message.id)) return;
            seenMessageIdsRef.current.add(message.id);

            const selected = getLiveOwnerSelectedRoom();
            if (selected && selected === message.roomId) return;

            const visitorName = room?.visitorName || "A visitor";
            const botName = room?.botName || "a live chat";
            const preview = truncate(message.content || "New message");

            playMessageSound();
            showBrowserNotification(
                "New live chat message",
                `${visitorName}: ${preview}`,
                `live-message-${message.roomId}`,
                message.roomId
            );

            const onLivePage = pathnameRef.current?.startsWith("/dashboard/live");
            if (!onLivePage) {
                startTitleFlash("💬 New message");
            }

            setMessageBanner({
                kind: "message",
                roomId: message.roomId,
                visitorName,
                botName,
                preview,
            });
        },
        [startTitleFlash]
    );

    // Clear message banner when owner opens that room.
    useEffect(() => {
        const onSelected = (event: Event) => {
            const roomId = (event as CustomEvent<{ roomId: string | null }>).detail?.roomId;
            if (!roomId) return;
            setMessageBanner((prev) => (prev?.roomId === roomId ? null : prev));
            setRequestBanner((prev) => (prev?.roomId === roomId ? null : prev));
            if (getLiveOwnerSelectedRoom() === roomId) stopTitleFlash();
        };
        window.addEventListener("live-owner-selected-room", onSelected);
        return () => window.removeEventListener("live-owner-selected-room", onSelected);
    }, [stopTitleFlash]);

    // Unlock audio + request notification permission after first user gesture.
    useEffect(() => {
        const unlock = () => {
            const ctx = getAudioCtx();
            if (ctx) unlockAudioContext(ctx);
            if ("Notification" in window && Notification.permission === "default") {
                void Notification.requestPermission().catch(() => {});
            }
        };
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        return () => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, [getAudioCtx]);

    // Clear request title flash when opening Live Chat; keep message banners if for other rooms.
    // (Request banner is hidden via render when already on the live page.)

    useEffect(() => {
        return () => {
            stopTitleFlash();
            try {
                void audioCtxRef.current?.close();
            } catch {
                /* ignore */
            }
            audioCtxRef.current = null;
        };
    }, [stopTitleFlash]);

    const loadTokens = useCallback(async () => {
        try {
            const data = (await api.getOwnerLiveTokens()) as { bots: OwnerTokenEntry[] };
            if (!Array.isArray(data?.bots)) return;
            const map: Record<string, string> = {};
            for (const entry of data.bots) {
                if (entry.humanChatEnabled) {
                    map[entry.botId] = entry.token;
                }
            }
            tokensRef.current = map;
            setTokensVersion((v) => v + 1);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        void loadTokens();
        const id = window.setInterval(() => void loadTokens(), TOKEN_REFRESH_MS);
        return () => window.clearInterval(id);
    }, [loadTokens]);

    // Seed existing WAITING rooms without alerting (page refresh / first load).
    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const data = (await api.listLiveRooms({ status: "WAITING" })) as LiveChatRoomDto[];
                if (cancelled) return;
                if (Array.isArray(data)) {
                    for (const room of data) {
                        seenRequestIdsRef.current.add(room.id);
                    }
                    persistSeenRequestIds(seenRequestIdsRef.current);
                }
            } catch {
                /* still allow polling */
            } finally {
                if (!cancelled) seededRef.current = true;
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // REST poll fallback for new WAITING rooms (WS may miss cross-instance).
    useEffect(() => {
        const tick = async () => {
            if (!seededRef.current || pollInFlightRef.current) return;
            pollInFlightRef.current = true;
            try {
                const data = (await api.listLiveRooms({ status: "WAITING" })) as LiveChatRoomDto[];
                if (!Array.isArray(data)) return;
                for (const room of data) {
                    alertForRequest(room);
                }
            } catch {
                /* ignore */
            } finally {
                pollInFlightRef.current = false;
            }
        };
        void tick();
        const id = window.setInterval(() => void tick(), POLL_MS);
        return () => window.clearInterval(id);
    }, [alertForRequest]);

    // WebSocket: requests + messages for rooms the owner is not viewing.
    useEffect(() => {
        const tokenEntries = Object.entries(tokensRef.current);
        if (tokenEntries.length === 0) return;

        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url = `${proto}//${window.location.host}/api/live/ws`;
        const sockets: WebSocket[] = [];
        const reconnectTimers: number[] = [];
        let alive = true;
        let backoffMs = WS_RECONNECT_MIN_MS;

        const attach = (botId: string, token: string) => {
            if (!alive) return;
            let ws: WebSocket;
            try {
                ws = new WebSocket(url);
            } catch {
                return;
            }
            sockets.push(ws);

            ws.onopen = () => {
                if (!alive) return;
                backoffMs = WS_RECONNECT_MIN_MS;
                try {
                    ws.send(JSON.stringify({ type: "hello", role: "owner", botId, token }));
                } catch {
                    /* ignore */
                }
            };
            ws.onmessage = (event) => {
                let payload: {
                    type?: string;
                    room?: LiveChatRoomDto;
                    message?: LiveChatMessageDto;
                };
                try {
                    payload = JSON.parse(String(event.data));
                } catch {
                    return;
                }
                if (payload?.type === "request" && payload.room) {
                    alertForRequest(payload.room);
                } else if (payload?.type === "message" && payload.message) {
                    alertForMessage(payload.message, payload.room);
                }
            };
            ws.onclose = () => {
                const idx = sockets.indexOf(ws);
                if (idx >= 0) sockets.splice(idx, 1);
                if (!alive) return;
                const wait = backoffMs;
                backoffMs = Math.min(backoffMs * 2, WS_RECONNECT_MAX_MS);
                const timer = window.setTimeout(() => attach(botId, token), wait);
                reconnectTimers.push(timer);
            };
        };

        for (const [botId, token] of tokenEntries) {
            attach(botId, token);
        }

        socketsRef.current = sockets;
        return () => {
            alive = false;
            for (const timer of reconnectTimers) window.clearTimeout(timer);
            for (const ws of sockets) {
                try {
                    ws.onclose = null;
                    ws.close();
                } catch {
                    /* ignore */
                }
            }
            socketsRef.current = [];
        };
    }, [tokensVersion, alertForRequest, alertForMessage]);

    const banners: Banner[] = [];
    if (messageBanner) banners.push(messageBanner);
    const showRequest =
        requestBanner && !pathname?.startsWith("/dashboard/live") ? requestBanner : null;
    if (showRequest) banners.push(showRequest);
    if (banners.length === 0) return null;

    const openRoom = (roomId: string) => {
        stopTitleFlash();
        setMessageBanner((prev) => (prev?.roomId === roomId ? null : prev));
        setRequestBanner((prev) => (prev?.roomId === roomId ? null : prev));
        if (pathnameRef.current?.startsWith("/dashboard/live")) {
            window.dispatchEvent(new CustomEvent("live-owner-open-room", { detail: { roomId } }));
            return;
        }
        router.push(`/dashboard/live?room=${encodeURIComponent(roomId)}`);
    };

    return (
        <div className="fixed bottom-4 right-4 z-100 flex max-w-sm flex-col gap-2">
            {banners.map((banner) => {
                const isRequest = banner.kind === "request";
                return (
                    <div
                        key={`${banner.kind}-${banner.roomId}`}
                        className={`animate-in fade-in slide-in-from-bottom-2 rounded-2xl border shadow-lg ${
                            isRequest
                                ? "border-amber-500/40 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950 dark:text-amber-50"
                                : "border-sky-500/40 bg-sky-50 text-sky-950 dark:border-sky-400/30 dark:bg-sky-950 dark:text-sky-50"
                        }`}
                    >
                        <div className="flex items-start gap-3 p-4">
                            <div
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                    isRequest
                                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                        : "bg-sky-500/20 text-sky-700 dark:text-sky-300"
                                }`}
                            >
                                {isRequest ? (
                                    <Headset className="h-4 w-4" />
                                ) : (
                                    <MessageSquare className="h-4 w-4" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">
                                    {isRequest ? "Live chat request" : "New message"}
                                </p>
                                <p className="mt-0.5 text-xs opacity-80">
                                    {isRequest
                                        ? `${banner.visitorName} wants to chat on ${banner.botName}`
                                        : `New message from ${banner.visitorName} (${banner.botName})`}
                                </p>
                                {!isRequest && (
                                    <p className="mt-1 truncate text-xs font-medium opacity-90">
                                        “{banner.preview}”
                                    </p>
                                )}
                                {isRequest ? (
                                    <Link
                                        href={`/dashboard/live?room=${encodeURIComponent(banner.roomId)}`}
                                        className="mt-3 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
                                        onClick={() => {
                                            stopTitleFlash();
                                            setRequestBanner(null);
                                        }}
                                    >
                                        Answer now
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        className="mt-3 inline-flex items-center rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-sky-950 dark:hover:bg-sky-400"
                                        onClick={() => openRoom(banner.roomId)}
                                    >
                                        Open room
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                className="rounded-md p-1 opacity-60 hover:opacity-100"
                                aria-label="Dismiss"
                                onClick={() => {
                                    if (isRequest) setRequestBanner(null);
                                    else setMessageBanner(null);
                                    stopTitleFlash();
                                }}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
