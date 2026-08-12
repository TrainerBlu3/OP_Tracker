import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthApi = pathname.startsWith("/api/auth");

  if (!req.auth && !isPublic && !isAuthApi) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL("/inventory", req.nextUrl.origin));
  }

  // Admin-created accounts start with a temp password and must set their
  // own before touching the rest of the app.
  const isChangePasswordFlow = pathname.startsWith("/change-password") || pathname.startsWith("/api/change-password");
  if (req.auth?.user?.mustChangePassword && !isChangePasswordFlow && !isAuthApi) {
    return NextResponse.redirect(new URL("/change-password", req.nextUrl.origin));
  }

  if (pathname.startsWith("/admin") && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/inventory", req.nextUrl.origin));
  }
  if (pathname.startsWith("/api/admin") && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
