import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DeckEditorClient } from "@/components/DeckEditorClient";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [deck, formats, inventory] = await Promise.all([
    prisma.deck.findUnique({
      where: { id },
      include: { leader: true, format: true, cards: { include: { card: true } } },
    }),
    prisma.format.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ where: { userId: session.user.id }, include: { card: true } }),
  ]);

  if (!deck || deck.userId !== session.user.id) notFound();

  // Owned copies summed by card *code*, not exact row -- any art variant of
  // a card counts toward owning it for deck-building purposes.
  const ownedByCode: Record<string, number> = {};
  for (const item of inventory) {
    const owned = item.quantity + item.foilQty;
    ownedByCode[item.card.code] = (ownedByCode[item.card.code] ?? 0) + owned;
  }

  return <DeckEditorClient initialDeck={deck} formats={formats} ownedByCode={ownedByCode} />;
}
