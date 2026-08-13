"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import type { DeckListItemDTO, FormatDTO } from "@/lib/types";
import { baseCardName } from "@/lib/cardVariants";

const NO_LEADER_GROUP = "No leader set";

export function DecksClient({
  initialDecks,
  formats,
}: {
  initialDecks: DeckListItemDTO[];
  formats: FormatDTO[];
}) {
  const router = useRouter();
  const [decks, setDecks] = useState(initialDecks);
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState(formats[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), formatId: formatId || undefined }),
    });
    setCreating(false);
    if (!res.ok) return;
    const { deck } = await res.json();
    router.push(`/decks/${deck.id}`);
  }

  async function handleDelete(deckId: string) {
    const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
    if (!res.ok) return;
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
  }

  async function handleDuplicate(deckId: string) {
    setDuplicatingId(deckId);
    try {
      const res = await fetch(`/api/decks/${deckId}/duplicate`, { method: "POST" });
      if (!res.ok) return;
      const { deck } = await res.json();
      router.push(`/decks/${deck.id}`);
    } finally {
      setDuplicatingId(null);
    }
  }

  // Grouped by leader *archetype* (art variants of the same leader share a
  // group), so e.g. every "Yamato" build sits together regardless of which
  // exact printing was picked as the leader.
  const groups = useMemo(() => {
    const byGroup = new Map<string, DeckListItemDTO[]>();
    for (const deck of decks) {
      const key = deck.leader ? baseCardName(deck.leader.name) : NO_LEADER_GROUP;
      byGroup.set(key, [...(byGroup.get(key) ?? []), deck]);
    }
    return [...byGroup.entries()].sort(([a], [b]) => {
      if (a === NO_LEADER_GROUP) return 1;
      if (b === NO_LEADER_GROUP) return -1;
      return a.localeCompare(b);
    });
  }, [decks]);

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="flex flex-col gap-1 text-sm">
          Deck name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Red/Green Aggro"
            className="rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Format
          <select
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">No format (no legality checks)</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {creating ? "Creating..." : "New deck"}
        </button>
      </form>

      {decks.length === 0 ? (
        <p className="text-sm text-zinc-500">No decks yet. Create one above.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([groupName, groupDecks]) => (
            <div key={groupName} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-zinc-500">
                {groupName} <span className="font-normal">({groupDecks.length})</span>
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupDecks.map((deck) => {
                  const total = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
                  return (
                    <li
                      key={deck.id}
                      className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <Link href={`/decks/${deck.id}`} className="font-medium hover:underline">
                        {deck.name}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        {deck.leader ? deck.leader.name : "No leader set"} &middot; {total}/{deck.format?.deckSize ?? 50} cards
                      </p>
                      <p className="text-xs text-zinc-500">{deck.format?.name ?? "No format"}</p>
                      <div className="mt-1 flex items-center gap-3">
                        <button
                          onClick={() => handleDuplicate(deck.id)}
                          disabled={duplicatingId === deck.id}
                          className="self-start text-xs text-zinc-500 hover:underline disabled:opacity-50"
                        >
                          {duplicatingId === deck.id ? "Duplicating..." : "Duplicate"}
                        </button>
                        <button
                          onClick={() => handleDelete(deck.id)}
                          className="self-start text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
