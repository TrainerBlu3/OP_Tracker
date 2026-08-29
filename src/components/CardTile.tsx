"use client";

import { useState } from "react";
import { CardDetailModal } from "@/components/CardDetailModal";
import { COLOR_SOLID, type CardDTO } from "@/lib/types";

interface CardTileProps {
  card: CardDTO;
  /** Overrides the displayed name (e.g. a variant group's collapsed base name). Defaults to card.name. */
  displayName?: string;
  /** Shown as a badge in the top-right corner when > 0 (e.g. copies owned/in a deck). */
  quantity?: number;
  /** Rendered below the name -- e.g. +/- quantity steppers or an "Add" button. */
  action?: React.ReactNode;
  /** Rendered between the name and `action` -- e.g. role tags, price, variant swatches. */
  extra?: React.ReactNode;
  illegalReason?: string;
  /**
   * Set false for read-only contexts where the tile sits inside its own
   * link/button (e.g. a deck-list preview) -- a nested <button> there would
   * be invalid HTML. Drops the click-to-detail modal; shows plain art only.
   */
  interactive?: boolean;
  /** Hide the name/code caption below the art -- for dense preview grids. */
  hideCaption?: boolean;
}

export function CardTile({
  card,
  displayName,
  quantity,
  action,
  extra,
  illegalReason,
  interactive = true,
  hideCaption = false,
}: CardTileProps) {
  const [showDetail, setShowDetail] = useState(false);
  const primaryColor = card.colors[0];

  const art = (
    <>
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, unknown-domain card art
        <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-zinc-400">
          {card.name}
        </div>
      )}

      {card.cost !== null && (
        <span
          className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-white/80 ${
            COLOR_SOLID[primaryColor] ?? "bg-zinc-600"
          }`}
        >
          {card.cost}
        </span>
      )}

      {card.power !== null && (
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {card.power}
        </span>
      )}

      {quantity !== undefined && quantity > 0 && (
        <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900/90 text-xs font-bold text-white ring-2 ring-white/80">
          {quantity}
        </span>
      )}
    </>
  );

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border p-2 ${
        illegalReason
          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
      title={illegalReason}
    >
      {interactive ? (
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          className="relative aspect-[5/7] w-full overflow-hidden rounded-md bg-zinc-100 text-left dark:bg-zinc-800"
        >
          {art}
        </button>
      ) : (
        <div className="relative aspect-[5/7] w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">{art}</div>
      )}

      {!hideCaption && (
        <>
          <p className="truncate text-xs font-medium" title={displayName ?? card.name}>
            {displayName ?? card.name}
          </p>
          <p className="truncate text-[10px] text-zinc-500">{card.code}</p>
        </>
      )}
      {illegalReason && <p className="text-[10px] text-red-600 dark:text-red-400">{illegalReason}</p>}
      {extra}
      {action}

      {interactive && showDetail && <CardDetailModal card={card} onClose={() => setShowDetail(false)} />}
    </div>
  );
}
