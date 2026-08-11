import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deckCreateSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const decks = await prisma.deck.findMany({
    where: { userId: session.user.id },
    include: { leader: true, format: true, cards: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ decks });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = deckCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      formatId: parsed.data.formatId,
    },
  });

  return NextResponse.json({ deck }, { status: 201 });
}
