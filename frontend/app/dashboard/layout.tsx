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
    CreditCard,
    LayoutDashboard,
    MessageSquare,
    User,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    Headset,
} from "lucide-react";
import Image from "next/image";
import { LiveChatOwnerAlerts } from "@/components/LiveChatOwnerAlerts";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, isPending } = useSession();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Admins may open the shared assistant edit form (used from the admin panel)
    // while the rest of the user dashboard redirects them to the admin area.
    const isEditPage = pathname.startsWith("/dashboard/edit");

    useEffect(() => {
        if (isPending) return;

        if (session) {
            if (isAdminEmail(session.user.email) && !isEditPage) {
                router.replace("/admin");
            }
            return;
        }

        // After Google OAuth the shared session atom can still be null briefly.
        // Re-check once before sending the user back to login.
        let cancelled = false;
        void authClient.getSession().then(({ data }) => {
            if (cancelled) return;
            if (data) {
                authClient.$store.notify("$sessionSignal");
                if (isAdminEmail(data.user.email) && !isEditPage) {
                    router.replace("/admin");
                }
                return;
            }
            router.replace("/login");
        });

        return () => {
            cancelled = true;
        };
    }, [session, isPending, router, isEditPage]);

    if (isPending || !session || (isAdminEmail(session.user.email) && !isEditPage)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
                   <Image src="/logo.png" alt="BotWebAI" width={32} height={32} />
                    <span>Setting up your account...</span>
                </div>
            </div>
        );
    }

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    const navItems = [
        { href: "/dashboard", label: "Assistants", icon: LayoutDashboard },
        { href: "/dashboard/conversations", label: "Conversations", icon: MessageSquare },
        { href: "/dashboard/live", label: "Live Chat", icon: Headset },
        { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
        { href: "/dashboard/profile", label: "Profile", icon: User },
    ];

    return (
        <div className="h-screen overflow-hidden bg-[#f7f7f3] text-[#121212] dark:bg-[#0e0f11] dark:text-zinc-100 flex">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 border-r border-black/10 bg-[#efeee8]/95 backdrop-blur transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:relative lg:h-full dark:border-white/10 dark:bg-[#121316]/95 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${isCollapsed ? "w-72 lg:w-20" : "w-72"}`}
            >
                {/* Desktop Collapse Toggle Button (Floating) */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:flex absolute top-5 -right-3 z-50 h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-[#efeee8] hover:bg-[#efeee8]/80 dark:bg-[#121316] dark:border-white/10 dark:hover:bg-[#121316]/80 text-[#121212] dark:text-zinc-100 shadow-sm transition-transform hover:scale-105"
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                        <ChevronLeft className="h-3.5 w-3.5" />
                    )}
                </button>

                <div className="flex flex-col h-full">
                    <div className={`flex items-center justify-between p-4 h-16 ${isCollapsed ? "lg:justify-center" : ""}`}>
                        <Link href="/" className="flex items-center gap-2 overflow-hidden shrink-0">
                            <Image src="/logo.png" alt="BotWebAI" width={32} height={32} className="h-8 w-8 shrink-0" />
                            <span className={`font-semibold text-lg tracking-tight transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:pointer-events-none" : "opacity-100 max-w-48"}`}>
                                BotWebAI
                            </span>
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

                    <nav className="flex-1 p-4 space-y-1 overflow-x-hidden">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${pathname === item.href
                                    ? "bg-black text-white shadow-sm dark:bg-white dark:text-black"
                                    : "text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                                    } ${isCollapsed ? "lg:justify-center lg:px-0" : ""}`}
                                onClick={() => setSidebarOpen(false)}
                                title={isCollapsed ? item.label : undefined}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                <span className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:pointer-events-none" : "opacity-100 max-w-40"}`}>
                                    {item.label}
                                </span>
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 space-y-3 overflow-hidden">
                        <Separator className="bg-black/10 dark:bg-white/10" />
                        {session?.user && (
                            <div className={`flex items-center gap-3 rounded-xl border border-black/10 bg-white/70 px-3 py-2 dark:border-white/15 dark:bg-white/5 transition-all duration-300 ${isCollapsed ? "lg:justify-center lg:px-0 lg:border-transparent lg:bg-transparent" : ""}`}>
                                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-medium dark:bg-white dark:text-black shrink-0">
                                    {session.user.name?.charAt(0)?.toUpperCase() || "U"}
                                </div>
                                <div className={`flex-1 min-w-0 transition-all duration-300 ease-in-out overflow-hidden ${isCollapsed ? "lg:opacity-0 lg:max-w-0" : "opacity-100 max-w-40"}`}>
                                    <p className="text-sm font-medium truncate">{session.user.name}</p>
                                    <p className="text-xs text-black/55 dark:text-white/55 truncate">
                                        {session.user.email}
                                    </p>
                                </div>
                            </div>
                        )}
                        <Button
                            variant="ghost"
                            className={`w-full justify-start gap-3 rounded-xl text-black/70 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white transition-all duration-300 ${isCollapsed ? "lg:justify-center lg:px-0" : ""}`}
                            onClick={handleSignOut}
                            title={isCollapsed ? "Sign out" : undefined}
                        >
                            <LogOut className="h-4 w-4 shrink-0" />
                            <span className={`transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden ${isCollapsed ? "lg:opacity-0 lg:max-w-0 lg:pointer-events-none" : "opacity-100 max-w-40"}`}>
                                Sign out
                            </span>
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
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

            {/* Alarm + banner when a visitor requests "Chat with a real person" */}
            <LiveChatOwnerAlerts />
        </div>
    );
}
