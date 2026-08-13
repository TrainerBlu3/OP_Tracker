import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.deck.findUnique({ where: { id }, include: { cards: true } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deck = await prisma.$transaction(async (tx) => {
    const copy = await tx.deck.create({
      data: {
        userId: session.user.id,
        name: `${existing.name} (Copy)`,
        leaderId: existing.leaderId,
        formatId: existing.formatId,
      },
    });
    if (existing.cards.length > 0) {
      await tx.deckCard.createMany({
        data: existing.cards.map((c) => ({ deckId: copy.id, cardId: c.cardId, quantity: c.quantity })),
      });
    }
    return tx.deck.findUniqueOrThrow({
      where: { id: copy.id },
      include: { leader: true, format: true, cards: { include: { card: true } } },
    });
  });

  return NextResponse.json({ deck }, { status: 201 });
}
