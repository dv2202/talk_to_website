import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SITE_DOCUMENTATION, SUPPORT_EMAIL } from "@/lib/docs/siteDocumentation";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "BotWebAI documentation: setup, usage, features, pricing plans, widget embed, FAQ, and support contact.",
};

export default function DocsPage() {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      <div className="mx-auto max-w-4xl px-6 pt-32 pb-16 lg:px-8 lg:pt-40">
        <header className="mb-10 space-y-4">
          <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Documentation
          </p>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            BotWebAI Docs
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Everything about BotWebAI — setup, usage, features, how it works, and support.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 border border-foreground/15 px-4 py-2 text-sm font-medium transition hover:bg-secondary"
            >
              Contact support
            </a>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90"
            >
              Start creating
            </Link>
          </div>
        </header>

        <nav
          aria-label="Documentation sections"
          className="mb-12 border border-foreground/10 bg-secondary/30 p-5"
        >
          <p className="mb-3 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            On this page
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SITE_DOCUMENTATION.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="space-y-14">
          {SITE_DOCUMENTATION.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-28 border-b border-foreground/10 pb-14 last:border-b-0"
            >
              <h2 className="mb-4 font-display text-3xl tracking-tight sm:text-4xl">
                {section.title}
              </h2>
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
                {section.body.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph.trim()}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <div className="mt-16 border border-foreground/10 bg-secondary/40 p-6">
          <h2 className="font-display text-2xl tracking-tight">Need help?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact the founder at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {SUPPORT_EMAIL}
            </a>
            . We typically respond within 24 to 48 hours on business days.
          </p>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
