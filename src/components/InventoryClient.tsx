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
  const [openFolderKey, setOpenFolderKey] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const [bulkMoving, setBulkMoving] = useState(false);

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
    setOpenFolderKey((k) => (k === folder.id ? null : k));
  }

  function openFolder(key: string | null) {
    setOpenFolderKey(key);
    setSelectedIds(new Set());
    setBulkMoveTarget("");
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Local-only selection + a single bulk request on "Move", instead of one
  // PATCH per item -- moving many cards at once used to fire a request per
  // row, which compounds badly as a collection grows.
  async function bulkMove(itemIds: string[]) {
    if (itemIds.length === 0) return;
    const folderId = bulkMoveTarget || null;
    const prevItems = items;
    setBulkMoving(true);
    setItems((prev) => prev.map((i) => (itemIds.includes(i.id) ? { ...i, folderId } : i)));
    try {
      const res = await fetch("/api/inventory/bulk-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, folderId }),
      });
      if (!res.ok) throw new Error("Bulk move failed");
      setSelectedIds(new Set());
      setBulkMoveTarget("");
    } catch {
      setItems(prevItems);
    } finally {
      setBulkMoving(false);
    }
  }

  const quantityByCardId = new Map(items.map((i) => [i.cardId, i.quantity]));
  const totalCards = items.reduce((sum, i) => sum + i.quantity, 0);

  const groups = useMemo(() => {
    const byFolder = new Map<string, InventoryItemDTO[]>();
    for (const item of items) {
      const key = item.folderId ?? UNFILED;
      byFolder.set(key, [...(byFolder.get(key) ?? []), item]);
    }
    // Every folder gets a tile, even freshly-created empty ones -- only the
    // "Unfiled" bucket is conditional, since there's no such thing as an
    // empty one worth showing.
    const ordered: { key: string; name: string; folder: InventoryFolderDTO | null; items: InventoryItemDTO[] }[] =
      folders.map((f) => ({ key: f.id, name: f.name, folder: f, items: byFolder.get(f.id) ?? [] }));
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

      {items.length === 0 && folders.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your collection is empty. Click <strong>Add cards</strong> to get started.
        </p>
      ) : openFolderKey === null ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map((group) => (
            <li key={group.key}>
              <button
                onClick={() => openFolder(group.key)}
                className="flex w-full flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-left transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  {group.items.slice(0, 4).map((item, i) => (
                    <div
                      key={item.id}
                      className="shrink-0 rounded shadow-sm ring-1 ring-black/5"
                      style={{ marginLeft: i === 0 ? 0 : -18 }}
                    >
                      <CardThumbnail imageUrl={item.card.imageUrl} className="h-16 w-11 rounded object-cover" />
                    </div>
                  ))}
                  {group.items.length === 0 && (
                    <div className="flex h-16 w-full items-center justify-center text-xs text-zinc-400">Empty</div>
                  )}
                </div>
                <div>
                  <p className="truncate text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-zinc-500">
                    {group.items.length} card{group.items.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        (() => {
          const group = groups.find((g) => g.key === openFolderKey);
          if (!group) return null;
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => openFolder(null)}
                  className="text-sm text-zinc-500 hover:underline"
                >
                  &larr; All folders
                </button>
                <div className="flex items-center gap-3">
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
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <span>{selectedIds.size} selected</span>
                  <select
                    value={bulkMoveTarget}
                    onChange={(e) => setBulkMoveTarget(e.target.value)}
                    className="rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">Unfiled</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => bulkMove([...selectedIds])}
                    disabled={bulkMoving}
                    className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {bulkMoving ? "Moving..." : "Move"}
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-zinc-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
                    <tr>
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={group.items.length > 0 && selectedIds.size === group.items.length}
                          onChange={(e) =>
                            setSelectedIds(e.target.checked ? new Set(group.items.map((i) => i.id)) : new Set())
                          }
                        />
                      </th>
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
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                          />
                        </td>
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
          );
        })()
      )}
    </div>
  );
}
