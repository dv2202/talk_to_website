"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, Send, Home, MessageSquare, ChevronDown, X, ArrowLeft, AlertCircle, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { formatTimeAgo } from "@/lib/format-time-ago";
import { WidgetLauncherLogo, resolveWidgetLauncherBg } from "@/components/WidgetLauncherLogo";
import {
  buildFallbackContactHref,
  FALLBACK_CONTACT_LABELS,
  type FallbackContactTypeValue,
} from "@/lib/fallback-contact";

interface Message {
  role: "user" | "bot" | "system";
  content: string;
  createdAt?: string;
  fallbackContacts?: Array<{
    type: FallbackContactTypeValue;
    value: string;
  }> | null;
}

interface ChatWidgetPreviewProps {
  name: string;
  logo: string | null;
  themeColor: string;
  logoBgColor?: string | null;
  widgetLogo?: string | null;
  widgetLogoBgColor?: string | null;
  welcomeTitle: string | null;
  welcomeSubtitle: string | null;
  quickQuestions: string;
  teaserMessage?: string | null;
  teaserDelay?: number | null;
  knowledgeSourcesCount: number;
  botId?: string | null;
  botName?: string | null;
  widgetPosition?: string;
  inline?: boolean;
}

export function ChatWidgetPreview({
  name,
  logo,
  themeColor,
  logoBgColor,
  widgetLogo,
  widgetLogoBgColor,
  welcomeTitle,
  welcomeSubtitle,
  quickQuestions,
  teaserMessage,
  teaserDelay,
  knowledgeSourcesCount,
  botId,
  botName,
  widgetPosition,
  inline = false,
}: ChatWidgetPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"home" | "messages">("home");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(Boolean(botId));
  const [isTeaserVisible, setIsTeaserVisible] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const playChatSound = (role: "user" | "bot") => {
    try {
      const audio = new Audio(role === "user" ? "/user.mp3" : "/bot.mp3");
      audio.volume = 0.6;
      void audio.play().catch(() => {});
    } catch {
      // Ignore autoplay / missing file errors
    }
  };

  useEffect(() => {
    if (inline || !teaserMessage || isOpen || widgetPosition === "CENTER") {
      setIsTeaserVisible(false);
      return;
    }

    // In preview mode, show the teaser bubble immediately for instant feedback.
    // Do not play sound here — typing in the edit form re-runs this effect.
    setIsTeaserVisible(true);
  }, [inline, teaserMessage, isOpen, widgetPosition]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const defaultColor = themeColor || "#2563eb";
  const defaultLogoBg = logoBgColor || "#ffffff";
  // Widget launcher uses its own logo only — no chat-logo fallback
  const defaultWidgetLogo = widgetLogo || null;
  const defaultWidgetBg = resolveWidgetLauncherBg(widgetLogoBgColor, defaultWidgetLogo);
  const isCenter = widgetPosition === "CENTER";
  const open = inline || isOpen;
  const finalWelcomeTitle = welcomeTitle || `Hi, I'm ${name || "AI"}'s agent 👋`;
  const finalWelcomeSubtitle = welcomeSubtitle || "I can answer anything about how we work, what it costs, or how we compare. What brings you in?";
  const parsedQuestions = quickQuestions
    ? quickQuestions.split(",").map((q) => q.trim()).filter(Boolean)
    : ["What do you do?", "How can you help me?", "Tell me more"];

  // Restore prior conversation after refresh (preview session is stable per bot)
  useEffect(() => {
    const greeting: Message = {
      role: "bot",
      content: `Hi! I am ${name || "your AI Assistant"}. How can I help you today?`,
      createdAt: new Date().toISOString(),
    };

    if (!botId) {
      setIsLoadingHistory(false);
      setMessages([greeting]);
      return;
    }

    let cancelled = false;
    setIsLoadingHistory(true);

    (async () => {
      try {
        const conversations = await api.getConversations(botId, {
          sessionId: `preview_${botId}`,
        });
        if (cancelled) return;

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
        if (!cancelled) setMessages([greeting]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [botId, name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const handleSendMessage = async (textToSubmit?: string) => {
    const text = (textToSubmit || input).trim();
    if (!text || sending) return;

    const sentAt = new Date().toISOString();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text, createdAt: sentAt }]);
    playChatSound("user");
    setActiveTab("messages"); // automatically switch to chat view
    setSending(true);

    try {
      if (knowledgeSourcesCount === 0) {
        // Warning if no knowledge base is present
        await new Promise((resolve) => setTimeout(resolve, 800));
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "⚠️ Please add a knowledge base so that the AI can answer your questions.",
            createdAt: new Date().toISOString(),
          },
        ]);
        playChatSound("bot");
      } else if (!botId) {
        // Bot is not saved yet (Step 1 or unsaved changes)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content: `This is a preview response. Once you finish setting up, I'll answer questions using the knowledge base you configure!`,
            createdAt: new Date().toISOString(),
          },
        ]);
        playChatSound("bot");
      } else {
        // Call the actual chat API with streaming
        let started = false;
        await api.streamMessage(
          {
            botId,
            botName: botName || undefined,
            message: text,
            sessionId: `preview_${botId}`,
          },
          {
            onToken: (token) => {
              if (!started) {
                started = true;
                playChatSound("bot");
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
              const contacts =
                result.fallbackContacts ??
                (result.fallbackContact ? [result.fallbackContact] : null);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "bot") {
                  next[next.length - 1] = {
                    ...last,
                    content: result.response || last.content,
                    createdAt: result.createdAt || last.createdAt,
                    fallbackContacts: contacts,
                  };
                } else if (result.response) {
                  next.push({
                    role: "bot",
                    content: result.response,
                    createdAt: result.createdAt,
                    fallbackContacts: contacts,
                  });
                }
                return next;
              });
              if (!started) {
                started = true;
                playChatSound("bot");
              }
            },
          }
        );
      }
    } catch (err) {
      console.error("Preview chat error:", err);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "bot" && last.content) {
          return prev;
        }
        return [
          ...prev,
          {
            role: "bot",
            content: "Sorry, I encountered an error. Please try again.",
            createdAt: new Date().toISOString(),
          },
        ];
      });
      playChatSound("bot");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`flex flex-col ${
        inline
          ? "relative h-full w-full"
          : `fixed z-50 pointer-events-none ${
              isCenter ? "inset-0 items-center justify-end pb-6" : "bottom-6 right-6 items-end"
            }`
      }`}
    >
      {!inline && isCenter && (
        <button
          type="button"
          aria-label="Close preview"
          onClick={() => setIsOpen(false)}
          className={`pointer-events-auto absolute inset-0 bg-transparent transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
      )}
      {/* Widget Window */}
      <div
        className={[
          "border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-zinc-900 shadow-2xl flex flex-col overflow-hidden font-sans text-slate-800 dark:text-zinc-100",
          inline
            ? "relative w-full h-full max-h-full rounded-[24px] pointer-events-auto"
            : `absolute w-[380px] h-[520px] max-h-[calc(100vh-108px)] rounded-[28px] ${
                isCenter
                  ? "origin-bottom left-1/2 bottom-[76px]"
                  : "origin-bottom-right bottom-[72px] right-0"
              } ${
                open
                  ? "opacity-100 pointer-events-auto visible"
                  : "opacity-0 pointer-events-none invisible"
              } ${
                !isCenter && (open ? "scale-100 translate-y-0" : "scale-[0.2] translate-y-3")
              }`,
        ].join(" ")}
        style={
          inline
            ? undefined
            : {
                transition:
                  "opacity 280ms cubic-bezier(0.33, 0.00, 0.00, 1.00), transform 280ms cubic-bezier(0.33, 0.00, 0.00, 1.00), visibility 280ms",
                transform: isCenter
                  ? `translateX(-50%) scale(${open ? 1 : 0.92}) translateY(${open ? 0 : 14}px)`
                  : undefined,
              }
        }
      >
        {/* Compact Header */}
        <div
          className="px-3.5 py-3 text-white relative shrink-0 transition-all duration-300"
          style={{
            background: `linear-gradient(135deg, ${defaultColor} 0%, rgba(15, 23, 42, 0.88) 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {logo ? (
                <img
                  src={logo}
                  alt="Logo"
                  className="w-9 h-9 rounded-full border-2 border-white/35 object-cover shrink-0"
                  style={{ backgroundColor: defaultLogoBg }}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full border-2 border-white/35 shrink-0 flex items-center justify-center text-slate-800 font-bold text-sm"
                  style={{ backgroundColor: defaultLogoBg }}
                >
                  {name ? name.substring(0, 1).toUpperCase() : <Bot className="w-4 h-4 text-slate-800" />}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-semibold text-sm tracking-tight truncate">
                    {name || "AI Assistant"}
                  </h3>
                  <span className="bg-white/20 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0">
                    AI
                  </span>
                </div>
                {activeTab === "home" ? (
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>AI agent • online</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveTab("home")}
                    className="mt-0.5 flex items-center gap-1 text-[11px] text-white/80 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Go Home</span>
                  </button>
                )}
              </div>
            </div>

            {!inline && (
              <button
                className="w-7.5 h-7.5 p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors shrink-0"
                onClick={() => setIsOpen(false)}
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-3 relative min-h-0 bg-white dark:bg-zinc-950 z-[2]">
          {isLoadingHistory && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 dark:bg-zinc-950/90 backdrop-blur-[2px]">
              <Loader2 className="w-9 h-9 animate-spin" style={{ color: defaultColor }} />
            </div>
          )}
          {activeTab === "home" ? (
            <div className="space-y-5 animate-fadeIn">
              {/* Greetings block */}
              <div className="text-center space-y-2 mt-1">
                <h4 className="font-bold text-base leading-snug">{finalWelcomeTitle}</h4>
                <p className="text-sm text-slate-500 dark:text-zinc-400 px-2 leading-relaxed">
                  {finalWelcomeSubtitle}
                </p>
              </div>

              {/* Quick Questions Chips */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider pl-1">
                  Suggested questions
                </p>
                <div className="flex flex-col gap-2">
                  {parsedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
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
            /* Messages view */
            <div className="h-full flex flex-col gap-3 min-h-0 animate-fadeIn">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0 scrollbar-thin">
                {messages.map((msg, idx) => {
                  if (msg.role === "system") {
                    return (
                      <div key={idx} className="flex gap-2 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs items-start leading-relaxed">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                        <span>{msg.content}</span>
                      </div>
                    );
                  }
                  const isUser = msg.role === "user";
                  const timeLabel = formatTimeAgo(msg.createdAt, nowMs);
                  const contacts = msg.fallbackContacts;
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className={`flex items-end gap-2 w-full max-w-full ${isUser ? "justify-end" : ""}`}>
                        {!isUser && (
                          <div
                            className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-slate-800 text-[10px] font-bold overflow-hidden shadow-xs"
                            style={{ backgroundColor: defaultLogoBg }}
                          >
                            {logo ? (
                              <img src={logo} alt="Logo" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              name ? name.substring(0, 1).toUpperCase() : "A"
                            )}
                          </div>
                        )}
                        <div
                          className={`w-fit max-w-[min(78%,280px)] min-w-0 rounded-2xl px-3.5 py-2 text-[13px] leading-snug wrap-break-word whitespace-pre-wrap ${
                            isUser
                              ? "text-white rounded-br-sm"
                              : "bg-slate-100 text-slate-800 rounded-bl-sm dark:bg-zinc-900 dark:text-zinc-100"
                          }`}
                          style={isUser ? { backgroundColor: defaultColor } : undefined}
                        >
                          {msg.content}
                        </div>
                      </div>
                      {contacts && contacts.length > 0 && !isUser ? (
                        <div className="ml-9 flex flex-wrap gap-1.5">
                          {contacts.map((contact) => {
                            const ContactIcon =
                              contact.type === "EMAIL"
                                ? Mail
                                : contact.type === "WHATSAPP"
                                  ? MessageCircle
                                  : contact.type === "TELEGRAM"
                                    ? Send
                                    : Phone;
                            return (
                              <a
                                key={contact.type}
                                href={buildFallbackContactHref(contact.type, contact.value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                style={{ color: defaultColor }}
                              >
                                <ContactIcon className="h-3.5 w-3.5" />
                                {FALLBACK_CONTACT_LABELS[contact.type]}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                      {timeLabel ? (
                        <span
                          className={`text-[10px] text-slate-400 dark:text-zinc-500 opacity-85 ${
                            isUser ? "px-1" : "pl-9"
                          }`}
                        >
                          {timeLabel}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex items-end gap-2">
                    <div
                      className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-slate-800 text-[10px] font-bold overflow-hidden shadow-xs"
                      style={{ backgroundColor: defaultLogoBg }}
                    >
                      {logo ? (
                        <img src={logo} alt="Logo" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        name ? name.substring(0, 1).toUpperCase() : "A"
                      )}
                    </div>
                    <div className="bg-slate-100 dark:bg-zinc-900 rounded-2xl rounded-bl-sm px-3.5 py-2.5 inline-flex gap-1.5 items-center whitespace-nowrap w-max shrink-0">
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:300ms]" />
                      <span className="text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap">Typing…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Preview-only input bar (only visible in active chat) */}
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-3">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 rounded-full px-3 py-1.5 border border-slate-100 dark:border-zinc-800">
                  <input
                    type="text"
                    placeholder={`Ask ${name || "support"}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    disabled={sending || isLoadingHistory}
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-xs focus:ring-0 placeholder-slate-400"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || sending || isLoadingHistory}
                    className="p-2 rounded-full text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 shrink-0"
                    style={{ backgroundColor: defaultColor }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interactive Bottom Tabs */}
        <div className="h-16 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex items-center justify-around px-6 shrink-0 z-10">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              activeTab === "home" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-zinc-500"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              activeTab === "messages" ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-zinc-500"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Messages</span>
          </button>
        </div>
      </div>

      {/* Teaser Bubble Preview — Intercom-style: logo on top + suggested chips */}
      {!inline && isTeaserVisible && teaserMessage && (
        <div className="pointer-events-auto absolute bottom-[72px] right-0 mb-2 flex flex-col items-end gap-2 max-w-[min(320px,calc(100vw-24px))] animate-in slide-in-from-bottom-2 duration-300">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setIsTeaserVisible(false);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsTeaserVisible(false);
                setIsOpen(true);
              }
            }}
            className="relative w-max max-w-full cursor-pointer rounded-[14px] bg-[#1a1a1a] text-white px-3 py-2 pr-9 shadow-[0_12px_32px_rgba(0,0,0,0.28)] border border-white/5 font-sans"
          >
            <div className="w-[22px] h-[22px] rounded-md overflow-hidden grid place-items-center bg-white/12 text-white text-[11px] font-bold mb-0.5">
              {logo ? (
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{name ? name.substring(0, 1).toUpperCase() : <Bot className="w-3 h-3" />}</span>
              )}
            </div>
            <p className="text-[13px] font-medium leading-tight whitespace-pre-wrap">{teaserMessage}</p>
            <p className="mt-0.5 text-[10px] font-medium leading-tight text-white/55">
              {name || "AI"} • Just now
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsTeaserVisible(false);
              }}
              className="absolute right-2 top-2 p-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors flex items-center justify-center"
              aria-label="Close message"
            >
              <X className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex flex-col items-end gap-1.5 w-full">
            {parsedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIsTeaserVisible(false);
                  setIsOpen(true);
                  void handleSendMessage(q);
                }}
                className="max-w-full rounded-full bg-[#1a1a1a] text-white text-[12px] font-medium leading-tight px-3 py-1.5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.18)] border border-white/10 hover:bg-[#2a2a2a] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Launcher Button */}
      {!inline && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`pointer-events-auto relative z-10 flex items-center justify-center cursor-pointer active:scale-95 shrink-0 transition-opacity ${
            isCenter ? "h-[42px] w-[280px] px-1.5 pl-3.5 justify-between rounded-full border shadow-2xl" : "h-14 w-14 border-0 shadow-none"
          } ${
            isCenter ? "hover:scale-[1.04]" : "hover:scale-110"
          } ${
            isCenter && isOpen ? "opacity-0 pointer-events-none" : ""
          } ${
            isOpen
              ? "rounded-full bg-white text-slate-800 border border-black/5 shadow-lg"
              : isCenter
                ? "bg-white/70 text-slate-500 border-white/70 shadow-xl backdrop-blur-xl"
                : "bg-transparent"
          }`}
          style={{
            transition: "transform 250ms cubic-bezier(0.33, 0.00, 0.00, 1.00), background-color 200ms ease, color 200ms ease",
          }}
          title={isOpen ? "Close preview" : "Open live preview chat"}
        >
          {isCenter && !isOpen && (
            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium tracking-tight">
              Continue conversation
            </span>
          )}
          {isCenter && !isOpen ? (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-200 text-[15px] font-normal leading-none text-slate-500">
              ↑
            </span>
          ) : isOpen ? (
            <ChevronDown className="w-7 h-7 transition-transform duration-200" strokeWidth={2.2} />
          ) : (
            <div className="relative w-[60px] h-[60px] flex items-center justify-center select-none shrink-0">
              <WidgetLauncherLogo
                size={60}
                bgColor={defaultWidgetBg}
                logoUrl={defaultWidgetLogo}
              />
            </div>

          )}
        </button>
      )}
    </div>
  );
}
