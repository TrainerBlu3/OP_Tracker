/**
 * Maps a card's set code to its legality "block".
 *
 * Per the official rules (verified via web search, Aug 2026): mainline "OP"
 * sets are grouped in fours -- OP01-OP04 = Block 1, OP05-OP08 = Block 2,
 * OP09-OP12 = Block 3, and so on. Standard format keeps the 3 most recent
 * blocks legal and rotates the oldest out every April, so the set of
 * "banned" blocks in the Standard Format row (see prisma/seed.ts) changes
 * over time -- update it there, not here.
 *
 * Starter deck (ST-*) and Extra Booster (EB-*) sets don't follow the
 * numeric OP pattern and aren't confidently known here, so they're left
 * unclassified (block 0) until you fill in EXPLICIT_BLOCK_OVERRIDES below.
 * Cards with block 0 are never auto-banned by a format, but the deck
 * legality UI flags them as "legality unknown" so they don't silently
 * pass as legal.
 */

export const UNCLASSIFIED_BLOCK = 0;

/** Set codes that don't fit the "OPnn" pattern. Fill in as you confirm them. */
const EXPLICIT_BLOCK_OVERRIDES: Record<string, number> = {
  // "ST01": 1,
  // "EB01": 2,
};

export function getBlockForSetCode(setCode: string): number {
  const normalized = setCode.trim().toUpperCase();

  if (normalized in EXPLICIT_BLOCK_OVERRIDES) {
    return EXPLICIT_BLOCK_OVERRIDES[normalized];
  }

  const match = normalized.match(/^OP(\d+)$/);
  if (match) {
    const setNumber = Number.parseInt(match[1], 10);
    return Math.ceil(setNumber / 4);
  }

  return UNCLASSIFIED_BLOCK;
}
