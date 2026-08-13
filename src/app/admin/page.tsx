import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AdminClient } from "@/components/AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const [users, userCount, deckCount, inventoryItemCount, cardCount] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.count(),
    prisma.deck.count(),
    prisma.inventoryItem.count(),
    prisma.card.count(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="text-sm text-zinc-500">Manage accounts and see who&apos;s using the tracker.</p>
      </div>
      <AdminClient
        initialUsers={users}
        stats={{ userCount, deckCount, inventoryItemCount, cardCount }}
        currentUserId={session.user.id}
      />
    </div>
  );
}
