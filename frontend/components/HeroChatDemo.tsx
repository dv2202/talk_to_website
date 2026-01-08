"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, BookOpen, Zap, Minus, X } from "lucide-react";
import {
  BRAND_GREEN,
  BRAND_GREEN_DARK,
  BRAND_GREEN_LIGHT,
  BRAND_GREEN_SURFACE,
} from "@/lib/brand-colors";

type DemoMessage = {
  id: number;
  role: "bot" | "user";
  text: string;
  source?: string;
  badge?: string;
};

const GREETING = "Hi! How can I help you today? 👋";

const CONVERSATIONS: { question: string; answer: string; source: string; badge: string }[] = [
  {
    question: "How do I add the chat widget to my site?",
    answer:
      "Just paste one script tag before the closing body tag. I can generate your embed code right now — setup takes about 5 minutes.",
    source: "From: Setup Guide",
    badge: "Resolved instantly",
  },
  {
    question: "Does it read from my existing docs?",
    answer:
      "Yes! Paste your website URL and we automatically crawl your docs, FAQs, and help articles. Answers are grounded via our RAG engine — not guessed.",
    source: "From: Knowledge Base Docs",
    badge: "RAG-grounded answer",
  },
  {
    question: "What happens when AI isn't sure?",
    answer:
      "When confidence is low, it escalates to your team with full conversation context instead of making something up. You stay in control.",
    source: "From: Escalation Policy",
    badge: "Smart handoff enabled",
  },
];

let messageIdCounter = 0;
function nextMessageId() {
  messageIdCounter += 1;
  return messageIdCounter;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/25 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/25 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/25 [animation-delay:300ms]" />
    </div>
  );
}

function AiAvatar() {
  return (
    <div
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white shadow-sm ring-2 ring-white"
      style={{ backgroundColor: BRAND_GREEN }}
    >
      AI
    </div>
  );
}

export function HeroChatDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    { id: nextMessageId(), role: "bot", text: GREETING },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTypingInput, setIsTypingInput] = useState(false);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [streamingBotText, setStreamingBotText] = useState("");
  const runIdRef = useRef(0);

  useEffect(() => {
    const runId = ++runIdRef.current;
    const isActive = () => runIdRef.current === runId;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (isActive()) resolve();
        }, ms);
      });

    const typeIntoInput = async (text: string) => {
      if (!isActive()) return;
      setIsTypingInput(true);
      setInputText("");
      for (let i = 0; i <= text.length; i++) {
        if (!isActive()) return;
        setInputText(text.slice(0, i));
        await wait(35 + Math.random() * 25);
      }
      setIsTypingInput(false);
      await wait(400);
    };

    const streamBotReply = async (text: string, source: string, badge: string) => {
      if (!isActive()) return;
      setIsBotThinking(true);
      setStreamingBotText("");
      await wait(600);
      if (!isActive()) return;
      setIsBotThinking(false);

      for (let i = 0; i <= text.length; i++) {
        if (!isActive()) return;
        setStreamingBotText(text.slice(0, i));
        await wait(18 + Math.random() * 12);
      }

      if (!isActive()) return;
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role: "bot", text, source, badge },
      ]);
      setStreamingBotText("");
    };

    const runLoop = async () => {
      await wait(1200);
      if (!isActive()) return;

      while (isActive()) {
        for (const conv of CONVERSATIONS) {
          if (!isActive()) return;

          // One exchange at a time so the panel never needs to scroll
          setMessages([{ id: nextMessageId(), role: "bot", text: GREETING }]);
          await wait(600);
          if (!isActive()) return;

          await typeIntoInput(conv.question);
          if (!isActive()) return;

          setInputText("");
          setMessages((prev) => [
            ...prev,
            { id: nextMessageId(), role: "user", text: conv.question },
          ]);
          await wait(300);

          await streamBotReply(conv.answer, conv.source, conv.badge);
          if (!isActive()) return;

          await wait(2800);
        }
      }
    };

    void runLoop();

    return () => {
      runIdRef.current += 1;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[400px] lg:ml-auto">
      <div
        className="relative flex h-[480px] flex-col overflow-hidden rounded-[1.5rem] border border-black/8 bg-white shadow-[0_40px_90px_-40px_rgba(48,119,102,0.55),0_18px_40px_-24px_rgba(0,0,0,0.18)] sm:h-[460px] sm:rounded-[1.75rem] lg:h-[520px] dark:border-white/10 dark:bg-zinc-900"
      >
        {/* Soft sheen on the frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
        />

        {/* Header */}
        <div
          className="relative shrink-0 overflow-hidden px-4 pt-4 pb-3.5"
          style={{
            background: `linear-gradient(145deg, ${BRAND_GREEN_DARK} 0%, ${BRAND_GREEN} 48%, ${BRAND_GREEN_LIGHT} 140%)`,
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-12 left-8 h-24 w-40 rounded-full bg-black/10 blur-2xl"
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative shrink-0">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                  <Bot className="h-5 w-5 text-white" strokeWidth={2} />
                </div>
                <span
                  className="absolute -right-0.5 -bottom-0.5 h-3 w-3 animate-[hero-online-pulse_2s_ease-out_infinite] rounded-full border-2 bg-[#7dffb3]"
                  style={{ borderColor: BRAND_GREEN_DARK }}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight text-white">
                  BotWebAI
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/80">
                  <span className="font-medium text-[#b8f5d4]">Online</span>
                  <span className="text-white/35">·</span>
                  <span>Answers from your docs</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 pt-0.5">
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-full text-white/55 transition-colors"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/70 ring-1 ring-white/15"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </div>
          </div>
        </div>

        {/* Messages — overflow locked; demo shows one exchange at a time */}
        <div className="chat-wallpaper min-h-0 flex-1 space-y-3.5 overflow-hidden px-4 py-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === "bot" ? (
                <div className="flex items-end gap-2">
                  <AiAvatar />
                  <div className="max-w-[82%] rounded-2xl rounded-bl-md border border-black/6 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-black/85 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pl-10">
                  <div
                    className="max-w-full rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-[0_8px_20px_-12px_rgba(48,119,102,0.7)]"
                    style={{
                      background: `linear-gradient(145deg, ${BRAND_GREEN} 0%, ${BRAND_GREEN_DARK} 100%)`,
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              )}

              {msg.role === "bot" && msg.source && (
                <div className="mt-1.5 flex items-center gap-2 pl-9">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white/90 px-2.5 py-1 text-[11px] text-black/55 shadow-sm dark:border-white/10 dark:bg-zinc-800 dark:text-white/60">
                    {msg.source.startsWith("Action") ? (
                      <Zap className="h-3 w-3" />
                    ) : (
                      <BookOpen className="h-3 w-3" />
                    )}
                    {msg.source}
                  </div>
                </div>
              )}

              {msg.role === "bot" && msg.badge && (
                <div className="mt-1.5 flex pl-9">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ backgroundColor: BRAND_GREEN_SURFACE, color: BRAND_GREEN_DARK }}
                  >
                    <span className="text-[10px]">✓</span>
                    {msg.badge}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isBotThinking && (
            <div className="flex items-end gap-2">
              <AiAvatar />
              <div className="rounded-2xl rounded-bl-md border border-black/6 bg-white px-3.5 py-2.5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
                <TypingDots />
              </div>
            </div>
          )}

          {streamingBotText && (
            <div className="flex items-end gap-2">
              <AiAvatar />
              <div className="max-w-[82%] rounded-2xl rounded-bl-md border border-black/6 bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100">
                {streamingBotText}
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-black/40 dark:bg-white/40" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-black/6 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center gap-2 rounded-2xl border border-black/8 bg-[#f7f7f3] px-2 py-1.5 pl-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-white/10 dark:bg-zinc-950">
            <div className="min-w-0 flex-1 text-sm">
              {inputText ? (
                <span className="block truncate text-black/80 dark:text-white/80">
                  {inputText}
                  {isTypingInput && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-black/50 dark:bg-white/50" />
                  )}
                </span>
              ) : (
                <span className="text-black/35 dark:text-white/35">Ask anything...</span>
              )}
            </div>
            <button
              type="button"
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white transition-transform"
              style={{
                background: `linear-gradient(145deg, ${BRAND_GREEN_LIGHT} 0%, ${BRAND_GREEN} 55%, ${BRAND_GREEN_DARK} 100%)`,
                boxShadow: "0 8px 16px -8px rgba(48,119,102,0.8)",
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
