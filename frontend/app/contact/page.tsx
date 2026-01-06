import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Mail } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ContactForm } from "@/components/ContactForm";
import { SUPPORT_EMAIL } from "@/lib/docs/siteDocumentation";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the BotWebAI team for product questions, support, or partnership inquiries.",
};

export default function ContactPage() {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      <section className="relative border-b border-foreground/10 pt-28 lg:pt-36">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-[1400px] px-6 py-16 lg:px-12 lg:py-24">
          <p className="mb-4 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Contact Us
          </p>
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            We&apos;d love to
            <br />
            <span className="text-muted-foreground">hear from you</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Product questions, billing help, or partnership ideas — reach out and we&apos;ll get
            back within 24–48 hours on business days.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
          <div className="space-y-4">
            <div className="border border-foreground/10 bg-secondary/30 p-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="font-display text-xl tracking-tight">Email</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Best for support and general inquiries.
                  </p>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>
            </div>

            <div className="border border-foreground/10 bg-secondary/30 p-6">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="font-display text-xl tracking-tight">Response time</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    We typically respond within 24 to 48 hours on business days. Priority support
                    applies on the Pro plan.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Prefer docs first?{" "}
              <Link href="/docs" className="font-medium text-foreground underline underline-offset-4">
                Browse documentation
              </Link>
            </p>
          </div>

          <div>
            <h2 className="mb-4 font-display text-2xl tracking-tight">Send a message</h2>
            <ContactForm />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
