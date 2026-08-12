import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const folder = await prisma.inventoryFolder.findUnique({ where: { id } });
  if (!folder || folder.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Items in this folder are un-assigned (folderId -> null), not deleted --
  // see onDelete: SetNull on InventoryItem.folder in schema.prisma.
  await prisma.inventoryFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
