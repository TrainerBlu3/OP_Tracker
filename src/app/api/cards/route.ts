import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma, CardType } from "@/generated/prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const color = searchParams.get("color");
  const color2 = searchParams.get("color2");
  const cardType = searchParams.get("cardType");
  const setCode = searchParams.get("setCode");
  const block = searchParams.get("block");
  const role = searchParams.get("role");
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

  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where,
      orderBy: [{ setCode: "asc" }, { code: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.card.count({ where }),
  ]);

  return NextResponse.json({ cards, total, page, limit });
}
