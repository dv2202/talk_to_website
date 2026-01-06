import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about BotWebAI — AI customer support grounded in your own content, with production-grade RAG and a one-line embed.",
};

const values = [
  {
    title: "Grounded answers",
    copy: "Responses come from your knowledge base with source attribution — not generic AI guesses.",
  },
  {
    title: "Minutes, not months",
    copy: "Paste a URL, set guardrails, drop one script tag. Most teams go live in under 10 minutes.",
  },
  {
    title: "Built for operators",
    copy: "Inbox, analytics, and knowledge sync in one dashboard so support stays accurate as you grow.",
  },
];

export default function AboutPage() {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      <section className="relative border-b border-foreground/10 pt-28 lg:pt-36">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-[1400px] px-6 py-16 lg:px-12 lg:py-24">
          <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            About Us
          </p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            AI support that
            <br />
            <span className="text-muted-foreground">knows your business</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            BotWebAI helps teams deliver accurate, 24/7 customer support from their own docs, FAQs,
            and website — without building AI infrastructure from scratch.
          </p>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto grid max-w-[1400px] gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-12">
          <div className="space-y-5">
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Our story
            </p>
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl lg:text-5xl">
              Built for teams who want answers, not experiments
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                BotWebAI is an AI customer support platform that lets businesses build intelligent
                assistants grounded in their own content. Visitors get accurate answers from your
                knowledge base — not generic guesses.
              </p>
              <p>
                Import knowledge from PDFs, text files, and website URLs. Visitors interact through
                an embeddable chat widget or a standalone chat page. You manage assistants,
                knowledge sources, and conversations from a web dashboard.
              </p>
              <p>
                We focus on production-grade RAG, smart escalation, and a setup that fits real
                product and support teams — not a research demo.
              </p>
            </div>
          </div>

          <div className="space-y-px overflow-hidden border border-foreground/10 bg-foreground/10">
            {values.map((value) => (
              <div key={value.title} className="bg-background p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <h3 className="font-display text-xl tracking-tight">{value.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-foreground/10 bg-foreground py-20 text-background">
        <div className="mx-auto max-w-[1400px] px-6 text-center lg:px-12">
          <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Want to talk with us?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Questions about BotWebAI, plans, or getting started — we&apos;re happy to help.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="h-12 rounded-full bg-background px-7 text-foreground hover:bg-background/90"
            >
              <Link href="/contact">
                Contact Us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-white/25 bg-transparent px-7 text-background hover:bg-white/10"
            >
              <Link href="/signup">Start creating</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
