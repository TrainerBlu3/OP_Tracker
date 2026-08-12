import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { inventoryBulkFolderAssignSchema } from "@/lib/validation";

/** Moves many inventory items to one folder (or unfiles them) in a single query. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inventoryBulkFolderAssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { itemIds, folderId } = parsed.data;

  if (folderId) {
    const folder = await prisma.inventoryFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== session.user.id) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  // Scoping the WHERE to userId means any itemId that isn't the caller's own
  // is silently ignored, not an error -- no need to look each one up first.
  const result = await prisma.inventoryItem.updateMany({
    where: { id: { in: itemIds }, userId: session.user.id },
    data: { folderId },
  });

  return NextResponse.json({ moved: result.count });
}
