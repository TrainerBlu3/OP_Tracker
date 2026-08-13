import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { InventoryClient } from "@/components/InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  const [items, folders] = session?.user
    ? await Promise.all([
        prisma.inventoryItem.findMany({
          where: { userId: session.user.id },
          include: { card: true },
          orderBy: [{ card: { setCode: "asc" } }, { card: { code: "asc" } }],
        }),
        prisma.inventoryFolder.findMany({ where: { userId: session.user.id }, orderBy: { name: "asc" } }),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Inventory</h1>
        <p className="text-sm text-zinc-500">Track how many copies of each card you own.</p>
      </div>
      <InventoryClient initialItems={items} initialFolders={folders} />
    </div>
  );
}
