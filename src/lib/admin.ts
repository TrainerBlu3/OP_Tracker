import { auth } from "@/auth";

/** Returns the session if the caller is a logged-in admin, otherwise null. Use in API routes/pages to gate admin-only access. */
export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}
