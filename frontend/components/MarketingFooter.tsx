import Image from "next/image";
import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-foreground/10 bg-secondary/40 py-16">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 lg:grid-cols-[1.2fr_2fr] lg:px-12">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="BotWebAI"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0"
            />
            <span className="font-display text-2xl tracking-tight">BotWebAI</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The platform for teams who ship support. Build, deploy, and scale AI grounded in your
            own knowledge.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="space-y-3 text-sm">
            <p className="font-medium">Product</p>
            <Link href="/#features" className="block text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="/how-it-works" className="block text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/plans" className="block text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-medium">Resources</p>
            <Link href="/docs" className="block text-muted-foreground hover:text-foreground">
              Documentation
            </Link>
            <Link href="/how-it-works" className="block text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/#how-it-works" className="block text-muted-foreground hover:text-foreground">
              Embed widget
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-medium">Company</p>
            <Link href="/about" className="block text-muted-foreground hover:text-foreground">
              About
            </Link>
            <Link href="/contact" className="block text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </div>
          <div className="space-y-3 text-sm">
            <p className="font-medium">Legal</p>
            <Link href="/privacy" className="block text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="block text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="/#security" className="block text-muted-foreground hover:text-foreground">
              Security
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-foreground/10 px-6 pt-8 text-sm text-muted-foreground lg:px-12">
        <p>© {new Date().getFullYear()} BotWebAI. All rights reserved.</p>
        <p className="inline-flex items-center gap-2 font-mono text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          All systems operational
        </p>
      </div>
    </footer>
  );
}
