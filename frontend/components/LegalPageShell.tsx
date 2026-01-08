import Link from "next/link";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { SUPPORT_EMAIL } from "@/lib/docs/siteDocumentation";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  afterBullets?: string[];
};

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: LegalSection[];
  otherLegalHref: "/privacy" | "/terms";
  otherLegalLabel: string;
};

export function LegalPageShell({
  eyebrow,
  title,
  subtitle,
  effectiveDate,
  sections,
  otherLegalHref,
  otherLegalLabel,
}: LegalPageShellProps) {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      <section className="relative border-b border-foreground/10 pt-28 lg:pt-36">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-[900px] px-6 py-16 lg:px-12 lg:py-24">
          <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
          <p className="mt-4 font-mono text-xs text-muted-foreground">
            Effective date: {effectiveDate}
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[900px] space-y-12 px-6 lg:px-12">
          {sections.map((section) => (
            <article key={section.title} className="space-y-4">
              <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 48)}
                  className="text-base leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && section.bullets.length > 0 && (
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
                  {section.bullets.map((item) => (
                    <li key={item.slice(0, 64)}>{item}</li>
                  ))}
                </ul>
              )}
              {section.afterBullets?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 48)}
                  className="text-base leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </article>
          ))}

          <div className="border-t border-foreground/10 pt-8 text-sm text-muted-foreground">
            <p>
              Questions about this page? Email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p className="mt-3">
              Also see our{" "}
              <Link
                href={otherLegalHref}
                className="font-medium text-foreground underline underline-offset-4"
              >
                {otherLegalLabel}
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
