import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { deckUpdateSchema } from "@/lib/validation";

async function loadOwnedDeck(deckId: string, userId: string) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.userId !== userId) return null;
  return deck;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deck = await prisma.deck.findUnique({
    where: { id },
    include: { leader: true, format: true, cards: { include: { card: true } } },
  });
  if (!deck || deck.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deck });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await loadOwnedDeck(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = deckUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (parsed.data.leaderId) {
    const leader = await prisma.card.findUnique({ where: { id: parsed.data.leaderId } });
    if (!leader || leader.cardType !== "LEADER") {
      return NextResponse.json({ error: "leaderId must reference a Leader card" }, { status: 400 });
    }
  }

  const deck = await prisma.deck.update({
    where: { id },
    data: parsed.data,
    include: { leader: true, format: true, cards: { include: { card: true } } },
  });

  return NextResponse.json({ deck });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await loadOwnedDeck(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.deck.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
