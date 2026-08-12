import type { CardDTO } from "@/lib/types";

const REPRINT_SUFFIX = /\s*-\s*[A-Za-z]+\d+-\d+\s*\([^)]*\)\s*$/;
const TRAILING_PARENS = /(\s*\([^)]*\))+\s*$/;
const SPECIAL_MARKERS = ["Alternate Art", "Manga", "(SP)", "Parallel", "Reprint"];

/**
 * Strips the trailing annotations apitcg.com adds for reprints/alt-arts,
 * e.g. "Yamato (079) (Alternate Art)" -> "Yamato",
 * "Franky - OP09-072 (Reprint)" -> "Franky".
 */
function baseCardName(name: string): string {
  return name.replace(REPRINT_SUFFIX, "").replace(TRAILING_PARENS, "").trim();
}

function specialScore(name: string): number {
  return SPECIAL_MARKERS.some((marker) => name.includes(marker)) ? 1 : 0;
}

/** Sorts art variants of the same card so the "plain" printing comes first. */
export function sortVariants<T extends { code: string; name: string }>(variants: T[]): T[] {
  return [...variants].sort((a, b) => specialScore(a.name) - specialScore(b.name) || a.code.localeCompare(b.code));
}

export interface CardVariantGroup {
  key: string;
  baseName: string;
  variants: CardDTO[];
}

/**
 * Groups cards that are the same underlying card (name + full stat line
 * match) across different printings/art, purely for display -- inventory
 * and deck-list quantities still track each exact card id/code separately.
 */
export function groupCardVariants(cards: CardDTO[]): CardVariantGroup[] {
  const groups = new Map<string, CardVariantGroup>();

  for (const card of cards) {
    const baseName = baseCardName(card.name);
    const key = [
      baseName,
      card.cardType,
      [...card.colors].sort().join(","),
      card.cost,
      card.power,
      card.counter,
      card.life,
      card.attribute,
      card.family,
      card.ability,
    ].join("|");

    let group = groups.get(key);
    if (!group) {
      group = { key, baseName, variants: [] };
      groups.set(key, group);
    }
    group.variants.push(card);
  }

  for (const group of groups.values()) {
    group.variants = sortVariants(group.variants);
  }

  return [...groups.values()];
}
