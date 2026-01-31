"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, Shield } from "lucide-react";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isPending) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <>
        <Link
          href="/login"
          id="nav-login"
          className="text-sm text-foreground/70 transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
        <Button asChild size="sm" className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90">
          <Link href="/signup" id="nav-signup">
            Start creating
          </Link>
        </Button>
      </>
    );
  }

  const { name, email, image } = session.user;
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center h-9 w-9 rounded-full overflow-hidden ring-2 ring-border hover:ring-primary transition-all focus:outline-none focus:ring-primary"
        aria-label="User menu"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "Profile"}
            width={36}
            height={36}
            className="object-cover h-full w-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="h-full w-full flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border bg-popover shadow-lg z-50 overflow-hidden animate-in fade-in-0 zoom-in-95">
          {/* User info */}
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>

          {/* Actions */}
          <div className="p-1">
            <button
              onClick={() => {
                setOpen(false);
                router.push(isAdminEmail(email) ? "/admin" : "/dashboard");
              }}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              {isAdminEmail(email) ? (
                <Shield className="h-4 w-4" />
              ) : (
                <LayoutDashboard className="h-4 w-4" />
              )}
              {isAdminEmail(email) ? "Admin" : "Dashboard"}
            </button>
            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.push("/");
                router.refresh();
              }}
              className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
