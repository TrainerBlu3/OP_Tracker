import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma, CardType } from "@/generated/prisma/client";

const SORT_FIELDS = ["name", "cost", "power", "price"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parseIntParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const color = searchParams.get("color");
  const color2 = searchParams.get("color2");
  const cardType = searchParams.get("cardType");
  const setCode = searchParams.get("setCode");
  const block = searchParams.get("block");
  const role = searchParams.get("role");
  const rarity = searchParams.get("rarity");
  const costMin = parseIntParam(searchParams.get("costMin"));
  const costMax = parseIntParam(searchParams.get("costMax"));
  const powerMin = parseIntParam(searchParams.get("powerMin"));
  const powerMax = parseIntParam(searchParams.get("powerMax"));
  const counterMin = parseIntParam(searchParams.get("counterMin"));
  const sortByParam = searchParams.get("sortBy");
  const sortBy: SortField = SORT_FIELDS.includes(sortByParam as SortField) ? (sortByParam as SortField) : "name";
  const sortDir = searchParams.get("sortDir") === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50));

  const where: Prisma.CardWhereInput = {};
  if (q) where.name = { contains: q, mode: "insensitive" };
  // color2 requires both colors present (an AND-combo filter, e.g. "Blue
  // and Yellow"); color alone just requires that one color to be present.
  if (color && color2) where.colors = { hasEvery: [color, color2] };
  else if (color) where.colors = { has: color };
  if (cardType) where.cardType = cardType as CardType;
  if (setCode) where.setCode = setCode;
  if (block) where.block = Number.parseInt(block, 10);
  if (role) where.roles = { has: role };
  if (rarity) where.rarity = rarity;
  if (costMin !== undefined || costMax !== undefined) {
    where.cost = { ...(costMin !== undefined && { gte: costMin }), ...(costMax !== undefined && { lte: costMax }) };
  }
  if (powerMin !== undefined || powerMax !== undefined) {
    where.power = {
      ...(powerMin !== undefined && { gte: powerMin }),
      ...(powerMax !== undefined && { lte: powerMax }),
    };
  }
  if (counterMin !== undefined) where.counter = { gte: counterMin };

  const orderBy: Prisma.CardOrderByWithRelationInput[] =
    sortBy === "name"
      ? [{ name: sortDir }]
      : sortBy === "cost"
        ? [{ cost: { sort: sortDir, nulls: "last" } }]
        : sortBy === "power"
          ? [{ power: { sort: sortDir, nulls: "last" } }]
          : [{ priceMarket: { sort: sortDir, nulls: "last" } }];
  orderBy.push({ setCode: "asc" }, { code: "asc" });

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.card.count({ where }),
  ]);

  return NextResponse.json({ cards, total, page, limit });
}
