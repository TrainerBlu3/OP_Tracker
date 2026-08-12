"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CardPicker } from "@/components/CardPicker";
import { CardThumbnail } from "@/components/CardThumbnail";
import { validateDeck } from "@/lib/rules";
import { COLOR_STYLES, type DeckDetailDTO, type DeckCardDTO, type CardDTO, type FormatDTO } from "@/lib/types";
import { formatUSD } from "@/lib/price";

const MAIN_DECK_TYPES = ["CHARACTER", "EVENT", "STAGE"] as const;

export function DeckEditorClient({
  initialDeck,
  formats,
  ownedByCode,
}: {
  initialDeck: DeckDetailDTO;
  formats: FormatDTO[];
  /** Copies owned per card code, summed across all art variants. */
  ownedByCode: Record<string, number>;
}) {
  const router = useRouter();
  const [deck, setDeck] = useState(initialDeck);
  const [name, setName] = useState(initialDeck.name);
  const [showLeaderPicker, setShowLeaderPicker] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [showImportBox, setShowImportBox] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

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
    const prevDeck = deck;

    // Update the screen immediately; sync to the server in the background.
    setDeck((prev) => {
      const existingIndex = prev.cards.findIndex((c) => c.cardId === card.id);
      if (quantity === 0) {
        return { ...prev, cards: prev.cards.filter((c) => c.cardId !== card.id) };
      }
      if (existingIndex === -1) {
        const optimisticEntry: DeckCardDTO = { id: `temp-${card.id}`, deckId: prev.id, cardId: card.id, quantity, card };
        return { ...prev, cards: [...prev.cards, optimisticEntry] };
      }
      const cards = [...prev.cards];
      cards[existingIndex] = { ...cards[existingIndex], quantity };
      return { ...prev, cards };
    });

    try {
      const res = await fetch(`/api/decks/${deck.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, quantity }),
      });
      if (!res.ok) throw new Error("Failed to update deck");
      const { deck: updated } = await res.json();
      setDeck(updated);
    } catch {
      setDeck(prevDeck);
    }
  }

  async function handleImport() {
    if (!importText.trim()) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const res = await fetch(`/api/decks/${deck.id}/cards/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportStatus(data.error ?? "Import failed");
        return;
      }
      setDeck(data.deck);
      const parts = [`Imported ${data.imported} card${data.imported === 1 ? "" : "s"}`];
      if (data.leaderSet) parts.push("set leader");
      if (data.notFound.length > 0) parts.push(`${data.notFound.length} code(s) not found: ${data.notFound.join(", ")}`);
      setImportStatus(parts.join(" — "));
      setImportText("");
    } finally {
      setImporting(false);
    }
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

  // What's missing from inventory, aggregated by card code (any owned art
  // variant counts) -- not tied to the exact printing chosen in the deck.
  const shortfalls = useMemo(() => {
    const neededByCode = new Map<string, { name: string; quantity: number }>();
    if (deck.leader) {
      neededByCode.set(deck.leader.code, { name: deck.leader.name, quantity: 1 });
    }
    for (const dc of deck.cards) {
      const entry = neededByCode.get(dc.card.code) ?? { name: dc.card.name, quantity: 0 };
      entry.quantity += dc.quantity;
      neededByCode.set(dc.card.code, entry);
    }
    const result: { code: string; name: string; needed: number; owned: number; missing: number }[] = [];
    for (const [code, { name, quantity }] of neededByCode) {
      const owned = ownedByCode[code] ?? 0;
      if (owned < quantity) {
        result.push({ code, name, needed: quantity, owned, missing: quantity - owned });
      }
    }
    return result.sort((a, b) => a.code.localeCompare(b.code));
  }, [deck, ownedByCode]);

  // Estimated TCGplayer value, using each card's own market (or low as a
  // fallback) price. Approximate: apitcg.com doesn't have a price for
  // every printing, and a deck's cards can span several printings of the
  // same code -- missingPriceCount flags when the total is a lower bound.
  const costEstimate = useMemo(() => {
    const priceFor = (card: CardDTO) => card.priceMarket ?? card.priceLow ?? null;

    let total = 0;
    let missingPriceCount = 0;
    if (deck.leader) {
      const p = priceFor(deck.leader);
      if (p === null) missingPriceCount++;
      else total += p;
    }
    for (const dc of deck.cards) {
      const p = priceFor(dc.card);
      if (p === null) missingPriceCount++;
      else total += p * dc.quantity;
    }

    let missingCost = 0;
    let missingCostUnknown = false;
    for (const s of shortfalls) {
      const card =
        deck.leader?.code === s.code ? deck.leader : deck.cards.find((dc) => dc.card.code === s.code)?.card;
      const p = card ? priceFor(card) : null;
      if (p === null) missingCostUnknown = true;
      else missingCost += p * s.missing;
    }

    return { total, missingPriceCount, missingCost, missingCostUnknown };
  }, [deck, shortfalls]);

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
            <CardThumbnail imageUrl={deck.leader.imageUrl} />
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
          {formatUSD(costEstimate.total) && (
            <>
              {" "}
              &middot; Estimated value {formatUSD(costEstimate.total)}
              {costEstimate.missingPriceCount > 0 &&
                ` (${costEstimate.missingPriceCount} card${costEstimate.missingPriceCount === 1 ? "" : "s"} missing a price)`}
            </>
          )}
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
        <h2 className="font-medium">Inventory check</h2>
        <p className="mt-1 text-sm text-zinc-500">
          What you still need to acquire, compared against your Inventory (any art variant of a card counts).
        </p>
        {shortfalls.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
            You own enough copies of everything in this deck.
          </p>
        ) : (
          <>
            {formatUSD(costEstimate.missingCost) && (
              <p className="mt-2 text-sm font-medium">
                Cost to acquire what&apos;s missing: {formatUSD(costEstimate.missingCost)}
                {costEstimate.missingCostUnknown && " (some prices unavailable, so this is a lower bound)"}
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-1">
              {shortfalls.map((s) => (
                <li key={s.code} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {s.name} <span className="text-zinc-500">{s.code}</span>
                  </span>
                  <span className="shrink-0 rounded px-1.5 py-0.5 text-xs text-amber-800 bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
                    Own {s.owned}/{s.needed} — need {s.missing} more
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Main deck</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportBox((s) => !s)}
              className="text-sm text-zinc-500 hover:underline"
            >
              {showImportBox ? "Close import" : "Paste decklist"}
            </button>
            <button onClick={() => setShowCardPicker((s) => !s)} className="text-sm text-zinc-500 hover:underline">
              {showCardPicker ? "Done adding" : "Add cards"}
            </button>
          </div>
        </div>

        {showImportBox && (
          <div className="mt-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <p className="mb-2 text-sm text-zinc-500">
              Paste a decklist export (one card per line, e.g. <code>4xOP16-081</code>). A Leader code in the list
              is detected automatically.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder={"2xOP14-096\n1xOP16-079\n4xOP16-081"}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={importing || !importText.trim()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                {importing ? "Importing..." : "Import"}
              </button>
              {importStatus && <p className="text-sm text-zinc-500">{importStatus}</p>}
            </div>
          </div>
        )}

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
                  <div className="flex min-w-0 items-center gap-2">
                    <CardThumbnail imageUrl={deckCard.card.imageUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{deckCard.card.name}</p>
                      <p className="text-xs text-zinc-500">{deckCard.card.code}</p>
                    </div>
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
