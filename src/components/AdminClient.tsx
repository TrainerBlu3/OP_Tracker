"use client";

import { FormEvent, useState } from "react";
import type { AdminUserDTO } from "@/lib/types";

export function AdminClient({
  initialUsers,
  stats,
  currentUserId,
}: {
  initialUsers: AdminUserDTO[];
  stats: { userCount: number; deckCount: number; inventoryItemCount: number; cardCount: number };
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AdminUserDTO[]>(initialUsers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ upserted: number; pages: number; at: Date } | null>(null);
  // The temp password for whichever user was just created/reset -- shown
  // once, never retrievable again after this, matching how the server
  // only ever returns it in that one response.
  const [revealedPassword, setRevealedPassword] = useState<{ email: string; password: string } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create user");
        return;
      }
      setUsers((prev) => [...prev, data.user]);
      setRevealedPassword({ email: data.user.email, password: data.tempPassword });
      setEmail("");
      setName("");
      setRole("USER");
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(user: AdminUserDTO, patch: { role?: "USER" | "ADMIN"; active?: boolean }) {
    setBusyUserId(user.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to update user");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
    } finally {
      setBusyUserId(null);
    }
  }

  async function resetPassword(user: AdminUserDTO) {
    setBusyUserId(user.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to reset password");
        return;
      }
      setRevealedPassword({ email: user.email, password: data.tempPassword });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, mustChangePassword: true } : u)));
    } finally {
      setBusyUserId(null);
    }
  }

  // apitcg.com pages 100 cards at a time -- a rough estimate of how many
  // requests a full sync costs, so the confirm dialog can warn against
  // quota before it's spent (apitcg.com plans are request-capped).
  const estimatedRequests = Math.ceil(stats.cardCount / 100) + 1;

  async function syncCardCatalog() {
    const confirmed = window.confirm(
      `This will page through the full apitcg.com catalog -- about ${estimatedRequests} API requests. Continue?`
    );
    if (!confirmed) return;

    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/sync-cards", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Card sync failed");
        return;
      }
      setSyncResult({ upserted: data.upserted, pages: data.pages, at: new Date() });
    } catch {
      setSyncError("Card sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Users</p>
          <p className="text-2xl font-semibold">{stats.userCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Decks</p>
          <p className="text-2xl font-semibold">{stats.deckCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Inventory rows</p>
          <p className="text-2xl font-semibold">{stats.inventoryItemCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Cards</p>
          <p className="text-2xl font-semibold">{stats.cardCount}</p>
        </div>
      </div>

      {revealedPassword && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">
            Temporary password for {revealedPassword.email}: <code className="font-mono">{revealedPassword.password}</code>
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Hand this off now -- it won&apos;t be shown again. They&apos;ll be forced to set their own password on
            first login.
          </p>
          <button
            onClick={() => setRevealedPassword(null)}
            className="mt-2 text-xs text-amber-800 hover:underline dark:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Card catalog</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pulls the latest cards and prices from apitcg.com. Each run costs API quota (~{estimatedRequests} requests
          at the current catalog size), so run this on demand -- e.g. monthly, or after a new set releases -- rather
          than automatically.
        </p>
        <button
          onClick={syncCardCatalog}
          disabled={syncing}
          className="mt-3 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {syncing ? "Syncing..." : "Sync card catalog"}
        </button>
        {syncError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{syncError}</p>}
        {syncResult && (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            Synced {syncResult.upserted} cards across {syncResult.pages} pages at{" "}
            {syncResult.at.toLocaleTimeString()}.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Create account</h2>
        <form onSubmit={createUser} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Name (optional)
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "ADMIN")}
              className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={creating || !email.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{createError}</p>}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Accounts</h2>
        {actionError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionError}</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyUserId === user.id;
                return (
                  <tr key={user.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      {user.email} {isSelf && <span className="text-xs text-zinc-500">(you)</span>}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{user.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={user.role}
                        disabled={busy || isSelf}
                        onChange={(e) => updateUser(user, { role: e.target.value as "USER" | "ADMIN" })}
                        className="rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => updateUser(user, { active: !user.active })}
                        disabled={busy || isSelf}
                        className={`rounded px-1.5 py-0.5 text-xs disabled:opacity-50 ${
                          user.active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {user.active ? "Active" : "Disabled"}
                      </button>
                      {user.mustChangePassword && (
                        <span className="ml-1 text-xs text-zinc-500">(pending first login)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => resetPassword(user)}
                        disabled={busy}
                        className="text-xs text-zinc-500 hover:underline disabled:opacity-50"
                      >
                        Reset password
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
