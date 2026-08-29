/** TCGplayer market price via apitcg.com, formatted for display. Null when apitcg.com has no listing. */
export function formatUSD(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `$${value.toFixed(2)}`;
}

/**
 * Rough total deck value for list/preview contexts (deck editor has its own
 * fuller costEstimate with shortfall pricing -- this is the lighter version
 * for a summary tile). Missing prices count as $0, so this is a lower bound.
 */
export function estimateDeckValue(
  leader: { priceMarket: number | null; priceLow: number | null } | null | undefined,
  cards: { card: { priceMarket: number | null; priceLow: number | null }; quantity: number }[]
): number {
  const priceFor = (card: { priceMarket: number | null; priceLow: number | null }) =>
    card.priceMarket ?? card.priceLow ?? 0;

  let total = leader ? priceFor(leader) : 0;
  for (const { card, quantity } of cards) {
    total += priceFor(card) * quantity;
  }
  return total;
}
