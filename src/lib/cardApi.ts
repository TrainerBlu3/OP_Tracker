/**
 * Client for apitcg.com's shared /api/products endpoint, filtered to the
 * One Piece TCG (?tcg=one-piece&type=card).
 *
 * Base URL, endpoint shape, auth header, and pagination params, plus
 * `normalizeCard()`'s field mapping below, were all confirmed against a
 * real sample response (`npm run sync:cards -- --sample`) in August 2026.
 * Card-specific fields (color, cost, power, etc.) live under `attributes`,
 * keyed by their display name as apitcg.com shows them on the card. If a
 * future API change breaks this, re-run the sample check and fix the
 * mapping below.
 */

const API_BASE_URL = "https://api.apitcg.com/api";

export interface RawApiTcgCardAttributes {
  Rarity?: string;
  Number?: string;
  Description?: string;
  Color?: string;
  CardType?: string;
  Cost?: string;
  Power?: string;
  Life?: string;
  Counter?: string;
  Attribute?: string;
  Subtypes?: string;
  Trigger?: string;
  Artist?: string;
  [key: string]: unknown;
}

export interface RawApiTcgCard {
  _id?: number | string;
  code?: string;
  name?: string;
  set?: { _id?: string; name?: string; code?: string } | null;
  images?: { small?: string; medium?: string; large?: string }[] | null;
  attributes?: RawApiTcgCardAttributes;
  [key: string]: unknown;
}

export interface ApiTcgListResponse {
  data: RawApiTcgCard[];
  page?: number;
  total?: number;
  totalPages?: number;
  pageSize?: number;
}

export interface FetchCardsParams {
  page?: number;
  limit?: number;
  name?: string;
}

function getApiKey(): string {
  const key = process.env.APITCG_API_KEY;
  if (!key) {
    throw new Error(
      "APITCG_API_KEY is not set. Register at https://apitcg.com/register, grab your key from the Developer Platform, then add it to .env."
    );
  }
  return key;
}

/**
 * apitcg.com's own `set` query param on this endpoint doesn't actually
 * filter (confirmed: any value returns zero results), so `--set=` is
 * implemented client-side in sync-cards.ts by matching the code prefix
 * against every page instead.
 */
export async function fetchCardPage(params: FetchCardsParams = {}): Promise<ApiTcgListResponse> {
  const query = new URLSearchParams();
  query.set("tcg", "one-piece");
  query.set("type", "card");
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 100));
  if (params.name) query.set("name", params.name);

  const res = await fetch(`${API_BASE_URL}/products?${query.toString()}`, {
    headers: { "x-api-key": getApiKey() },
  });

  if (!res.ok) {
    throw new Error(`apitcg.com request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as ApiTcgListResponse;
}

function toStringArray(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(/[/,]/).map((s) => s.trim()).filter(Boolean);
}

function toInt(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeCardType(raw: string | undefined): "LEADER" | "CHARACTER" | "EVENT" | "STAGE" | "DON" {
  const t = (raw ?? "").toUpperCase();
  if (t.includes("LEADER")) return "LEADER";
  if (t.includes("EVENT")) return "EVENT";
  if (t.includes("STAGE")) return "STAGE";
  if (t.includes("DON")) return "DON";
  return "CHARACTER";
}

/** Maps a raw apitcg.com card into our Prisma `Card` create/update shape. */
export function normalizeCard(raw: RawApiTcgCard) {
  const code = raw.code;
  if (!code) {
    throw new Error(`Card is missing a code: ${JSON.stringify(raw)}`);
  }
  if (raw._id === undefined || raw._id === null) {
    throw new Error(`Card is missing an _id: ${JSON.stringify(raw)}`);
  }

  const attrs = raw.attributes ?? {};
  // Derived from the code prefix (e.g. "OP16", "EB01", "ST22"), not
  // raw.set.code -- that field is missing for mainline "OP" sets and
  // inconsistently formatted ("EB-01" vs "ST-22") when present.
  const setCode = code.split("-")[0];
  const image = raw.images?.[0];

  return {
    apitcgId: String(raw._id),
    code,
    name: raw.name ?? code,
    cardType: normalizeCardType(attrs.CardType),
    colors: toStringArray(attrs.Color),
    cost: toInt(attrs.Cost),
    power: toInt(attrs.Power),
    counter: toInt(attrs.Counter),
    life: toInt(attrs.Life),
    attribute: attrs.Attribute ?? null,
    family: attrs.Subtypes ?? null,
    ability: attrs.Description ?? null,
    triggerText: attrs.Trigger ?? null,
    rarity: attrs.Rarity ?? null,
    setCode,
    setName: raw.set?.name ?? null,
    imageUrl: image?.large ?? image?.medium ?? image?.small ?? null,
  };
}
