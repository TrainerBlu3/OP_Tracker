import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import { hashPassword, generateTempPassword } from "@/lib/password";
import { adminCreateUserSchema } from "@/lib/validation";

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: PUBLIC_USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = adminCreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role ?? "USER",
      passwordHash,
      mustChangePassword: true,
    },
    select: PUBLIC_USER_SELECT,
  });

  // Only returned here, at creation time, so the admin can hand it to the
  // new user -- it's never retrievable again after this response.
  return NextResponse.json({ user, tempPassword }, { status: 201 });
}
