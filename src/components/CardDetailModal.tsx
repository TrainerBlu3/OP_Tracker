"use client";

import { useEffect } from "react";
import { formatUSD } from "@/lib/price";
import { COLOR_STYLES, formatBlockLabel, type CardDTO } from "@/lib/types";

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800">
      <span className="text-zinc-500">{label}:</span> <span className="font-medium">{value}</span>
    </span>
  );
}

export function CardDetailModal({ card, onClose }: { card: CardDTO; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const price = formatUSD(card.priceMarket) ?? formatUSD(card.priceLow);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-lg bg-white p-5 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{card.name}</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {card.code}
              {card.rarity ? ` | ${card.rarity}` : ""} | {formatBlockLabel(card.block)}
              {price ? ` | ${price}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            &times;
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <div className="aspect-[5/7] w-full shrink-0 overflow-hidden rounded-md bg-zinc-100 sm:w-56 dark:bg-zinc-800">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external, unknown-domain card art
              <img src={card.imageUrl} alt={card.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-3 text-center text-sm text-zinc-400">
                No image synced
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge label="Category" value={card.cardType} />
              {card.colors.length > 0 && <Badge label="Color" value={card.colors.join("/")} />}
              {card.attribute && <Badge label="Attribute" value={card.attribute} />}
              {card.cost !== null && <Badge label="Cost" value={String(card.cost)} />}
              {card.power !== null && <Badge label="Power" value={String(card.power)} />}
              {card.counter !== null && <Badge label="Counter" value={String(card.counter)} />}
              {card.life !== null && <Badge label="Life" value={String(card.life)} />}
              {card.family && <Badge label="Type" value={card.family} />}
              {card.colors.length > 0 && (
                <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${COLOR_STYLES[card.colors[0]] ?? ""}`}>
                  {card.colors.join(" / ")}
                </span>
              )}
            </div>

            {card.roles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            {card.ability && (
              <div className="rounded-md bg-zinc-100 p-3 text-sm leading-relaxed dark:bg-zinc-800">{card.ability}</div>
            )}
            {card.triggerText && (
              <div className="rounded-md bg-zinc-100 p-3 text-sm leading-relaxed dark:bg-zinc-800">
                <span className="font-semibold">Trigger:</span> {card.triggerText}
              </div>
            )}
            {!card.ability && !card.triggerText && (
              <p className="text-sm text-zinc-500">No ability text on file for this card.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
