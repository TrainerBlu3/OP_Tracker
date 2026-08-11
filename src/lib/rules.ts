import { UNCLASSIFIED_BLOCK } from "@/lib/blockMap";

export type DeckCardType = "LEADER" | "CHARACTER" | "EVENT" | "STAGE" | "DON";

export interface LegalityCard {
  id: string;
  code: string;
  name: string;
  cardType: DeckCardType;
  colors: string[];
  block: number;
}

export interface FormatRules {
  name: string;
  deckSize: number;
  maxCopiesPerCard: number;
  bannedBlocks: number[];
  bannedCardCodes: string[];
}

export interface DeckCardEntry {
  card: LegalityCard;
  quantity: number;
}

export interface DeckValidationInput {
  leader: LegalityCard | null;
  cards: DeckCardEntry[];
  format: FormatRules | null;
}

export interface DeckValidationResult {
  isLegal: boolean;
  errors: string[];
  warnings: string[];
  totalMainDeckCards: number;
}

/** Is this card banned by the format's block/card-code rules? Ignores color/copy limits. */
export function isCardFormatLegal(card: LegalityCard, format: FormatRules | null): boolean {
  if (!format) return true;
  if (format.bannedCardCodes.includes(card.code)) return false;
  if (card.block !== UNCLASSIFIED_BLOCK && format.bannedBlocks.includes(card.block)) {
    return false;
  }
  return true;
}

export function validateDeck({ leader, cards, format }: DeckValidationInput): DeckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!leader) {
    errors.push("Deck needs exactly one Leader card.");
  } else if (leader.cardType !== "LEADER") {
    errors.push(`"${leader.name}" is not a Leader card.`);
  } else if (!isCardFormatLegal(leader, format)) {
    errors.push(`Leader "${leader.name}" is banned in ${format?.name ?? "this format"} (Block ${leader.block}).`);
  } else if (leader.block === UNCLASSIFIED_BLOCK) {
    warnings.push(`Leader "${leader.name}" has an unconfirmed legality block -- verify it manually.`);
  }

  const deckSize = format?.deckSize ?? 50;
  const maxCopies = format?.maxCopiesPerCard ?? 4;

  let totalMainDeckCards = 0;
  const leaderColors = new Set(leader?.colors ?? []);

  for (const entry of cards) {
    const { card, quantity } = entry;

    if (card.cardType === "LEADER") {
      errors.push(`"${card.name}" is a Leader and can't be in the main deck.`);
      continue;
    }
    if (card.cardType === "DON") {
      errors.push(`"${card.name}" is a DON!! card; the DON deck is fixed and isn't built here.`);
      continue;
    }

    totalMainDeckCards += quantity;

    if (quantity > maxCopies) {
      errors.push(`"${card.name}" has ${quantity} copies, but the limit is ${maxCopies}.`);
    }

    if (leader && leaderColors.size > 0) {
      const sharesColor = card.colors.some((c) => leaderColors.has(c));
      if (!sharesColor) {
        errors.push(
          `"${card.name}" (${card.colors.join("/")}) doesn't share a color with the Leader (${[...leaderColors].join("/")}).`
        );
      }
    }

    if (!isCardFormatLegal(card, format)) {
      errors.push(`"${card.name}" is banned in ${format?.name ?? "this format"} (Block ${card.block}).`);
    } else if (card.block === UNCLASSIFIED_BLOCK) {
      warnings.push(`"${card.name}" has an unconfirmed legality block -- verify it manually.`);
    }
  }

  if (totalMainDeckCards !== deckSize) {
    errors.push(`Main deck has ${totalMainDeckCards} cards; it must have exactly ${deckSize}.`);
  }

  return {
    isLegal: errors.length === 0,
    errors,
    warnings,
    totalMainDeckCards,
  };
}
