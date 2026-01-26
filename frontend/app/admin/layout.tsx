"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/admin";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    LogOut,
    Menu,
    Users,
    X,
} from "lucide-react";
import Image from "next/image";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, isPending } = useSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (isPending) return;

        let cancelled = false;

        const gate = async () => {
            let current = session;
            if (!current) {
                const { data } = await authClient.getSession();
                if (cancelled) return;
                if (data) {
                    authClient.$store.notify("$sessionSignal");
                    current = data;
                }
            }

            if (!current) {
                router.replace("/login?callbackUrl=/admin");
                return;
            }

            if (!isAdminEmail(current.user.email)) {
                router.replace("/dashboard");
                return;
            }

            setChecked(true);
        };

        void gate();

        return () => {
            cancelled = true;
        };
    }, [session, isPending, router]);

    if (isPending || !checked || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
                    <Image src="/logo.png" alt="BotWebAI" width={32} height={32} />
                    <span>Checking admin access...</span>
                </div>
            </div>
        );
    }

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const navItems = [
        { href: "/admin", label: "Users", icon: Users },
    ];

    return (
        <div className="h-screen overflow-hidden bg-[#f7f7f3] text-[#121212] dark:bg-[#0e0f11] dark:text-zinc-100 flex">
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-black/10 bg-[#efeee8]/95 backdrop-blur transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:relative lg:h-full dark:border-white/10 dark:bg-[#121316]/95 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 h-16">
                        <Link href="/admin" className="flex items-center gap-2 overflow-hidden shrink-0">
                            <Image
                                src="/logo.png"
                                alt="BotWebAI"
                                width={32}
                                height={32}
                                className="h-8 w-8 shrink-0"
                            />
                            <span className="font-semibold text-lg tracking-tight">Admin</span>
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <Separator className="bg-black/10 dark:bg-white/10" />

                    <nav className="flex-1 p-4 space-y-1">
                        {navItems.map((item) => {
                            const active =
                                item.href === "/admin"
                                    ? pathname === "/admin" || pathname.startsWith("/admin/users")
                                    : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                        active
                                            ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                                            : "text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                                    }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 space-y-3">
                        <Separator className="bg-black/10 dark:bg-white/10" />
                        <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2 dark:border-white/15 dark:bg-white/5">
                            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-medium dark:bg-white dark:text-black shrink-0">
                                {session.user.name?.charAt(0)?.toUpperCase() || "A"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{session.user.name}</p>
                                <p className="text-xs text-black/55 dark:text-white/55 truncate">
                                    {session.user.email}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 rounded-xl text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                            onClick={handleSignOut}
                        >
                            <LogOut className="h-4 w-4 shrink-0" />
                            <span>Sign out</span>
                        </Button>
                    </div>
                </div>
            </aside>

            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="h-16 border-b border-black/10 dark:border-white/10 flex items-center justify-between px-4 sm:px-6 bg-[#f7f7f3]/90 dark:bg-[#0e0f11]/90 backdrop-blur shrink-0 z-30">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="flex-1" />
                    <ThemeToggle />
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}
