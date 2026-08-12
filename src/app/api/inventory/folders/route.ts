import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { inventoryFolderCreateSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folders = await prisma.inventoryFolder.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ folders });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inventoryFolderCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.inventoryFolder.findUnique({
    where: { userId_name: { userId: session.user.id, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a folder with that name" }, { status: 400 });
  }

  const folder = await prisma.inventoryFolder.create({
    data: { userId: session.user.id, name: parsed.data.name },
  });

  return NextResponse.json({ folder });
}
