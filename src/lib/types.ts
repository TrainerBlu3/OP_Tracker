import type { Card, InventoryItem, InventoryFolder, Format, Deck, DeckCard, Role } from "@/generated/prisma/client";

export type CardDTO = Card;
export type InventoryFolderDTO = InventoryFolder;

/** A User row with passwordHash stripped -- what admin endpoints return. */
export interface AdminUserDTO {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}
export type InventoryItemDTO = InventoryItem & { card: CardDTO };
export type FormatDTO = Format;
export type DeckListItemDTO = Deck & { leader: CardDTO | null; format: FormatDTO | null; cards: DeckCard[] };
export type DeckCardDTO = DeckCard & { card: CardDTO };
export type DeckDetailDTO = Deck & { leader: CardDTO | null; format: FormatDTO | null; cards: DeckCardDTO[] };

export const CARD_TYPES = ["LEADER", "CHARACTER", "EVENT", "STAGE", "DON"] as const;
export const CARD_COLORS = ["Red", "Green", "Blue", "Purple", "Black", "Yellow"] as const;
export const RARITIES = ["L", "C", "UC", "R", "SR", "SEC", "TR", "PR"] as const;
export const SORT_FIELDS = [
  { value: "name", label: "Name" },
  { value: "cost", label: "Cost" },
  { value: "power", label: "Power" },
  { value: "price", label: "Price" },
] as const;

export const COLOR_STYLES: Record<string, string> = {
  Red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  Green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Purple: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  Black: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200",
  Yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
};

/** Solid fills for the cost-pip badge on card tiles (vs. the pastel pill styles above). */
export const COLOR_SOLID: Record<string, string> = {
  Red: "bg-red-600",
  Green: "bg-emerald-600",
  Blue: "bg-blue-600",
  Purple: "bg-purple-600",
  Black: "bg-zinc-700",
  Yellow: "bg-yellow-500",
};

export function formatBlockLabel(block: number): string {
  return block > 0 ? `Block #${block}` : "Block unconfirmed";
}
