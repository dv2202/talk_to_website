"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Database,
  FileText,
  Globe,
  Layers,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  Zap,
} from "lucide-react";
import { HeroChatDemo } from "@/components/HeroChatDemo";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingNav } from "@/components/MarketingNav";
import { Button } from "@/components/ui/button";
import { formatPlanPrice, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const stats = [
  { value: "10 min", label: "average setup", brand: "STARTUP" },
  { value: "62%", label: "instant answers", brand: "KNOWLEDGE" },
  { value: "1 script", label: "to go live", brand: "EMBED" },
  { value: "24/7", label: "grounded support", brand: "RAG" },
];

const capabilities = [
  {
    number: "01",
    title: "RAG-grounded answers",
    copy: "Every response is retrieved from your knowledge base — not hallucinated from general training data.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Three-tier intelligence",
    copy: "Instant lookup, pattern matching, then deep reasoning. Use the cheapest option first, escalate only when needed.",
    icon: Brain,
  },
  {
    number: "03",
    title: "One-script embed",
    copy: "Drop a single tag on your site. Your AI assistant goes live in minutes — no engineering sprint.",
    icon: Code2,
  },
  {
    number: "04",
    title: "Smart escalation",
    copy: "When confidence is low, hand off to your team with full context instead of guessing and embarrassing your brand.",
    icon: MessageSquare,
  },
];

const steps = [
  {
    roman: "I",
    title: "Connect your content",
    copy: "Paste your URL or upload docs. We crawl, chunk, and embed your knowledge automatically.",
  },
  {
    roman: "II",
    title: "Set your guardrails",
    copy: "Define tone, escalation rules, and what your AI can and cannot say.",
  },
  {
    roman: "III",
    title: "Ship to your site",
    copy: "Add one script tag. Visitors get accurate, sourced answers in under 30 seconds of setup.",
  },
];

const widgetEmbedSnippet = `<script
  src="https://botwebai.com/api/widget/widget.js"
  data-bot="bot-name"
  data-api-key="ttw_0b5e3a4619d048b7495af65573"
></script>`;

const ragPipeline = [
  { icon: FileText, label: "Knowledge Sources", sub: "PDF, TXT, URLs" },
  { icon: Layers, label: "Smart Chunking", sub: "1,000 tokens + overlap" },
  { icon: Database, label: "Vector Embeddings", sub: "Gemini / OpenAI" },
  { icon: Search, label: "Similarity Search", sub: "Top-K retrieval" },
  { icon: RefreshCw, label: "Incremental Sync", sub: "Hash-based updates" },
  { icon: Zap, label: "Grounded Response", sub: "Source attribution" },
];

const securityItems = [
  {
    title: "Your data stays yours",
    copy: "Knowledge and conversations are only used for your assistants — never to train foundation models.",
  },
  {
    title: "Encryption everywhere",
    copy: "AES-256 at rest and TLS in transit. Industry-standard protection across the stack.",
  },
  {
    title: "Tenant isolation",
    copy: "Per-assistant API keys and isolated data so users only access what they own.",
  },
  {
    title: "Authenticated routes",
    copy: "Management APIs require auth. Widget traffic uses scoped keys — no open backdoors.",
  },
];

const testimonials = [
  {
    quote:
      "We considered building RAG in-house. The estimate was 4 months and two senior engineers. BotWebAI gave us grounded AI support in a single afternoon.",
    name: "James Miller",
    role: "CTO, SaaS startup",
    result: "Months of eng → one afternoon",
  },
  {
    quote:
      "Setup took under ten minutes. Paste the URL, drop the script, and our docs started answering real customer questions with sources attached.",
    name: "Sarah Chen",
    role: "Head of Support, Meridian",
    result: "10× faster first response",
  },
  {
    quote:
      "The escalation handoff is the killer feature. When AI isn't sure, our team gets full context instead of a confused customer.",
    name: "Alex Rivera",
    role: "Founder, Flux Systems",
    result: "Higher CSAT, fewer tickets",
  },
];

const faqs = [
  {
    q: "Will the AI give wrong answers?",
    a: "BotWebAI uses RAG-grounded resolution from your verified knowledge base. When confidence is low, it escalates to your team with full context.",
  },
  {
    q: "How long does setup take?",
    a: "Average team goes live in under 10 minutes. Paste your URL, let AI index your docs, and add one script tag.",
  },
  {
    q: "Why not build RAG in-house?",
    a: "A production RAG pipeline typically takes 3–6 months of senior engineering. We built it so you don't have to.",
  },
  {
    q: "Is the chat data secure?",
    a: "Encrypted at rest and in transit. Per-assistant API keys, authenticated management routes, and tenant-isolated data.",
  },
];

const integrations = [
  "Websites",
  "Docs",
  "PDFs",
  "FAQs",
  "Help Centers",
  "React",
  "Next.js",
  "WordPress",
  "Webhooks",
  "API",
  "Notion",
  "Markdown",
];

function AnimatedHeadline({ text }: { text: string }) {
  return (
    <span className="inline-flex">
      {text.split("").map((char, i) => (
        <span
          key={`${char}-${i}`}
          className="inline-block animate-[char-in_0.6s_cubic-bezier(0.16,1,0.3,1)_both]"
          style={{ animationDelay: `${0.04 * i}s` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}

function Marquee({
  children,
  reverse = false,
}: {
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="overflow-hidden">
      <div
        className={cn(
          "flex w-max gap-16 whitespace-nowrap",
          reverse ? "animate-[marquee-reverse_40s_linear_infinite]" : "animate-[marquee_40s_linear_infinite]"
        )}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const activeTestimonial = testimonials[testimonialIndex];

  useEffect(() => {
    const id = window.setInterval(() => {
      setTestimonialIndex((i) => (i + 1) % testimonials.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      {/* Hero */}
      <section className="relative flex flex-col justify-center overflow-hidden lg:min-h-screen">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
        <div className="pointer-events-none absolute top-1/2 right-0 h-[600px] w-[600px] -translate-y-1/2 opacity-40 lg:h-[800px] lg:w-[800px]">
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--brand-green)_18%,transparent),transparent_65%)]" />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-[1400px] items-center gap-8 px-5 pt-28 pb-10 sm:px-6 sm:gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:pt-28 lg:pb-12">
          <div className="min-w-0">
            {/* Brand is already in the fixed nav on mobile — keep hero-level brand from lg up */}
            <p className="mb-4 hidden font-display text-4xl tracking-tight text-primary lg:mb-6 lg:block animate-[fade-up_0.7s_ease_both]">
              BotWebAI
            </p>
            <div className="mb-4 flex items-center gap-3 font-mono text-[11px] leading-snug text-muted-foreground sm:text-sm lg:mb-6 animate-[fade-up_0.7s_ease_0.05s_both]">
              <span className="h-px w-6 shrink-0 bg-primary/40 sm:w-8" />
              <span className="min-w-0">The platform for modern support teams</span>
            </div>

            <h1
              id="hero-headline"
              className="mb-5 font-display text-[clamp(2.35rem,9vw,5.5rem)] leading-[1.02] tracking-tight sm:mb-6 sm:leading-[0.95] animate-[fade-up_0.7s_ease_0.1s_both]"
            >
              <span className="block">The AI</span>
              <span className="relative inline-block">
                <span className="relative z-10">
                  <AnimatedHeadline text="to support" />
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[0.12em] z-0 h-[0.32em] bg-primary/15"
                />
              </span>
            </h1>

            <p className="mb-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:mb-8 sm:text-lg lg:text-xl animate-[fade-up_0.7s_ease_0.15s_both]">
              Stop configuring chatbots. Start shipping grounded answers from your own docs —
              securely, accurately, and in minutes.
            </p>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-start sm:gap-4 animate-[fade-up_0.7s_ease_0.25s_both]">
              <Button
                asChild
                size="lg"
                className="group h-12 w-full rounded-full bg-primary px-7 text-sm text-primary-foreground hover:bg-primary/90 sm:w-auto"
                id="hero-get-started"
              >
                <Link href="/signup">
                  Start free trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-full border-primary/25 bg-transparent px-7 text-sm hover:bg-brand-surface hover:text-foreground sm:w-auto"
                id="hero-view-demo"
              >
                <Link href="/how-it-works">Watch demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[360px] animate-[fade-up_0.7s_ease_0.2s_both] sm:max-w-[400px] lg:mx-0 lg:max-w-none">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--brand-green)_26%,transparent),transparent_68%)] blur-2xl sm:-inset-10" />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-3 -right-2 hidden h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--brand-green-light)_35%,transparent),transparent_70%)] blur-xl sm:block lg:-right-4"
            />
            <div className="relative">
              <HeroChatDemo />
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-foreground/10 py-6 sm:py-8 animate-[fade-up_0.7s_ease_0.4s_both]">
          <Marquee>
            {stats.map((stat) => (
              <div key={stat.brand} className="flex items-baseline gap-3 px-4 sm:gap-4">
                <span className="font-display text-3xl text-primary sm:text-4xl lg:text-5xl">
                  {stat.value}
                </span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <span className="font-mono text-xs tracking-widest text-primary/45">
                  {stat.brand}
                </span>
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* Capabilities */}
      <section id="features" className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 max-w-3xl">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Capabilities
            </p>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Everything you need.
              <br />
              <span className="text-muted-foreground">Nothing you don&apos;t.</span>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden rounded-sm border border-foreground/10 bg-foreground/10 md:grid-cols-2">
            {capabilities.map((item) => (
              <article
                key={item.number}
                className="group bg-background p-8 transition-colors duration-300 hover:bg-secondary sm:p-10"
              >
                <div className="mb-8 flex items-start justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{item.number}</span>
                  <item.icon className="h-5 w-5 text-foreground/50 transition-colors group-hover:text-foreground" />
                </div>
                <h3 className="mb-3 font-display text-2xl tracking-tight sm:text-3xl">{item.title}</h3>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {item.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="how-it-works" className="relative z-10 border-t border-foreground/10 bg-secondary/40 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Process
              </p>
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Three steps.
                <br />
                <span className="text-muted-foreground">Infinite answers.</span>
              </h2>
            </div>
            <p className="max-w-md text-muted-foreground lg:justify-self-end">
              From empty site to live AI support without standing up a vector search team.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-6">
              {steps.map((step) => (
                <article
                  key={step.roman}
                  className="border-t border-foreground/10 pt-6 first:border-t-0 first:pt-0"
                >
                  <div className="mb-3 flex items-baseline gap-4">
                    <span className="font-mono text-sm text-muted-foreground">{step.roman}</span>
                    <h3 className="font-display text-2xl tracking-tight">{step.title}</h3>
                  </div>
                  <p className="max-w-md pl-10 text-sm leading-relaxed text-muted-foreground">
                    {step.copy}
                  </p>
                </article>
              ))}
            </div>

            <div className="overflow-hidden rounded-sm border border-foreground/10 bg-primary text-primary-foreground">
              <div className="flex items-center justify-between border-b border-white/15 px-5 py-3">
                <span className="font-mono text-xs text-white/70">layout.html</span>
                <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-wider text-white uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  Ready
                </span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/90">
{widgetEmbedSnippet}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* RAG Infrastructure */}
      <section id="rag" className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 max-w-3xl">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Infrastructure
            </p>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Production RAG
              <br />
              <span className="text-muted-foreground">by default.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Chunking, embeddings, vector search, incremental sync, and prompt construction —
              engineered so you ship grounded answers on day one.
            </p>
          </div>

          <div className="mb-12 grid gap-6 sm:grid-cols-3">
            {[
              { value: "1,000", label: "Token chunks" },
              { value: "0.75", label: "Confidence threshold" },
              { value: "Top-5", label: "Similarity retrieval" },
            ].map((stat) => (
              <div key={stat.label} className="border-t border-foreground/15 pt-5">
                <p className="font-display text-4xl tracking-tight lg:text-5xl">{stat.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ragPipeline.map((step) => (
              <div
                key={step.label}
                className="flex items-center gap-4 border border-foreground/10 bg-secondary/30 px-5 py-4"
              >
                <div className="grid h-10 w-10 place-items-center border border-foreground/10 bg-background">
                  <step.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{step.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="relative z-10 border-t border-foreground/10 py-20">
        <div className="mx-auto mb-12 max-w-[1400px] px-6 text-center lg:px-12">
          <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Integrations
          </p>
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
            Works with everything
            <br />
            <span className="text-muted-foreground">you already use.</span>
          </h2>
        </div>
        <Marquee>
          {integrations.map((name) => (
            <div
              key={name}
              className="flex min-w-[160px] flex-col items-center justify-center border border-foreground/10 px-8 py-6"
            >
              <Globe className="mb-3 h-5 w-5 text-foreground/40" />
              <span className="text-sm font-medium">{name}</span>
            </div>
          ))}
        </Marquee>
        <div className="mt-4">
          <Marquee reverse>
            {[...integrations].reverse().map((name) => (
              <div
                key={`rev-${name}`}
                className="flex min-w-[160px] flex-col items-center justify-center border border-foreground/10 px-8 py-6"
              >
                <Layers className="mb-3 h-5 w-5 text-foreground/40" />
                <span className="text-sm font-medium">{name}</span>
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 grid gap-8 lg:grid-cols-2">
            <div>
              <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Security
              </p>
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Trust is
                <br />
                <span className="text-muted-foreground">non-negotiable.</span>
              </h2>
            </div>
            <p className="max-w-md self-end text-muted-foreground lg:justify-self-end">
              Enterprise-minded security is built into every layer — from infrastructure to the
              widget your visitors see.
            </p>
          </div>

          <div className="mb-10 flex flex-wrap gap-3">
            {["Encryption", "API keys", "Tenant isolation", "TLS 1.3", "Auth routes"].map(
              (badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-2 font-mono text-xs tracking-wider uppercase"
                >
                  <Shield className="h-3.5 w-3.5" />
                  {badge}
                </span>
              )
            )}
          </div>

          <div className="grid gap-px overflow-hidden border border-foreground/10 bg-foreground/10 sm:grid-cols-2">
            {securityItems.map((item) => (
              <article key={item.title} className="bg-background p-8 sm:p-10">
                <Lock className="mb-6 h-5 w-5 text-foreground/50" />
                <h3 className="mb-3 font-display text-2xl tracking-tight">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
                What people say
              </p>
              <p className="font-mono text-sm text-muted-foreground">
                {String(testimonialIndex + 1).padStart(2, "0")} /{" "}
                {String(testimonials.length).padStart(2, "0")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() =>
                  setTestimonialIndex((i) => (i - 1 + testimonials.length) % testimonials.length)
                }
                className="grid h-10 w-10 place-items-center border border-foreground/15 transition hover:bg-secondary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() => setTestimonialIndex((i) => (i + 1) % testimonials.length)}
                className="grid h-10 w-10 place-items-center border border-foreground/15 transition hover:bg-secondary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <blockquote className="max-w-4xl">
            <p className="font-display text-3xl leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">
              &ldquo;{activeTestimonial.quote}&rdquo;
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary font-display text-lg text-primary-foreground">
                {activeTestimonial.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{activeTestimonial.name}</p>
                <p className="text-sm text-muted-foreground">{activeTestimonial.role}</p>
              </div>
              <div className="ml-auto border border-foreground/10 px-5 py-3">
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  Key Result
                </p>
                <p className="mt-1 text-sm font-medium">{activeTestimonial.result}</p>
              </div>
            </div>
          </blockquote>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 border-t border-foreground/10 bg-secondary/30 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 text-center">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Pricing
            </p>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Simple, transparent
              <br />
              <span className="text-muted-foreground">pricing</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
              Start free and scale as you grow. No hidden fees, no surprises.
            </p>
          </div>

          <div className="grid items-center gap-4 lg:grid-cols-3 lg:gap-6">
            {PLANS.map((plan, index) => (
              <article
                key={plan.id}
                className={cn(
                  "relative flex flex-col border border-foreground/10 bg-background p-8",
                  plan.popular &&
                    "z-10 border-primary shadow-lg lg:-translate-y-2 lg:scale-[1.03] lg:px-9 lg:py-10"
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-8 bg-primary px-3 py-1 font-mono text-[10px] tracking-wider text-primary-foreground uppercase">
                    Most Popular
                  </span>
                )}
                <p className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 font-display text-3xl tracking-tight">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-8 font-display text-4xl tracking-tight">
                  {formatPlanPrice(plan)}
                  {plan.isPaid && (
                    <span className="ml-1 font-sans text-base text-muted-foreground">/month</span>
                  )}
                </p>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={cn(
                    "mt-8 h-11 w-full rounded-full",
                    plan.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-foreground/20 bg-transparent text-foreground hover:bg-secondary"
                  )}
                >
                  <Link href="/signup">{plan.isPaid ? "Start trial" : "Start free"}</Link>
                </Button>
              </article>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            All plans include HTTPS, knowledge sync, and dashboard analytics.{" "}
            <Link href="/plans" className="underline underline-offset-4 hover:text-foreground">
              Compare all features
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              FAQ
            </p>
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
              Got questions?
              <br />
              <span className="text-muted-foreground">We&apos;ve got answers.</span>
            </h2>
          </div>
          <div className="grid gap-px overflow-hidden border border-foreground/10 bg-foreground/10 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="bg-background p-8">
                <h3 className="font-display text-xl tracking-tight">{item.q}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 text-center lg:px-12">
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
            Ready to build
            <br />
            <span className="text-muted-foreground">something great?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Join teams shipping faster support with BotWebAI. Start free, scale infinitely.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
              id="cta-get-started"
            >
              <Link href="/signup">Start building free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-foreground/20 px-8"
              id="cta-view-demo"
            >
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </div>
          <p className="mt-6 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            No credit card required
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
