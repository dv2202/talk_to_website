"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Trash2, Users } from "lucide-react";

type AdminUserRow = {
    id: string;
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: string;
    botCount: number;
    conversationCount: number;
    planId: "FREE" | "STARTER" | "PRO";
};

type DeletePreview = {
    user: AdminUserRow;
    bots: { id: string; name: string; botName: string }[];
};

function planBadgeVariant(planId: string) {
    if (planId === "PRO") return "default" as const;
    if (planId === "STARTER") return "secondary" as const;
    return "outline" as const;
}

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.getAdminUsers();
                setUsers(data.users || []);
            } catch (error) {
                console.error("Failed to load users:", error);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (user) =>
                user.name.toLowerCase().includes(q) ||
                user.email.toLowerCase().includes(q) ||
                user.planId.toLowerCase().includes(q)
        );
    }, [users, query]);

    const openDeleteDialog = async (user: AdminUserRow, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteError(null);
        setLoadingPreview(true);
        setDeletePreview({ user, bots: [] });
        try {
            const detail = await api.getAdminUser(user.id);
            setDeletePreview({
                user: {
                    ...user,
                    planId: detail.planId ?? user.planId,
                    botCount: detail.bots?.length ?? user.botCount,
                },
                bots: (detail.bots || []).map(
                    (bot: { id: string; name: string; botName: string }) => ({
                        id: bot.id,
                        name: bot.name,
                        botName: bot.botName,
                    })
                ),
            });
        } catch (error) {
            console.error("Failed to load user details:", error);
            setDeleteError(
                error instanceof Error ? error.message : "Failed to load user details"
            );
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deletePreview) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await api.deleteAdminUser(deletePreview.user.id);
            setUsers((prev) => prev.filter((u) => u.id !== deletePreview.user.id));
            setDeletePreview(null);
        } catch (error) {
            console.error("Failed to delete user:", error);
            setDeleteError(
                error instanceof Error ? error.message : "Failed to delete user"
            );
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Users</h1>
                    <p className="text-sm text-muted-foreground">
                        {users.length} registered user{users.length !== 1 && "s"}
                    </p>
                </div>
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search name, email, or plan"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            {filtered.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 space-y-3">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No users match your search.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03]">
                                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                                    <th className="px-4 py-3 font-medium">User</th>
                                    <th className="px-4 py-3 font-medium">Plan</th>
                                    <th className="px-4 py-3 font-medium">Bots</th>
                                    <th className="px-4 py-3 font-medium">Chats (30d)</th>
                                    <th className="px-4 py-3 font-medium">Joined</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-black/5 dark:border-white/5 last:border-0 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                                        onClick={() => router.push(`/admin/users/${user.id}`)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center text-xs font-medium shrink-0">
                                                    {user.name?.charAt(0)?.toUpperCase() || "U"}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">{user.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={planBadgeVariant(user.planId)}>
                                                {user.planId}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3">{user.botCount}</td>
                                        <td className="px-4 py-3">{user.conversationCount}</td>
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="gap-1.5"
                                                onClick={(e) => openDeleteDialog(user, e)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Dialog
                open={!!deletePreview}
                onOpenChange={(open) => {
                    if (!open && !deleting) {
                        setDeletePreview(null);
                        setDeleteError(null);
                    }
                }}
            >
                <DialogContent className="rounded-3xl border-black/15 bg-[#faf9f5] dark:border-white/20 dark:bg-zinc-950 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete user</DialogTitle>
                        <DialogDescription>
                            This permanently deletes the account and all related data. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {deletePreview && (
                        <div className="space-y-3 rounded-xl border border-black/10 bg-white/60 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                            {loadingPreview ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading details...
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                            Email
                                        </p>
                                        <p className="font-medium break-all">
                                            {deletePreview.user.email}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                            Plan
                                        </p>
                                        <p className="font-medium">{deletePreview.user.planId}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                            Bots ({deletePreview.bots.length})
                                        </p>
                                        {deletePreview.bots.length === 0 ? (
                                            <p className="text-muted-foreground">No bots</p>
                                        ) : (
                                            <ul className="mt-1 space-y-1">
                                                {deletePreview.bots.map((bot) => (
                                                    <li key={bot.id} className="font-medium">
                                                        {bot.name}{" "}
                                                        <span className="font-normal text-muted-foreground">
                                                            (@{bot.botName})
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground pt-1 border-t border-black/5 dark:border-white/10">
                                        Sessions, knowledge, conversations, visitors, subscription,
                                        and payments for this user will also be deleted.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {deleteError && (
                        <p className="text-sm text-destructive">{deleteError}</p>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeletePreview(null)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteUser}
                            disabled={deleting || loadingPreview}
                        >
                            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                            Delete permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
