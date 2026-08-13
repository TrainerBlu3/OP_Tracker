import type { CardDTO } from "@/lib/types";

const MAX_COST_BUCKET = 10;

export interface DeckStats {
  totalCards: number;
  /** Copies at each cost, indexed 0..MAX_COST_BUCKET (last bucket is "10+"). */
  costCurve: number[];
  typeCounts: Record<string, number>;
  colorCounts: Record<string, number>;
  counterCount: number;
  triggerCount: number;
}

/** Pure client-side math over a deck's main-deck cards -- no server round-trip. */
export function computeDeckStats(cards: { card: CardDTO; quantity: number }[]): DeckStats {
  const costCurve = new Array(MAX_COST_BUCKET + 1).fill(0) as number[];
  const typeCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  let totalCards = 0;
  let counterCount = 0;
  let triggerCount = 0;

  for (const { card, quantity } of cards) {
    totalCards += quantity;

    if (card.cost !== null && card.cost !== undefined) {
      const bucket = Math.min(Math.max(card.cost, 0), MAX_COST_BUCKET);
      costCurve[bucket] += quantity;
    }

    typeCounts[card.cardType] = (typeCounts[card.cardType] ?? 0) + quantity;

    for (const color of card.colors) {
      colorCounts[color] = (colorCounts[color] ?? 0) + quantity;
    }

    if (card.roles.includes("Counter")) counterCount += quantity;
    if (card.roles.includes("Trigger")) triggerCount += quantity;
  }

  return { totalCards, costCurve, typeCounts, colorCounts, counterCount, triggerCount };
}
