import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { syncAllCards } from "@/lib/cardSync";

export async function POST() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const result = await syncAllCards(prisma);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Card sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
