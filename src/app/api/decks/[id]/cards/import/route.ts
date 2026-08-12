import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deckImportSchema } from "@/lib/validation";
import { sortVariants } from "@/lib/cardVariants";

/**
 * Parses decklist export lines. Supports both "4xOP16-081" (onepiece.gg)
 * and "1 OP15-058 Enel" (qty, code, name, space-separated) -- the "x" and
 * the trailing card name are both optional. Only the code is required.
 */
function parseDecklist(text: string): { code: string; quantity: number }[] {
  const entries: { code: string; quantity: number }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s*[xX]?\s*([A-Za-z0-9]+-[A-Za-z0-9]+)/);
    if (!match) continue;
    entries.push({ quantity: Number.parseInt(match[1], 10), code: match[2].toUpperCase() });
  }
  return entries;
}

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
  const parsed = deckImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const entries = parseDecklist(parsed.data.text);
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No lines matched the "4xOP16-081" format' }, { status: 400 });
  }

  const cards = await prisma.card.findMany({ where: { code: { in: entries.map((e) => e.code) } } });
  // Multiple rows can share a code (art variants); pick the "plain"
  // printing as the representative one for deck-building purposes.
  const cardsByCode = new Map<string, typeof cards>();
  for (const card of cards) {
    cardsByCode.set(card.code, [...(cardsByCode.get(card.code) ?? []), card]);
  }
  const cardByCode = new Map(
    [...cardsByCode.entries()].map(([code, variants]) => [code, sortVariants(variants)[0]])
  );

  const notFound: string[] = [];
  let leaderId: string | null = null;
  const deckCardUpdates: { cardId: string; quantity: number }[] = [];

  for (const { code, quantity } of entries) {
    const card = cardByCode.get(code);
    if (!card) {
      notFound.push(code);
      continue;
    }
    if (card.cardType === "LEADER") {
      leaderId = card.id;
    } else if (card.cardType !== "DON") {
      deckCardUpdates.push({ cardId: card.id, quantity: Math.min(quantity, 4) });
    }
  }

  await prisma.$transaction([
    ...(leaderId ? [prisma.deck.update({ where: { id: deckId }, data: { leaderId } })] : []),
    ...deckCardUpdates.map((u) =>
      prisma.deckCard.upsert({
        where: { deckId_cardId: { deckId, cardId: u.cardId } },
        create: { deckId, cardId: u.cardId, quantity: u.quantity },
        update: { quantity: u.quantity },
      })
    ),
  ]);

  const updatedDeck = await prisma.deck.update({
    where: { id: deckId },
    data: { updatedAt: new Date() },
    include: { leader: true, format: true, cards: { include: { card: true } } },
  });

  return NextResponse.json({ deck: updatedDeck, imported: deckCardUpdates.length, leaderSet: leaderId !== null, notFound });
}
