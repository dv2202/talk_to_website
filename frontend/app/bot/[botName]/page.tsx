"use client";

import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  clearVisitorAccessToken,
  getStoredVisitorAccessToken,
  storeVisitorAccessToken,
} from "@/lib/visitor-access-browser";
import { formatTimeAgo } from "@/lib/format-time-ago";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  Headset,
  Loader2,
  Send,
  Home,
  MessageSquare,
  User,
} from "lucide-react";

interface FallbackContact {
  type: "WHATSAPP" | "EMAIL" | "TELEGRAM" | "PHONE";
  value: string;
}

interface BotConfig {
  id: string;
  name: string;
  botName: string;
  description: string | null;
  defaultLanguage: string;
  mode: string;
  widgetPosition: string;
  logo: string | null;
  themeColor: string | null;
  logoBgColor?: string | null;
  widgetLogo?: string | null;
  widgetLogoBgColor?: string | null;
  welcomeTitle: string | null;
  welcomeSubtitle: string | null;
  quickQuestions: string | null;
  widgetApiKey: string | null;
  knowledgeSourcesCount: number;
  showBranding?: boolean;
  liveChatAvailable?: boolean;
  fallbackContacts?: FallbackContact[];
}

interface Message {
  role: "user" | "bot";
  content: string;
  createdAt?: string;
  contacts?: FallbackContact[];
}

interface LiveChatState {
  roomId: string;
  status: "waiting" | "active" | "expired";
  ws: WebSocket | null;
  timeoutId: number | null;
  intervalId: number | null;
  seenIds: Record<string, boolean>;
  localIds: Record<string, boolean>;
  typingIdleId: number | null;
  typingActive: boolean;
}

const LIVE_ACCEPT_TIMEOUT_MS = 30000;
const LIVE_TYPING_IDLE_MS = 1800;

function fallbackContactHref(type: FallbackContact["type"], value: string): string {
  if (type === "EMAIL") return `mailto:${value}`;
  if (type === "WHATSAPP") return `https://wa.me/${value.replace(/\D/g, "")}`;
  if (type === "TELEGRAM") return `https://t.me/${value.replace(/^@/, "")}`;
  return `tel:${value}`;
}

function fallbackContactLabel(type: FallbackContact["type"]): string {
  switch (type) {
    case "EMAIL":
      return "Email";
    case "WHATSAPP":
      return "WhatsApp";
    case "TELEGRAM":
      return "Telegram";
    case "PHONE":
      return "Call";
  }
}

export default function ChatbotPage({ params }: { params: Promise<{ botName: string }> }) {
  const { botName } = use(params);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "messages">("home");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [liveChat, setLiveChat] = useState<LiveChatState | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [ownerTyping, setOwnerTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<LiveChatState | null>(null);
  const ownerTypingRef = useRef(false);
  const pollLiveChatRef = useRef<() => Promise<void>>(async () => { });
  const typingActiveRef = useRef(false);

  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    if (typeof window !== "undefined") {
      const key = `ttw:bot-session:${botName}`;
      let existing = window.sessionStorage.getItem(key);
      if (!existing) {
        existing = `sess_${Math.random().toString(36).slice(2, 15)}`;
        window.sessionStorage.setItem(key, existing);
      }
      sessionIdRef.current = existing;
    } else {
      sessionIdRef.current = `sess_ssr_${botName}`;
    }
  }
  const sessionId = sessionIdRef.current;


  const appendMessage = useCallback((role: Message["role"], content: string, createdAt?: string, contacts?: FallbackContact[]) => {
    setMessages((prev) => [...prev, { role, content, createdAt: createdAt || new Date().toISOString(), contacts }]);
  }, []);

  const updateLive = useCallback((next: LiveChatState | null) => {
    liveRef.current = next;
    setLiveChat(next);
  }, []);

  const buildWsUrl = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/live/ws`;
  }, []);

  const clearAcceptTimeout = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    if (live.timeoutId) {
      window.clearTimeout(live.timeoutId);
      live.timeoutId = null;
    }
  }, []);

  const clearLiveTimer = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    clearAcceptTimeout();
    if (live.intervalId) {
      window.clearInterval(live.intervalId);
      live.intervalId = null;
    }
  }, [clearAcceptTimeout]);

  const ensureLivePolling = useCallback(() => {
    const live = liveRef.current;
    if (!live || live.intervalId) return;
    live.intervalId = window.setInterval(() => void pollLiveChatRef.current(), 3000);
  }, []);

  const setOwnerTypingState = useCallback((isTyping: boolean) => {
    ownerTypingRef.current = isTyping;
    setOwnerTyping(isTyping);
  }, []);

  const clearVisitorTypingTimer = useCallback(() => {
    const live = liveRef.current;
    if (!live?.typingIdleId) return;
    window.clearTimeout(live.typingIdleId);
    live.typingIdleId = null;
  }, []);

  const emitVisitorTyping = useCallback((isTyping: boolean) => {
    const live = liveRef.current;
    if (!live || live.status !== "active") return;
    if (typingActiveRef.current === isTyping) return;
    typingActiveRef.current = isTyping;
    live.typingActive = isTyping;

    if (live.ws && live.ws.readyState === 1) {
      try {
        live.ws.send(JSON.stringify({ type: "typing", roomId: live.roomId, isTyping }));
        return;
      } catch {
        /* fall through to HTTP */
      }
    }

    void api
      .sendLiveTyping(live.roomId, {
        isTyping,
        widgetApiKey: botConfig?.widgetApiKey || undefined,
      })
      .catch(() => { });
  }, [botConfig]);

  const notifyVisitorTypingActivity = useCallback(() => {
    const live = liveRef.current;
    if (!live || live.status !== "active") return;
    emitVisitorTyping(true);
    clearVisitorTypingTimer();
    live.typingIdleId = window.setTimeout(() => {
      emitVisitorTyping(false);
    }, LIVE_TYPING_IDLE_MS);
  }, [clearVisitorTypingTimer, emitVisitorTyping]);

  const syncLiveMessages = useCallback((liveMsgs: Array<{ id: string; sender: string; content: string; createdAt: string }>) => {
    const live = liveRef.current;
    if (!live) return;
    live.seenIds = live.seenIds || {};
    live.localIds = live.localIds || {};
    let sawOwner = false;
    setMessages((prev) => {
      let changed = false;
      const next = [...prev];
      for (const m of liveMsgs) {
        if (live.seenIds[m.id]) continue;
        live.seenIds[m.id] = true;
        if (m.sender === "VISITOR") {
          if (live.localIds[m.id]) continue;
          next.push({ role: "user", content: m.content, createdAt: m.createdAt });
        } else {
          sawOwner = true;
          next.push({ role: "bot", content: m.content, createdAt: m.createdAt });
        }
        changed = true;
      }
      return changed ? next : prev;
    });
    if (sawOwner) setOwnerTypingState(false);
  }, [setOwnerTypingState]);

  const enterLiveActive = useCallback(() => {
    const live = liveRef.current;
    if (!live || live.status !== "waiting") return;
    // Clear accept timeout only — keep REST polling so owner messages still
    // arrive when WebSockets are unavailable (plain `next dev`).
    clearAcceptTimeout();
    ensureLivePolling();
    const next: LiveChatState = { ...live, status: "active", timeoutId: null };
    updateLive(next);
    appendMessage("bot", "A support agent has joined. You're now in a live chat — they can help you directly.");
    setLiveBusy(false);
  }, [appendMessage, clearAcceptTimeout, ensureLivePolling, updateLive]);

  const stopLiveChatInternal = useCallback(() => {
    const live = liveRef.current;
    clearLiveTimer();
    clearVisitorTypingTimer();
    if (typingActiveRef.current) {
      emitVisitorTyping(false);
    }
    if (live?.ws) {
      try {
        live.ws.onclose = null;
        live.ws.close();
      } catch {
        /* ignore */
      }
    }
    setOwnerTypingState(false);
    typingActiveRef.current = false;
    updateLive(null);
    setLiveBusy(false);
  }, [clearLiveTimer, clearVisitorTypingTimer, emitVisitorTyping, setOwnerTypingState, updateLive]);

  const enterLiveExpired = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    const wasActive = live.status === "active";
    clearLiveTimer();
    setOwnerTypingState(false);
    const contacts = botConfig?.fallbackContacts || [];
    if (!wasActive) {
      appendMessage(
        "bot",
        "Customer Care is busy right now. Please try again later, or reach us directly:",
        new Date().toISOString(),
        contacts.length ? contacts : undefined
      );
    } else {
      appendMessage("bot", "The chat has ended. Thanks for reaching out!");
    }
    stopLiveChatInternal();
    setLiveBusy(false);
  }, [appendMessage, botConfig, clearLiveTimer, setOwnerTypingState, stopLiveChatInternal]);

  const stopLiveChat = useCallback((notifyServer: boolean, reason?: string) => {
    const live = liveRef.current;
    if (live && notifyServer && live.roomId) {
      const body = {
        reason:
          reason ||
          (live.status === "waiting" ? "visitor-timeout" : "visitor-left"),
        widgetApiKey: botConfig?.widgetApiKey || undefined,
      };
      void api.expireLiveRoom(live.roomId, body).catch(() => { });
    }
    stopLiveChatInternal();
  }, [botConfig, stopLiveChatInternal]);

  const handleLiveSocketMessage = useCallback((payload: {
    type?: string;
    roomId?: string;
    reason?: string;
    room?: { status?: string };
    message?: { id: string; sender: string; content: string; createdAt: string; roomId?: string };
    sender?: string;
    isTyping?: boolean;
  }) => {
    const live = liveRef.current;
    if (!live || !payload) return;

    if (payload.type === "accepted") {
      // Require ACTIVE — owner joining a WAITING room must not unlock chat.
      if (live.status === "waiting" && payload.room?.status === "ACTIVE") {
        enterLiveActive();
      }
    } else if (payload.type === "expired" || payload.type === "closed") {
      if (live.status !== "expired") enterLiveExpired();
    } else if (payload.type === "message" && payload.message) {
      if (live.status !== "active") return;
      if (payload.message.roomId && payload.message.roomId !== live.roomId) return;
      syncLiveMessages([payload.message]);
    } else if (payload.type === "typing") {
      if (payload.sender === "OWNER" && live.status === "active") {
        setOwnerTypingState(Boolean(payload.isTyping));
      }
    }
  }, [enterLiveActive, enterLiveExpired, setOwnerTypingState, syncLiveMessages]);

  const connectLiveSocket = useCallback((roomId: string) => {
    const url = buildWsUrl();
    if (!url || typeof window === "undefined" || !window.WebSocket) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return;
    }

    const live = liveRef.current;
    if (!live) return;
    live.ws = ws;

    ws.onopen = () => {
      if (!liveRef.current || liveRef.current.roomId !== roomId) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      ws.send(
        JSON.stringify({
          type: "hello",
          role: "visitor",
          botId: botConfig?.id,
          roomId,
          sessionId,
        })
      );
    };

    ws.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      handleLiveSocketMessage(payload as Parameters<typeof handleLiveSocketMessage>[0]);
    };

    ws.onclose = () => {
      const current = liveRef.current;
      if (current && current.ws === ws) {
        current.ws = null;
      }
    };
  }, [botConfig, buildWsUrl, handleLiveSocketMessage, sessionId]);

  const pollLiveChat = useCallback(async () => {
    const live = liveRef.current;
    if (!live || live.status === "expired") return;
    try {
      const data = await api.getLiveRoom(live.roomId, {
        widgetApiKey: botConfig?.widgetApiKey || undefined,
      });
      const room = data?.room as { status?: string } | undefined;
      if (!room) return;

      if (room.status === "ACTIVE" && liveRef.current?.status === "waiting") {
        enterLiveActive();
      } else if (
        (room.status === "EXPIRED" || room.status === "CLOSED") &&
        (liveRef.current?.status === "waiting" || liveRef.current?.status === "active")
      ) {
        enterLiveExpired();
        return;
      }

      const msgs = (data?.messages as Array<{ id: string; sender: string; content: string; createdAt: string }>) || [];
      if (liveRef.current?.status === "active") {
        syncLiveMessages(msgs);
        const typing = data?.typing as { owner?: boolean } | undefined;
        if (typing) setOwnerTypingState(Boolean(typing.owner));
      }
    } catch {
      /* transient — poll retries */
    }
  }, [botConfig, enterLiveActive, enterLiveExpired, setOwnerTypingState, syncLiveMessages]);

  pollLiveChatRef.current = pollLiveChat;

  const startLiveChat = useCallback(async () => {
    if (!botConfig?.liveChatAvailable || liveRef.current || liveBusy) return;
    setLiveBusy(true);

    let room: { id: string };
    try {
      const created = await api.createLiveRoom({
        botName: botConfig.botName,
        widgetApiKey: botConfig.widgetApiKey || undefined,
        sessionId,
      });
      room = created as { id: string };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setActiveTab("messages");
      appendMessage(
        "bot",
        message.includes("plan")
          ? "Live chat is a Pro plan feature. Please ask the owner to upgrade."
          : "Sorry, we couldn't connect you to a real person right now. Please try again in a moment."
      );
      setLiveBusy(false);
      return;
    }

    const live: LiveChatState = {
      roomId: room.id,
      status: "waiting",
      ws: null,
      timeoutId: null,
      intervalId: null,
      seenIds: {},
      localIds: {},
      typingIdleId: null,
      typingActive: false,
    };
    updateLive(live);

    setActiveTab("messages");
    appendMessage("bot", "Connecting you to a real person… one moment please.");

    connectLiveSocket(room.id);

    live.timeoutId = window.setTimeout(() => {
      if (liveRef.current?.status === "waiting") {
        const id = liveRef.current.roomId;
        void api
          .expireLiveRoom(id, { reason: "visitor-timeout", widgetApiKey: botConfig?.widgetApiKey || undefined })
          .catch(() => { });
        enterLiveExpired();
      }
    }, LIVE_ACCEPT_TIMEOUT_MS + 1500);

    ensureLivePolling();
  }, [appendMessage, botConfig, connectLiveSocket, ensureLivePolling, enterLiveExpired, liveBusy, sessionId, updateLive]);

  const sendLiveMessage = useCallback(async () => {
    const live = liveRef.current;
    const text = input.trim();
    if (!text || !live || live.status !== "active" || liveBusy) return;

    setInput("");
    appendMessage("user", text);

    clearVisitorTypingTimer();
    emitVisitorTyping(false);

    setLiveBusy(true);
    try {
      const data = await api.sendLiveMessage(live.roomId, {
        content: text,
        widgetApiKey: botConfig?.widgetApiKey || undefined,
      });
      const msg = data?.message as { id?: string } | undefined;
      if (msg?.id) {
        const current = liveRef.current;
        if (current) {
          current.localIds = current.localIds || {};
          current.localIds[msg.id] = true;
        }
      }
    } catch {
      appendMessage("bot", "Could not send your message. Please try again.");
    } finally {
      setLiveBusy(false);
    }
  }, [appendMessage, botConfig, clearVisitorTypingTimer, emitVisitorTyping, input, liveBusy]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const live = liveRef.current;
      if (live) {
        if (live.status === "active") void sendLiveMessage();
        return;
      }

      const message = text || input.trim();
      if (!message || sending) return;

      const sentAt = new Date().toISOString();
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: message, createdAt: sentAt }]);
      setActiveTab("messages");
      setSending(true);

      try {
        if (botConfig && typeof botConfig.knowledgeSourcesCount === "number" && botConfig.knowledgeSourcesCount === 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          setMessages((prev) => [
            ...prev,
            {
              role: "bot",
              content: "⚠️ Please add a knowledge base so that the AI can answer your questions.",
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }

        let started = false;
        await api.streamMessage(
          {
            botName: botConfig?.botName,
            message,
            sessionId,
            visitorAccessToken: botConfig?.id
              ? getStoredVisitorAccessToken(botConfig.id) || undefined
              : undefined,
          },
          {
            onToken: (token) => {
              if (!started) {
                started = true;
                setSending(false);
                setMessages((prev) => [
                  ...prev,
                  { role: "bot", content: token, createdAt: new Date().toISOString() },
                ]);
                return;
              }
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "bot") {
                  next[next.length - 1] = { ...last, content: last.content + token };
                }
                return next;
              });
            },
            onDone: (result) => {
              if (result.visitorAccessToken) {
                if (botConfig?.id) storeVisitorAccessToken(botConfig.id, result.visitorAccessToken);
              }
              if (!result.createdAt) return;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "bot") {
                  next[next.length - 1] = { ...last, createdAt: result.createdAt };
                }
                return next;
              });
            },
          }
        );
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Sorry, I encountered an error. Please try again.";
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "bot" && last.content) {
            return prev;
          }
          return [...prev, { role: "bot", content: errorMessage, createdAt: new Date().toISOString() }];
        });
      } finally {
        setSending(false);
      }
    },
    [botConfig, input, sending, sendLiveMessage, sessionId]
  );

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await api.getBotConfig(botName);
        setBotConfig(config);

        const greeting: Message = {
          role: "bot",
          content: `Hi! I am ${config.name}. How can I help you today?`,
          createdAt: new Date().toISOString(),
        };

        try {
          const accessToken = getStoredVisitorAccessToken(config.id);
          const conversations = accessToken
            ? await api.getConversations(config.id, accessToken)
            : [];
          if (Array.isArray(conversations) && conversations.length > 0) {
            const restored: Message[] = [];
            for (const conversation of conversations as Array<{
              userMessage: string;
              aiResponse: string;
              createdAt?: string;
            }>) {
              const createdAt = conversation.createdAt;
              restored.push({ role: "user", content: conversation.userMessage, createdAt });
              restored.push({ role: "bot", content: conversation.aiResponse, createdAt });
            }
            setMessages(restored);
            setActiveTab("messages");
          } else {
            setMessages([greeting]);
          }
        } catch {
          clearVisitorAccessToken(config.id);
          setMessages([greeting]);
        }
      } catch (error) {
        console.error("Failed to load bot:", error);
      } finally {
        setLoading(false);
      }
    };
    void fetchConfig();
  }, [botName, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, ownerTyping]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      const live = liveRef.current;
      clearLiveTimer();
      if (live?.ws) {
        try {
          live.ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [clearLiveTimer]);

  const suggestedQuestions = useMemo(
    () => [
      "What do you do?",
      "How can you help me?",
      "Tell me about your services",
      "How do I get started?",
    ],
    []
  );

  const parsedQuestions = (() => {
    if (botConfig?.quickQuestions) {
      return botConfig.quickQuestions.split(",").map((q) => q.trim()).filter(Boolean);
    }
    return suggestedQuestions;
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!botConfig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Bot className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Bot not found</h1>
        <p className="text-muted-foreground">The chatbot &quot;{botName}&quot; doesn&apos;t exist.</p>
        <Link href="/">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Home
          </Button>
        </Link>
      </div>
    );
  }

  const live = liveChat;
  const liveActive = live?.status === "active";
  const liveWaiting = live?.status === "waiting";
  const themeColor = botConfig.themeColor || "#0f172a";
  const logoBgColor = botConfig.logoBgColor || "#ffffff";
  const welcomeTitle = botConfig.welcomeTitle || `Hi, I'm ${botConfig.name}'s AI agent 👋`;
  const welcomeSubtitle = botConfig.welcomeSubtitle || "I can answer anything about how we work, what it costs, or how we compare.";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-[440px] h-[720px] rounded-[28px] border border-slate-200/60 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Dynamic Header */}
        <div
          className="px-6 pt-6 pb-16 text-white relative transition-all duration-300 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${themeColor} 0%, rgba(15, 23, 42, 0.93) 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h3 className="font-semibold text-base tracking-tight truncate max-w-[160px]">
                {botConfig.name}
              </h3>
              <span
                className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${liveActive ? "bg-emerald-400 text-emerald-950" : "bg-white/20"
                  }`}
              >
                {liveActive ? "LIVE" : "AI"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {liveWaiting && (
                <span className="flex items-center gap-1.5 text-[10px] text-amber-100 bg-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                  Waiting for an agent…
                </span>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-white/80 bg-white/10 px-2 py-0.5 rounded-full">
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${liveActive ? "bg-emerald-400" : "bg-emerald-400"}`} />
                <span>{liveActive ? "Support agent • online" : "Online"}</span>
              </div>
            </div>
          </div>

          {botConfig.liveChatAvailable === true && !live && (
            <button
              onClick={() => void startLiveChat()}
              disabled={liveBusy}
              className="mt-3 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/30 rounded-full px-3 py-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {liveBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Headset className="w-3.5 h-3.5" />
              )}
              Chat with a real person
            </button>
          )}

          {activeTab === "messages" && !live && (
            <button
              onClick={() => setActiveTab("home")}
              className="mt-3 flex items-center gap-1.5 text-xs text-white/85 hover:text-white bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-full transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go Home</span>
            </button>
          )}
        </div>

        {/* Overlapping Floating Avatar */}
        <div className="absolute top-[82px] left-1/2 -translate-x-1/2 z-10">
          {botConfig.logo ? (
            <img
              src={botConfig.logo}
              alt="Logo"
              className="w-16 h-16 rounded-full border-4 border-slate-50 dark:border-zinc-900 object-cover shadow-md"
              style={{ backgroundColor: logoBgColor }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full border-4 border-slate-50 dark:border-zinc-900 shadow-md flex items-center justify-center text-slate-800 font-bold text-xl transition-all duration-350"
              style={{ backgroundColor: logoBgColor }}
            >
              {botConfig.name ? botConfig.name.substring(0, 1).toUpperCase() : "A"}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-5 pt-12 pb-4 relative min-h-0 bg-white dark:bg-zinc-950 rounded-t-[24px] mt-[-28px] z-2 flex flex-col">
          {activeTab === "home" && !live ? (
            <div className="space-y-6 animate-fadeIn py-2 flex-1">
              {/* Greetings block */}
              <div className="text-center space-y-2 mt-2">
                <h4 className="font-bold text-lg leading-snug">{welcomeTitle}</h4>
                <p className="text-sm text-slate-500 dark:text-zinc-400 px-2 leading-relaxed">
                  {welcomeSubtitle}
                </p>
              </div>

              {/* Suggestions */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider pl-1">
                  Suggested questions
                </p>
                <div className="flex flex-col gap-2">
                  {parsedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => void sendMessage(q)}
                      className="w-full text-left bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-100 dark:border-zinc-800 rounded-2xl px-4 py-3 text-sm font-medium transition-all hover:translate-y-[-1px] active:translate-y-0 flex items-center justify-between"
                    >
                      <span>{q}</span>
                      <span className="text-slate-400 dark:text-zinc-500 font-bold">&rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 min-h-0 min-w-0">
              {/* Live chat status banner */}
              {live && (
                <div className={`rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs font-medium border ${liveActive
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  }`}>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${liveActive ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                    {liveActive
                      ? "You're connected with a support agent."
                      : "Connecting you to a real person… please wait."}
                  </span>
                  <button
                    onClick={() => {
                      stopLiveChat(true, "visitor-switched-to-ai");
                      appendMessage("bot", "You've switched back to AI conversation. How can I help?");
                    }}
                    className="underline underline-offset-2 hover:opacity-70"
                  >
                    Back to AI conversation
                  </button>
                </div>
              )}

              {/* Messages list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0 scrollbar-thin">
                {messages.map((msg, i) => {
                  const isUser = msg.role === "user";
                  const timeLabel = formatTimeAgo(msg.createdAt, nowMs);
                  return (
                    <div key={i} className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                      <div className={`flex items-end gap-2.5 max-w-full ${isUser ? "justify-end" : ""}`}>
                        {!isUser && (
                          <div
                            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-slate-800 text-[10px] font-bold overflow-hidden shadow-xs"
                            style={{ backgroundColor: logoBgColor }}
                          >
                            {botConfig.logo ? (
                              <img src={botConfig.logo} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                              botConfig.name.substring(0, 1).toUpperCase()
                            )}
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-[18px] px-4 py-2.5 text-sm leading-relaxed ${isUser
                              ? "bg-slate-800 text-white rounded-br-none dark:bg-zinc-800"
                              : "bg-slate-100 text-slate-800 rounded-bl-none dark:bg-zinc-900 dark:text-zinc-100"
                            }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.contacts && msg.contacts.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2.5">
                              {msg.contacts.map((contact, ci) => (
                                <a
                                  key={ci}
                                  href={fallbackContactHref(contact.type, contact.value)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
                                >
                                  {contact.type === "WHATSAPP" && <MessageSquare className="w-3 h-3" />}
                                  {contact.type === "EMAIL" && <User className="w-3 h-3" />}
                                  {fallbackContactLabel(contact.type)}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {timeLabel ? (
                        <span
                          className={`text-[10px] text-slate-400 dark:text-zinc-500 opacity-85 ${isUser ? "px-1" : "pl-10"
                            }`}
                        >
                          {timeLabel}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {ownerTyping && (
                  <div className="flex items-end gap-2.5">
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-slate-800 text-[10px] font-bold overflow-hidden shadow-xs"
                      style={{ backgroundColor: logoBgColor }}
                    >
                      {botConfig.logo ? (
                        <img src={botConfig.logo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        botConfig.name.substring(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="bg-slate-100 dark:bg-zinc-900 rounded-[18px] rounded-bl-none px-4 py-3 flex gap-1 items-center">
                      <span className="w-2 h-2 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:300ms]" />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-1">Support agent typing…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Type Area */}
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 mt-auto shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 rounded-full px-3 py-1.5 border border-slate-100 dark:border-zinc-800">
                <input
                  type="text"
                  placeholder={liveActive ? "Type your message to the agent…" : `Ask ${botConfig.name}...`}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (liveActive) notifyVisitorTypingActivity();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={sending || liveBusy || liveWaiting}
                  className="flex-1 bg-transparent border-0 outline-none text-xs focus:ring-0 placeholder-slate-400"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || sending || liveBusy || liveWaiting}
                  className="p-2 rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: themeColor }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {botConfig.showBranding !== false && (
              <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500 mt-2">
                Powered by{" "}
                <a
                  href="https://botwebai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline font-semibold"
                >
                  BotWebAI
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="h-16 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex items-center justify-around px-6 shrink-0 z-10">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === "home" && !live ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-zinc-500"
              }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center gap-1.5 transition-colors ${activeTab === "messages" || live ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-zinc-500"
              }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Messages</span>
          </button>
        </div>
      </div>
    </div>
  );
}
