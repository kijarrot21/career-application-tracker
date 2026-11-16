import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { generatePkcePair, signOAuthState } from "@/lib/crypto";
import {
  buildAuthorizationUrl,
  type SupportedEmailProvider,
} from "@/lib/email-oauth";
import { getOptionalUser } from "@/lib/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const { provider } = await params;
  if (provider !== "gmail" && provider !== "outlook") {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  try {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const state = signOAuthState({
      userId: user.id,
      provider,
      codeVerifier,
      ts: String(Date.now()),
    });

    const cookieStore = await cookies();
    cookieStore.set("cat_email_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const authUrl = buildAuthorizationUrl({
      provider: provider as SupportedEmailProvider,
      state,
      codeChallenge,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    const redirectUrl = new URL("/emails", request.url);
    redirectUrl.searchParams.set(
      "oauthError",
      err instanceof Error ? err.message : "OAuth configuration error",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
