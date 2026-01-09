"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const defaultLinks = [
  { name: "Features", href: "/#features" },
  { name: "How it works", href: "/#how-it-works" },
  { name: "Pricing", href: "/plans" },
];

type MarketingNavProps = {
  links?: { name: string; href: string }[];
  ctaLabel?: string;
  ctaHref?: string;
};

export function MarketingNav({
  links = defaultLinks,
  ctaLabel = "Start creating",
  ctaHref = "/signup",
}: MarketingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session, isPending } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    const widgetHost = document.getElementById("ttw-widget-host");
    if (widgetHost) {
      widgetHost.style.display = mobileOpen ? "none" : "";
    }
    return () => {
      document.body.style.overflow = "";
      if (widgetHost) {
        widgetHost.style.display = "";
      }
    };
  }, [mobileOpen]);

  const elevated = scrolled || mobileOpen;

  return (
    <header
      className={cn(
        "fixed z-50 transition-all duration-500",
        scrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
      )}
    >
      <nav
        className={cn(
          "relative z-50 mx-auto transition-all duration-500",
          elevated
            ? "max-w-[1200px] rounded-2xl border border-foreground/10 bg-background/80 shadow-lg backdrop-blur-xl"
            : "max-w-[1400px] bg-transparent"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between px-6 transition-all duration-500 lg:px-8",
            scrolled ? "h-14" : "h-20"
          )}
        >
          <Link href="/" className="group flex items-center gap-2.5" id="nav-logo">
            <Image
              src="/logo.png"
              alt="BotWebAI"
              width={36}
              height={36}
              className={cn(
                "shrink-0 transition-all duration-500",
                scrolled ? "h-7 w-7" : "h-9 w-9"
              )}
            />
            <span
              className={cn(
                "font-display tracking-tight text-primary transition-all duration-500",
                scrolled ? "text-xl" : "text-2xl"
              )}
            >
              BotWebAI
            </span>
          </Link>

          <div className="hidden items-center gap-12 md:flex">
            {links.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group relative text-sm text-foreground/70 transition-colors duration-300 hover:text-foreground"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-4 md:flex">
            {isPending ? (
              <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
            ) : session?.user ? (
              <UserMenu />
            ) : (
              <>
                <Link
                  href="/login"
                  id="nav-login"
                  className={cn(
                    "text-foreground/70 transition-all duration-500 hover:text-foreground",
                    scrolled ? "text-xs" : "text-sm"
                  )}
                >
                  Sign in
                </Link>
                <Button
                  asChild
                  size="sm"
                  className={cn(
                    "rounded-full bg-primary text-primary-foreground transition-all duration-500 hover:bg-primary/90",
                    scrolled ? "h-8 px-4 text-xs" : "px-6"
                  )}
                >
                  <Link href={ctaHref} id="nav-signup">
                    {ctaLabel}
                  </Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="p-2 md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-background transition-all duration-500 md:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div className="flex h-full flex-col px-8 pt-28 pb-8">
          <div className="flex flex-1 flex-col justify-center gap-8">
            {links.map((link, index) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "font-display text-5xl text-foreground transition-all duration-500 hover:text-muted-foreground",
                  mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                )}
                style={{ transitionDelay: mobileOpen ? `${75 * index}ms` : "0ms" }}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div
            className={cn(
              "flex gap-4 border-t border-foreground/10 pt-8 transition-all duration-500",
              mobileOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            )}
            style={{ transitionDelay: mobileOpen ? "300ms" : "0ms" }}
          >
            {session?.user ? (
              <div className="flex w-full items-center justify-between">
                <UserMenu />
                <Button
                  asChild
                  className="h-14 rounded-full bg-primary px-8 text-base text-primary-foreground"
                >
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="h-14 flex-1 rounded-full text-base"
                >
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button
                  asChild
                  className="h-14 flex-1 rounded-full bg-primary text-base text-primary-foreground"
                >
                  <Link href={ctaHref} onClick={() => setMobileOpen(false)}>
                    {ctaLabel}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
