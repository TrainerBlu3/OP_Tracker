import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DecksClient } from "@/components/DecksClient";

export default async function DecksPage() {
  const session = await auth();
  const [decks, formats] = session?.user
    ? await Promise.all([
        prisma.deck.findMany({
          where: { userId: session.user.id },
          include: { leader: true, format: true, cards: true },
          orderBy: { updatedAt: "desc" },
        }),
        prisma.format.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Deck Builder</h1>
        <p className="text-sm text-zinc-500">Build decks and check them against a legal format.</p>
      </div>
      <DecksClient initialDecks={decks} formats={formats} />
    </div>
  );
}
