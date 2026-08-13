import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { inventoryUpsertSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [items, folders] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId: session.user.id },
      include: { card: true },
      orderBy: [{ card: { setCode: "asc" } }, { card: { code: "asc" } }],
    }),
    prisma.inventoryFolder.findMany({ where: { userId: session.user.id }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ items, folders });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inventoryUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { cardId, quantity, foilQty, notes, folderId } = parsed.data;

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  if (folderId) {
    const folder = await prisma.inventoryFolder.findUnique({ where: { id: folderId } });
    if (!folder || folder.userId !== session.user.id) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }
  }

  const item = await prisma.inventoryItem.upsert({
    where: { userId_cardId: { userId: session.user.id, cardId } },
    create: { userId: session.user.id, cardId, quantity, foilQty: foilQty ?? 0, notes, folderId },
    // folderId is only touched here if explicitly passed, so the +/- quantity
    // steppers (which never send it) can't accidentally clear an assignment.
    update: { quantity, ...(foilQty !== undefined ? { foilQty } : {}), notes, ...(folderId !== undefined ? { folderId } : {}) },
    include: { card: true },
  });

  return NextResponse.json({ item });
}
