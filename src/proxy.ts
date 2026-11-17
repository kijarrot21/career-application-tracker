import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/jobs",
  "/shortlist",
  "/applications",
  "/archive",
  "/interviews",
  "/emails",
  "/documents",
  "/profile",
  "/cv-studio",
  "/credits",
  "/sync",
  "/analytics",
  "/settings",
  "/api/export",
  "/api/documents",
  "/api/ai",
  "/api/v1/archive",
  "/api/v1/ai",
  "/api/v1/credits",
  "/api/v1/payments/checkout",
  "/api/v1/sync",
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

  // Short-lived signed download requests are verified by their cryptographic HMAC token
  const hasDownloadToken =
    pathname.startsWith("/api/documents/download") ||
    (pathname.startsWith("/api/documents/") &&
      request.nextUrl.searchParams.has("token"));

  if (isProtected && !hasSessionCookie(request) && !hasDownloadToken) {
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
    "/archive/:path*",
    "/interviews/:path*",
    "/emails/:path*",
    "/documents/:path*",
    "/profile/:path*",
    "/cv-studio/:path*",
    "/credits/:path*",
    "/sync/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/api/export/:path*",
    "/api/documents/:path*",
    "/api/ai/:path*",
    "/api/v1/archive/:path*",
    "/api/v1/ai/:path*",
    "/api/v1/credits/:path*",
    "/api/v1/payments/checkout/:path*",
    "/api/v1/sync/:path*",
  ],
};
