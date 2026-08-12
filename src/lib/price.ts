/** TCGplayer market price via apitcg.com, formatted for display. Null when apitcg.com has no listing. */
export function formatUSD(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `$${value.toFixed(2)}`;
}
