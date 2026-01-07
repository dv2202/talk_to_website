"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import {
  ArrowRight,
  CircleCheck,
  BookOpen,
  Brain,
  Zap,
  FileText,
  Layers,
  Database,
  Search,
  RefreshCw,
  Users,
  MessageSquare,
  BarChart3,
  Globe,
  Code2,
} from "lucide-react";

const setupSteps = [
  {
    roman: "I",
    title: "Paste your URL",
    copy: "AI crawls and indexes your docs, FAQs, and help articles automatically.",
  },
  {
    roman: "II",
    title: "Set guardrails",
    copy: "Define tone, escalation rules, and what your AI can and cannot say.",
  },
  {
    roman: "III",
    title: "One script tag",
    copy: "Add a single embed to your site. AI starts resolving instantly.",
  },
  {
    roman: "IV",
    title: "AI gets smarter",
    copy: "Knowledge updates propagate automatically. No retraining required.",
  },
];

const widgetEmbedSnippet = `<script
  src="https://botwebai.com/api/widget/widget.js"
  data-bot="bot-name"
  data-api-key="ttw_0b5e3a4619d048b7495af65573"
></script>`;

const aiTiers = [
  {
    number: "01",
    pct: "62%",
    title: "Instant Answers",
    subtitle: "Knowledge base lookup",
    copy: "Immediate responses from your knowledge base. Zero-cost, zero-latency for common questions.",
    icon: BookOpen,
  },
  {
    number: "02",
    pct: "28%",
    title: "Pattern Matching",
    subtitle: "Smart AI routing",
    copy: "Smart AI that handles routine questions automatically. Answers in under 1 second, 24/7.",
    icon: Zap,
  },
  {
    number: "03",
    pct: "10%",
    title: "Deep Reasoning",
    subtitle: "Advanced AI models",
    copy: "Advanced AI reasoning for your toughest questions. Only activated when truly needed.",
    icon: Brain,
  },
];

const accuracyItems = [
  {
    number: "01",
    title: "RAG-grounded answers",
    copy: "Every answer is grounded in your knowledge base via retrieval-augmented generation — not hallucinated from general training data.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Source attribution",
    copy: "Customers see exactly where each answer came from. Your team can verify any response in seconds.",
    icon: Search,
  },
  {
    number: "03",
    title: "Smart escalation",
    copy: "When AI isn't confident, it hands off to a human with full context — instead of guessing and embarrassing your brand.",
    icon: Users,
  },
];

const ragPipeline = [
  { icon: FileText, label: "Knowledge Sources", sub: "PDF, TXT, URLs" },
  { icon: Layers, label: "Smart Chunking", sub: "1,000 tokens + overlap" },
  { icon: Database, label: "Vector Embeddings", sub: "Gemini / OpenAI" },
  { icon: Search, label: "Similarity Search", sub: "Top-K retrieval" },
  { icon: RefreshCw, label: "Incremental Sync", sub: "Hash-based updates" },
  { icon: Zap, label: "Grounded Response", sub: "Source attribution" },
];

const features = [
  {
    number: "01",
    title: "AI Inbox",
    copy: "Every conversation in one place. AI auto-categorizes, prioritizes, and suggests responses.",
    icon: MessageSquare,
  },
  {
    number: "02",
    title: "Self-Learning Knowledge Base",
    copy: "Import docs, PDFs, and URLs. Semantic embeddings give accurate, sourced answers every time.",
    icon: BookOpen,
  },
  {
    number: "03",
    title: "Actionable Analytics",
    copy: "Track resolution rates, response times, and AI accuracy. Spot knowledge gaps before they grow.",
    icon: BarChart3,
  },
  {
    number: "04",
    title: "One Script Tag",
    copy: "Drop a single embed on your site. Your AI assistant goes live in minutes — no engineering sprint.",
    icon: Globe,
  },
];

export default function HowItWorksPage() {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      {/* Page hero */}
      <section className="relative overflow-hidden border-b border-foreground/10 pt-28 lg:pt-36">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="pointer-events-none absolute top-1/2 right-0 h-[500px] w-[500px] -translate-y-1/2 opacity-40 lg:h-[700px] lg:w-[700px]">
          <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--brand-green)_18%,transparent),transparent_65%)]" />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-6 py-16 lg:px-12 lg:py-24">
          <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            How It Works
          </p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            From zero to
            <br />
            <span className="text-muted-foreground">AI support</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            BotWebAI combines production-grade RAG, smart AI routing, and a one-line embed so your
            visitors get accurate answers — grounded in your content, not hallucinated guesses.
          </p>
          <div className="mt-8 flex flex-wrap gap-4 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="h-3.5 w-3.5" />
              10-minute setup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="h-3.5 w-3.5" />
              Source attribution
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CircleCheck className="h-3.5 w-3.5" />
              Smart escalation
            </span>
          </div>
        </div>
      </section>

      {/* Setup steps */}
      <section className="relative z-10 border-t border-foreground/10 bg-secondary/40 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 grid gap-8 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Getting started
              </p>
              <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Live in 4 steps.
                <br />
                <span className="text-muted-foreground">No engineering sprint.</span>
              </h2>
            </div>
            <p className="max-w-md text-muted-foreground lg:justify-self-end">
              Most teams go live in under 10 minutes — from empty site to grounded AI support.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-6">
              {setupSteps.map((step) => (
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
              <div className="border-t border-white/15 px-5 py-4">
                <p className="flex items-center gap-2 font-mono text-xs text-white/70">
                  <Code2 className="h-3.5 w-3.5" />
                  One script tag. That&apos;s it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-tier AI */}
      <section className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 max-w-3xl">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              AI routing
            </p>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Three tiers of
              <br />
              <span className="text-muted-foreground">AI intelligence.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Use the most efficient option first, escalate only when needed.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden border border-foreground/10 bg-foreground/10 md:grid-cols-3">
            {aiTiers.map((tier) => (
              <article
                key={tier.title}
                className="group bg-background p-8 transition-colors duration-300 hover:bg-secondary sm:p-10"
              >
                <div className="mb-8 flex items-start justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{tier.number}</span>
                  <tier.icon className="h-5 w-5 text-foreground/50 transition-colors group-hover:text-foreground" />
                </div>
                <p className="mb-4 font-display text-4xl tracking-tight text-primary lg:text-5xl">
                  {tier.pct}
                </p>
                <h3 className="mb-1 font-display text-2xl tracking-tight">{tier.title}</h3>
                <p className="mb-3 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                  {tier.subtitle}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">{tier.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Accuracy */}
      <section className="relative z-10 border-t border-foreground/10 bg-secondary/40 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 max-w-3xl">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Accuracy
            </p>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Grounded answers,
              <br />
              <span className="text-muted-foreground">not guesses.</span>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden border border-foreground/10 bg-foreground/10 md:grid-cols-3">
            {accuracyItems.map((item) => (
              <article
                key={item.title}
                className="group bg-background p-8 transition-colors duration-300 hover:bg-secondary sm:p-10"
              >
                <div className="mb-8 flex items-start justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{item.number}</span>
                  <item.icon className="h-5 w-5 text-foreground/50 transition-colors group-hover:text-foreground" />
                </div>
                <h3 className="mb-3 font-display text-2xl tracking-tight">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* RAG pipeline */}
      <section className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
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
              Building retrieval-augmented generation in-house typically takes 3–6 months of senior
              engineering. We invested that effort upfront so you get production-grade RAG on day
              one.
            </p>
          </div>

          <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: "1,000", label: "Token chunks" },
              { value: "150", label: "Token overlap" },
              { value: "Top-5", label: "Similarity retrieval" },
              { value: "0.75", label: "Confidence threshold" },
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

      {/* Features */}
      <section className="relative z-10 border-t border-foreground/10 bg-secondary/40 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
          <div className="mb-16 max-w-3xl">
            <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Platform
            </p>
            <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Everything your team needs.
              <br />
              <span className="text-muted-foreground">Nothing you don&apos;t.</span>
            </h2>
          </div>

          <div className="grid gap-px overflow-hidden border border-foreground/10 bg-foreground/10 md:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="group bg-background p-8 transition-colors duration-300 hover:bg-secondary sm:p-10"
              >
                <div className="mb-8 flex items-start justify-between">
                  <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
                  <feature.icon className="h-5 w-5 text-foreground/50 transition-colors group-hover:text-foreground" />
                </div>
                <h3 className="mb-3 font-display text-2xl tracking-tight sm:text-3xl">
                  {feature.title}
                </h3>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {feature.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 border-t border-foreground/10 py-24 lg:py-32">
        <div className="mx-auto max-w-[1400px] px-6 text-center lg:px-12">
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
            Ready to get
            <br />
            <span className="text-muted-foreground">started?</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Set up your AI assistant in minutes. No credit card required.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="group h-12 rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/signup">
                Start building free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-foreground/20 px-8"
            >
              <Link href="/bot/bot-web-ai">Try live demo</Link>
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
