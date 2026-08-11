"use client";

import { useState } from "react";
import { CardPicker } from "@/components/CardPicker";
import { CardThumbnail } from "@/components/CardThumbnail";
import { COLOR_STYLES, type CardDTO, type InventoryItemDTO } from "@/lib/types";

export function InventoryClient({ initialItems }: { initialItems: InventoryItemDTO[] }) {
  const [items, setItems] = useState<InventoryItemDTO[]>(initialItems);
  const [showPicker, setShowPicker] = useState(false);

  async function setQuantity(card: CardDTO, quantity: number) {
    if (quantity < 0) return;
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, quantity }),
    });
    if (!res.ok) return;
    const { item } = await res.json();

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cardId === card.id);
      if (quantity === 0) {
        return prev.filter((i) => i.cardId !== card.id);
      }
      if (existingIndex === -1) {
        return [...prev, item].sort((a, b) => a.card.code.localeCompare(b.card.code));
      }
      const next = [...prev];
      next[existingIndex] = item;
      return next;
    });
  }

  async function removeItem(item: InventoryItemDTO) {
    const res = await fetch(`/api/inventory/${item.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const quantityByCardId = new Map(items.map((i) => [i.cardId, i.quantity]));
  const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {items.length} unique cards, {totalCards} total copies
        </p>
        <button
          onClick={() => setShowPicker((s) => !s)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showPicker ? "Done adding" : "Add cards"}
        </button>
      </div>

      {showPicker && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <CardPicker
            renderAction={(card) => {
              const qty = quantityByCardId.get(card.id) ?? 0;
              return (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQuantity(card, qty - 1)}
                    className="h-7 w-7 rounded border border-zinc-300 text-sm dark:border-zinc-700"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm">{qty}</span>
                  <button
                    onClick={() => setQuantity(card, qty + 1)}
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

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your collection is empty. Click <strong>Add cards</strong> to get started.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2">Card</th>
                <th className="px-3 py-2">Set</th>
                <th className="px-3 py-2">Colors</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Foil</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    <CardThumbnail imageUrl={item.card.imageUrl} />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{item.card.name}</p>
                    <p className="text-xs text-zinc-500">{item.card.code}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{item.card.setCode}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.card.colors.map((c) => (
                        <span key={c} className={`rounded px-1.5 py-0.5 text-xs ${COLOR_STYLES[c] ?? ""}`}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => setQuantity(item.card, Number.parseInt(e.target.value, 10) || 0)}
                      className="w-16 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{item.foilQty}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeItem(item)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
