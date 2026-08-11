import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deckCardUpsertSchema } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: deckId } = await params;
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = deckCardUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { cardId, quantity } = parsed.data;

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }
  if (card.cardType === "LEADER" || card.cardType === "DON") {
    return NextResponse.json({ error: `${card.cardType} cards can't be added to the main deck list` }, { status: 400 });
  }

  if (quantity === 0) {
    await prisma.deckCard.deleteMany({ where: { deckId, cardId } });
  } else {
    await prisma.deckCard.upsert({
      where: { deckId_cardId: { deckId, cardId } },
      create: { deckId, cardId, quantity },
      update: { quantity },
    });
  }

  const deck2 = await prisma.deck.update({
    where: { id: deckId },
    data: { updatedAt: new Date() },
    include: { leader: true, format: true, cards: { include: { card: true } } },
  });

  return NextResponse.json({ deck: deck2 });
}
