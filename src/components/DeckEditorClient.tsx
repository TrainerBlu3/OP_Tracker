"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CardPicker } from "@/components/CardPicker";
import { validateDeck } from "@/lib/rules";
import { COLOR_STYLES, type DeckDetailDTO, type CardDTO, type FormatDTO } from "@/lib/types";

const MAIN_DECK_TYPES = ["CHARACTER", "EVENT", "STAGE"] as const;

export function DeckEditorClient({
  initialDeck,
  formats,
}: {
  initialDeck: DeckDetailDTO;
  formats: FormatDTO[];
}) {
  const router = useRouter();
  const [deck, setDeck] = useState(initialDeck);
  const [name, setName] = useState(initialDeck.name);
  const [showLeaderPicker, setShowLeaderPicker] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);

  async function patchDeck(data: Record<string, unknown>) {
    const res = await fetch(`/api/decks/${deck.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const { deck: updated } = await res.json();
    setDeck(updated);
  }

  async function setCardQuantity(card: CardDTO, quantity: number) {
    if (quantity < 0 || quantity > (deck.format?.maxCopiesPerCard ?? 4)) return;
    const res = await fetch(`/api/decks/${deck.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quantity }),
    });
    if (!res.ok) return;
    const { deck: updated } = await res.json();
    setDeck(updated);
  }

  async function handleDeleteDeck() {
    const res = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    if (res.ok) router.push("/decks");
  }

  const quantityByCardId = new Map(deck.cards.map((c) => [c.cardId, c.quantity]));
  const totalMainDeck = deck.cards.reduce((sum, c) => sum + c.quantity, 0);

  const validation = useMemo(
    () =>
      validateDeck({
        leader: deck.leader,
        cards: deck.cards.map((c) => ({ card: c.card, quantity: c.quantity })),
        format: deck.format,
      }),
    [deck]
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href="/decks" className="text-sm text-zinc-500 hover:underline">
          &larr; All decks
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== deck.name && patchDeck({ name: name.trim() })}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-lg font-semibold dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={deck.formatId ?? ""}
            onChange={(e) => patchDeck({ formatId: e.target.value || null })}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">No format</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button onClick={handleDeleteDeck} className="ml-auto text-sm text-red-600 hover:underline dark:text-red-400">
            Delete deck
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Leader</h2>
          <button
            onClick={() => setShowLeaderPicker((s) => !s)}
            className="text-sm text-zinc-500 hover:underline"
          >
            {deck.leader ? "Change leader" : "Choose leader"}
          </button>
        </div>
        {deck.leader ? (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-medium">{deck.leader.name}</span>
            <span className="text-zinc-500">{deck.leader.code}</span>
            {deck.leader.colors.map((c) => (
              <span key={c} className={`rounded px-1.5 py-0.5 text-xs ${COLOR_STYLES[c] ?? ""}`}>
                {c}
              </span>
            ))}
            {deck.leader.life !== null && <span className="text-zinc-500">Life {deck.leader.life}</span>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">No leader chosen yet.</p>
        )}
        {showLeaderPicker && (
          <div className="mt-4">
            <CardPicker
              lockedCardType="LEADER"
              format={deck.format}
              renderAction={(card) => (
                <button
                  onClick={() => {
                    patchDeck({ leaderId: card.id });
                    setShowLeaderPicker(false);
                  }}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                >
                  Set as leader
                </button>
              )}
            />
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Legality {deck.format ? `(${deck.format.name})` : ""}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {totalMainDeck}/{deck.format?.deckSize ?? 50} main deck cards
        </p>
        {validation.errors.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-red-600 dark:text-red-400">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}
        {validation.warnings.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-amber-600 dark:text-amber-400">
            {validation.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        )}
        {validation.isLegal && validation.warnings.length === 0 && (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Deck is legal.</p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Main deck</h2>
          <button onClick={() => setShowCardPicker((s) => !s)} className="text-sm text-zinc-500 hover:underline">
            {showCardPicker ? "Done adding" : "Add cards"}
          </button>
        </div>

        {showCardPicker && (
          <div className="mt-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <CardPicker
              typeOptions={MAIN_DECK_TYPES}
              format={deck.format}
              renderAction={(card) => {
                const qty = quantityByCardId.get(card.id) ?? 0;
                return (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCardQuantity(card, qty - 1)}
                      className="h-7 w-7 rounded border border-zinc-300 text-sm dark:border-zinc-700"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{qty}</span>
                    <button
                      onClick={() => setCardQuantity(card, qty + 1)}
                      className="h-7 w-7 rounded border border-zinc-300 text-sm dark:border-zinc-700"
                    >
                      +
                    </button>
                  </div>
                );
              }}
            />
          </div>
        )}

        {deck.cards.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No cards in the main deck yet.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {deck.cards
              .slice()
              .sort((a, b) => a.card.code.localeCompare(b.card.code))
              .map((deckCard) => (
                <li
                  key={deckCard.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{deckCard.card.name}</p>
                    <p className="text-xs text-zinc-500">{deckCard.card.code}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCardQuantity(deckCard.card, deckCard.quantity - 1)}
                      className="h-7 w-7 rounded border border-zinc-300 text-sm dark:border-zinc-700"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{deckCard.quantity}</span>
                    <button
                      onClick={() => setCardQuantity(deckCard.card, deckCard.quantity + 1)}
                      className="h-7 w-7 rounded border border-zinc-300 text-sm dark:border-zinc-700"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
