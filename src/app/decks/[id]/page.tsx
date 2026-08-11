import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DeckEditorClient } from "@/components/DeckEditorClient";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const [deck, formats] = await Promise.all([
    prisma.deck.findUnique({
      where: { id },
      include: { leader: true, format: true, cards: { include: { card: true } } },
    }),
    prisma.format.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!deck || deck.userId !== session.user.id) notFound();

  return <DeckEditorClient initialDeck={deck} formats={formats} />;
}
