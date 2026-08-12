"use client";

import { signOut } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function ChangePasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const newPassword = form.get("newPassword");
    const confirmPassword = form.get("confirmPassword");
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: form.get("currentPassword"),
        newPassword,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }

    // The session JWT still carries the old mustChangePassword: true until
    // it's reissued, which would just bounce back here -- sign out and
    // require a fresh login instead of trying to patch the live session.
    setDone(true);
    await signOut({ callbackUrl: "/login" });
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-3 pt-16 text-center">
        <p className="text-sm text-zinc-500">Password updated. Signing you out to sign back in...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 pt-16">
      <div>
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your account was created with a temporary password. Set your own before continuing.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Temporary password
          <input
            name="currentPassword"
            type="password"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Saving..." : "Set password"}
        </button>
      </form>
    </div>
  );
}
