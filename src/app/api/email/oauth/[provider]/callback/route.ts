import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthState } from "@/lib/crypto";
import {
  exchangeCodeForTokens,
  type SupportedEmailProvider,
} from "@/lib/email-oauth";
import { getOptionalUser } from "@/lib/session";
import { saveConnectedEmailAccountService } from "@/server/services/emails";

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
    return NextResponse.redirect(
      new URL("/emails?oauthError=Unsupported+provider", request.url),
    );
  }

  const sp = request.nextUrl.searchParams;
  const code = sp.get("code");
  const stateParam = sp.get("state");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("cat_email_oauth_state")?.value;
  cookieStore.delete("cat_email_oauth_state");

  if (!code || !stateParam || !stateCookie || stateParam !== stateCookie) {
    return NextResponse.redirect(
      new URL("/emails?oauthError=Invalid+OAuth+state", request.url),
    );
  }

  const verifiedState = verifyOAuthState(stateCookie);
  if (
    !verifiedState ||
    verifiedState.userId !== user.id ||
    verifiedState.provider !== provider
  ) {
    return NextResponse.redirect(
      new URL("/emails?oauthError=OAuth+session+verification+failed", request.url),
    );
  }

  try {
    const tokens = await exchangeCodeForTokens({
      provider: provider as SupportedEmailProvider,
      code,
      codeVerifier: verifiedState.codeVerifier,
    });

    await saveConnectedEmailAccountService(user.id, {
      provider: provider as SupportedEmailProvider,
      email: tokens.email,
      refreshToken: tokens.refreshToken,
      scopes: tokens.scopes,
    });

    return NextResponse.redirect(
      new URL(`/emails?connected=${provider}`, request.url),
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to connect email account";
    return NextResponse.redirect(
      new URL(`/emails?oauthError=${encodeURIComponent(msg)}`, request.url),
    );
  }
}
