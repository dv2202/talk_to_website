import { Copy, Mic, Paperclip, ThumbsDown, ThumbsUp } from "lucide-react";
import { BRAND_GREEN, BRAND_GREEN_DARK, BRAND_GREEN_LIGHT } from "@/lib/brand-colors";

const trustMarks = [
  "RAG Engine",
  "10-min Setup",
  "Source Citations",
  "Smart Escalation",
  "API Ready",
  "Encrypted",
  "Multilingual",
  "Analytics",
  "Knowledge Sync",
  "Embed Widget",
];

export function AuthMarketingPanel() {
  return (
    <div
      className="relative hidden h-full min-h-screen flex-col overflow-hidden lg:flex"
      style={{
        backgroundColor: BRAND_GREEN_DARK,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 40%, ${BRAND_GREEN}88, transparent 70%)`,
        }}
      />

      <div className="relative flex flex-1 items-center justify-center px-10 py-20">
        <div className="relative w-full max-w-[340px] ">
          {/* Actions card — floats top-left, drifts L↔R / up↔down */}
          <div className="absolute -left-20 -top-6 z-10 w-[140px] animate-[auth-float-a_5.5s_ease-in-out_infinite] rounded-xl border border-black/5 bg-white p-3 shadow-xl shadow-black/20 will-change-transform">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Actions
            </p>
            <div className="flex items-center gap-1.5">
              {["#611f69", "#006bff", "#96bf48"].map((color) => (
                <div
                  key={color}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-100 bg-zinc-50"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Analytics card — floats bottom-right, opposite drift */}
          <div className="absolute -bottom-8 -right-16 z-10 w-[150px] animate-[auth-float-b_7s_ease-in-out_infinite] rounded-xl border border-black/5 bg-white p-3 shadow-xl shadow-black/20 will-change-transform">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Analytics
            </p>
            <svg viewBox="0 0 120 48" className="h-12 w-full" aria-hidden>
              <defs>
                <linearGradient id="auth-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND_GREEN_LIGHT} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={BRAND_GREEN_LIGHT} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 36 C16 34, 24 18, 40 20 C56 22, 64 8, 80 12 C96 16, 104 6, 120 10 L120 48 L0 48 Z"
                fill="url(#auth-chart-fill)"
              />
              <path
                d="M0 36 C16 34, 24 18, 40 20 C56 22, 64 8, 80 12 C96 16, 104 6, 120 10"
                fill="none"
                stroke={BRAND_GREEN}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Chat preview card */}
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/25">
            <div className="space-y-4 p-5 pb-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-800">
                  What can you do?
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    className="grid h-6 w-6 place-items-center rounded-md text-[9px] font-bold text-white"
                    style={{ backgroundColor: BRAND_GREEN }}
                  >
                    AI
                  </div>
                  <span className="text-xs font-semibold text-zinc-800">AI Agent</span>
                </div>
                <div className="rounded-2xl rounded-tl-md border border-zinc-100 bg-zinc-50 px-3.5 py-3 text-sm leading-relaxed text-zinc-700">
                  BotWebAI is an AI support platform trained on your docs. Embed a chat
                  widget on your site or connect via API — answers stay grounded in your knowledge
                  base.
                </div>
                <div className="flex items-center gap-3 pl-1 text-zinc-400">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <ThumbsDown className="h-3.5 w-3.5" />
                  <Copy className="h-3.5 w-3.5" />
                  <span className="ml-auto text-[11px]">Just now</span>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-100 px-3 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
                <Paperclip className="h-4 w-4 text-zinc-400" />
                <span className="flex-1 text-sm text-zinc-400">Ask a question...</span>
                <Mic className="h-4 w-4 text-zinc-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 px-10 py-8">
        <div className="grid grid-cols-5 gap-x-4 gap-y-5">
          {trustMarks.map((label) => (
            <p
              key={label}
              className="text-center text-[11px] font-medium tracking-wide text-white/55"
            >
              {label}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
