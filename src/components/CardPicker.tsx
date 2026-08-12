"use client";

import { useEffect, useMemo, useState } from "react";
import { isCardFormatLegal, type FormatRules } from "@/lib/rules";
import { CARD_COLORS, CARD_TYPES, COLOR_STYLES, type CardDTO } from "@/lib/types";
import { CardThumbnail } from "@/components/CardThumbnail";
import { groupCardVariants } from "@/lib/cardVariants";

interface CardPickerProps {
  /** Renders the action button/control for a given card (e.g. "Add", quantity stepper). */
  renderAction: (card: CardDTO) => React.ReactNode;
  /** Restricts the type filter dropdown to these types (e.g. hide Leader/DON from the main-deck picker). */
  typeOptions?: readonly string[];
  /** Locks the type filter to a single value and hides the dropdown (e.g. the leader picker). */
  lockedCardType?: string;
  /** When set, flags/optionally hides cards banned by this format's block/card-code rules. */
  format?: FormatRules | null;
  /**
   * Collapse same-name-and-stats printings (true reprints/parallels) into
   * one tile with a variant dropdown. On for deck building, where any
   * matching printing plays identically; off for inventory, where you're
   * tracking exactly which printing you physically own.
   */
  groupVariants?: boolean;
}

export function CardPicker({
  renderAction,
  typeOptions = CARD_TYPES,
  lockedCardType,
  format,
  groupVariants = true,
}: CardPickerProps) {
  const [q, setQ] = useState("");
  const [color, setColor] = useState("");
  const [cardType, setCardType] = useState(lockedCardType ?? "");
  const [hideIllegal, setHideIllegal] = useState(true);
  const [cards, setCards] = useState<CardDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [variantIndex, setVariantIndex] = useState<Record<string, number>>({});

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (color) p.set("color", color);
    if (cardType) p.set("cardType", cardType);
    p.set("limit", "60");
    return p.toString();
  }, [q, color, cardType]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cards?${params}`);
        const data = await res.json();
        if (cancelled) return;
        setCards(data.cards ?? []);
        setTotal(data.total ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const visibleCards =
    format && hideIllegal ? cards.filter((c) => isCardFormatLegal(c, format)) : cards;

  const groups = useMemo(
    () =>
      groupVariants
        ? groupCardVariants(visibleCards)
        : visibleCards.map((card) => ({ key: card.id, baseName: card.name, variants: [card] })),
    [visibleCards, groupVariants]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="min-w-48 flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Any color</option>
          {CARD_COLORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {!lockedCardType && (
          <select
            value={cardType}
            onChange={(e) => setCardType(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Any type</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {format && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={hideIllegal} onChange={(e) => setHideIllegal(e.target.checked)} />
            Hide cards banned in {format.name}
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : visibleCards.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {cards.length === 0
            ? <>No cards found. If your catalog is empty, run <code>npm run sync:cards</code> first.</>
            : "No cards match these filters (some may be hidden by the format ban list)."}
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            Showing {groups.length} card{groups.length === 1 ? "" : "s"} ({visibleCards.length} printing
            {visibleCards.length === 1 ? "" : "s"}) of {total}
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => {
              const selectedIdx = variantIndex[group.key] ?? 0;
              const card = group.variants[selectedIdx] ?? group.variants[0];
              const legal = format ? isCardFormatLegal(card, format) : true;
              const illegalReason = !legal ? `Banned in ${format?.name} (Block ${card.block})` : undefined;
              return (
                <li
                  key={group.key}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                    illegalReason
                      ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                  title={illegalReason}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CardThumbnail imageUrl={card.imageUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{group.baseName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                        <span>{card.code}</span>
                        {card.colors.map((c) => (
                          <span key={c} className={`rounded px-1.5 py-0.5 ${COLOR_STYLES[c] ?? ""}`}>
                            {c}
                          </span>
                        ))}
                        {card.cost !== null && <span>Cost {card.cost}</span>}
                      </div>
                      {group.variants.length > 1 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {group.variants.map((v, i) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setVariantIndex((s) => ({ ...s, [group.key]: i }))}
                              title={`${v.code} — ${v.name}`}
                              className={`rounded ${
                                i === selectedIdx
                                  ? "ring-2 ring-blue-500"
                                  : "opacity-60 ring-1 ring-zinc-300 hover:opacity-100 dark:ring-zinc-700"
                              }`}
                            >
                              <CardThumbnail imageUrl={v.imageUrl} className="h-9 w-7 rounded object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      {illegalReason && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{illegalReason}</p>}
                    </div>
                  </div>
                  <div className="shrink-0">{renderAction(card)}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
