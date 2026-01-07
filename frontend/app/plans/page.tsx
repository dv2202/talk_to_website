import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, CircleCheck } from "lucide-react";
import { MarketingNav } from "@/components/MarketingNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { Button } from "@/components/ui/button";
import { formatPlanPrice, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plans",
  description:
    "BotWebAI pricing plans: Free, Starter, and Pro. Start on the free plan — no credit card required.",
};

export default function PlansPage() {
  return (
    <div className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <MarketingNav />

      <section className="relative border-b border-foreground/10 pt-24 lg:pt-28">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="relative mx-auto max-w-[1400px] px-6 py-10 text-center lg:px-12 lg:py-12">
          <p className="mb-3 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            Pricing
          </p>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Simple, transparent
            <br />
            <span className="text-muted-foreground">pricing</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Start on the free plan. Upgrade when you need more conversations, branding control, or assistants.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1400px] items-center gap-4 px-6 md:grid-cols-3 md:gap-6 lg:px-12">
          {PLANS.map((plan, index) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex flex-col border border-foreground/10 bg-background p-8",
                plan.popular &&
                  "z-10 border-primary shadow-lg md:-translate-y-2 md:scale-[1.03] md:px-9 md:py-10"
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
              <h2 className="mt-4 font-display text-3xl tracking-tight">{plan.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>

              <div className="mt-8">
                <p className="font-display text-4xl tracking-tight">{formatPlanPrice(plan)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.isPaid ? "per month" : "forever"}
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{feature}</span>
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
                <Link href="/signup">
                  {!plan.isPaid ? "Start free" : `Get ${plan.name}`}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 flex max-w-[1400px] flex-wrap items-center justify-center gap-4 px-6 text-xs text-muted-foreground lg:px-12">
          <span className="inline-flex items-center gap-1.5">
            <CircleCheck className="h-3.5 w-3.5" />
            No credit card required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CircleCheck className="h-3.5 w-3.5" />
            Cancel anytime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CircleCheck className="h-3.5 w-3.5" />
            Manage billing in the dashboard
          </span>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
