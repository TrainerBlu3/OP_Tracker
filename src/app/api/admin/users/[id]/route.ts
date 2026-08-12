import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { adminUserUpdateSchema } from "@/lib/validation";

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = adminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Don't let an admin lock everyone out (including themselves) by
  // demoting/deactivating the last remaining admin.
  if (target.role === "ADMIN" && (parsed.data.role === "USER" || parsed.data.active === false)) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", active: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json({ error: "Can't remove the last remaining admin" }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: PUBLIC_USER_SELECT,
  });

  return NextResponse.json({ user: updated });
}
