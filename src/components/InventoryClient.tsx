"use client";

import { useMemo, useState } from "react";
import { CardPicker } from "@/components/CardPicker";
import { CardThumbnail } from "@/components/CardThumbnail";
import { COLOR_STYLES, type CardDTO, type InventoryItemDTO, type InventoryFolderDTO } from "@/lib/types";

const UNFILED = "__unfiled__";

export function InventoryClient({
  initialItems,
  initialFolders,
}: {
  initialItems: InventoryItemDTO[];
  initialFolders: InventoryFolderDTO[];
}) {
  const [items, setItems] = useState<InventoryItemDTO[]>(initialItems);
  const [folders, setFolders] = useState<InventoryFolderDTO[]>(initialFolders);
  const [showPicker, setShowPicker] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);

  async function setQuantity(card: CardDTO, quantity: number) {
    if (quantity < 0) return;
    const prevItems = items;

    // Update the screen immediately; sync to the server in the background.
    // A temp row (fake id, overwritten once the real one comes back) covers
    // going from "not owned" to owned, since there's no real InventoryItem
    // id to optimistically reuse yet.
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.cardId === card.id);
      if (quantity === 0) {
        return prev.filter((i) => i.cardId !== card.id);
      }
      if (existingIndex === -1) {
        const optimisticItem: InventoryItemDTO = {
          id: `temp-${card.id}`,
          userId: "",
          cardId: card.id,
          quantity,
          foilQty: 0,
          notes: null,
          folderId: null,
          updatedAt: new Date(),
          card,
        };
        return [...prev, optimisticItem].sort((a, b) => a.card.code.localeCompare(b.card.code));
      }
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], quantity };
      return next;
    });

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, quantity }),
      });
      if (!res.ok) throw new Error("Failed to update inventory");
      const { item } = await res.json();
      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.cardId === card.id);
        if (existingIndex === -1) return prev;
        const next = [...prev];
        next[existingIndex] = item;
        return next;
      });
    } catch {
      setItems(prevItems);
    }
  }

  async function removeItem(item: InventoryItemDTO) {
    const res = await fetch(`/api/inventory/${item.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function setItemFolder(item: InventoryItemDTO, folderId: string | null) {
    const prevItems = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, folderId } : i)));
    const res = await fetch(`/api/inventory/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (!res.ok) setItems(prevItems);
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    setFolderError(null);
    try {
      const res = await fetch("/api/inventory/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFolderError(data.error ?? "Failed to create folder");
        return;
      }
      setFolders((prev) => [...prev, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function deleteFolder(folder: InventoryFolderDTO) {
    const res = await fetch(`/api/inventory/folders/${folder.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setItems((prev) => prev.map((i) => (i.folderId === folder.id ? { ...i, folderId: null } : i)));
  }

  const quantityByCardId = new Map(items.map((i) => [i.cardId, i.quantity]));
  const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);

  const groups = useMemo(() => {
    const byFolder = new Map<string, InventoryItemDTO[]>();
    for (const item of items) {
      const key = item.folderId ?? UNFILED;
      byFolder.set(key, [...(byFolder.get(key) ?? []), item]);
    }
    const ordered: { key: string; name: string; folder: InventoryFolderDTO | null; items: InventoryItemDTO[] }[] =
      folders
        .filter((f) => byFolder.has(f.id))
        .map((f) => ({ key: f.id, name: f.name, folder: f, items: byFolder.get(f.id)! }));
    if (byFolder.has(UNFILED)) {
      ordered.push({ key: UNFILED, name: "Unfiled", folder: null, items: byFolder.get(UNFILED)! });
    }
    return ordered;
  }, [items, folders]);

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

      <form onSubmit={createFolder} className="flex flex-wrap items-center gap-2">
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="New folder name (e.g. Blue bulk)"
          className="min-w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={creatingFolder || !newFolderName.trim()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {creatingFolder ? "Creating..." : "New folder"}
        </button>
        {folderError && <p className="text-sm text-red-600 dark:text-red-400">{folderError}</p>}
      </form>

      {showPicker && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <CardPicker
            groupVariants={false}
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
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-500">
                  {group.name} <span className="font-normal">({group.items.length})</span>
                </h2>
                {group.folder && (
                  <button
                    onClick={() => deleteFolder(group.folder!)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete folder
                  </button>
                )}
              </div>
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
                      <th className="px-3 py-2">Folder</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
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
                        <td className="px-3 py-2">
                          <select
                            value={item.folderId ?? ""}
                            onChange={(e) => setItemFolder(item, e.target.value || null)}
                            className="rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            <option value="">Unfiled</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        </td>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
