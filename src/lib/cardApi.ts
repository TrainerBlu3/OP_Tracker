/**
 * Client for apitcg.com's shared /api/products endpoint, filtered to the
 * One Piece TCG (?tcg=one-piece&type=card).
 *
 * Base URL, endpoint shape, auth header, and pagination params are taken
 * directly from apitcg.com's own OpenAPI docs. The individual card object's
 * field names below are still best-effort, though -- this sandbox's network
 * egress proxy blocks both apitcg.com and api.apitcg.com, so there was no
 * way to fetch a real sample response to confirm them. Before relying on
 * this in production:
 *
 *   1. Get a free API key: register at https://apitcg.com/register, then
 *      find it in the Developer Platform's API Key page.
 *   2. Set APITCG_API_KEY in .env
 *   3. Run `npm run sync:cards -- --sample` to print one raw card object
 *   4. Compare it against `normalizeCard()` below and fix any field-name
 *      mismatches.
 */

const API_BASE_URL = "https://api.apitcg.com/api";

export interface RawApiTcgCard {
  id?: string;
  code?: string;
  cardNumber?: string;
  name?: string;
  type?: string;
  cardType?: string;
  rarity?: string;
  cost?: number | string | null;
  power?: number | string | null;
  counter?: number | string | null;
  life?: number | string | null;
  color?: string | string[] | null;
  colors?: string[] | null;
  family?: string | null;
  attribute?: string | { name?: string } | null;
  effect?: string | null;
  ability?: string | null;
  trigger?: string | null;
  set?: { id?: string; name?: string } | string | null;
  set_name?: string | null;
  images?: { small?: string; large?: string } | null;
  image?: string | null;
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
  set?: string;
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

export async function fetchCardPage(params: FetchCardsParams = {}): Promise<ApiTcgListResponse> {
  const query = new URLSearchParams();
  query.set("tcg", "one-piece");
  query.set("type", "card");
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 100));
  if (params.name) query.set("name", params.name);
  if (params.set) query.set("set", params.set);

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
  const code = raw.code ?? raw.cardNumber;
  if (!code) {
    throw new Error(`Card is missing a code/cardNumber: ${JSON.stringify(raw)}`);
  }

  const setCode = typeof raw.set === "string" ? raw.set : raw.set?.id ?? code.split("-")[0];
  const setName = typeof raw.set === "object" ? raw.set?.name : raw.set_name ?? undefined;
  const attribute = typeof raw.attribute === "string" ? raw.attribute : raw.attribute?.name ?? undefined;

  return {
    code,
    name: raw.name ?? code,
    cardType: normalizeCardType(raw.type ?? raw.cardType),
    colors: toStringArray(raw.colors ?? raw.color),
    cost: toInt(raw.cost),
    power: toInt(raw.power),
    counter: toInt(raw.counter),
    life: toInt(raw.life),
    attribute: attribute ?? null,
    family: raw.family ?? null,
    ability: raw.ability ?? raw.effect ?? null,
    triggerText: raw.trigger ?? null,
    rarity: raw.rarity ?? null,
    setCode,
    setName: setName ?? null,
    imageUrl: raw.images?.large ?? raw.images?.small ?? raw.image ?? null,
  };
}
