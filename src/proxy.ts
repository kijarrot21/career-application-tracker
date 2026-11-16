import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/jobs",
  "/shortlist",
  "/applications",
  "/interviews",
  "/emails",
  "/documents",
  "/analytics",
  "/settings",
  "/api/export",
  "/api/documents",
];

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.includes("better-auth.session_token"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !hasSessionCookie(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/jobs/:path*",
    "/shortlist/:path*",
    "/applications/:path*",
    "/interviews/:path*",
    "/emails/:path*",
    "/documents/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/api/export/:path*",
    "/api/documents/:path*",
  ],
};
