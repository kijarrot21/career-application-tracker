import { decryptSecret } from "@/lib/crypto";
import { env, isGmailOAuthConfigured, isOutlookOAuthConfigured } from "@/lib/env";

export type SupportedEmailProvider = "gmail" | "outlook";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const OUTLOOK_SCOPES = [
  "offline_access",
  "https://graph.microsoft.com/User.Read",
  "https://graph.microsoft.com/Mail.Read",
] as const;

export function getOAuthRedirectUri(provider: SupportedEmailProvider): string {
  return `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/api/email/oauth/${provider}/callback`;
}

export function buildAuthorizationUrl(params: {
  provider: SupportedEmailProvider;
  state: string;
  codeChallenge: string;
}): string {
  const redirectUri = getOAuthRedirectUri(params.provider);

  if (params.provider === "gmail") {
    if (!isGmailOAuthConfigured()) {
      throw new Error(
        "Gmail OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.",
      );
    }
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  if (!isOutlookOAuthConfigured()) {
    throw new Error(
      "Microsoft Outlook OAuth is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env.local.",
    );
  }
  const tenant = env.MICROSOFT_TENANT_ID || "common";
  const url = new URL(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set("client_id", env.MICROSOFT_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  provider: SupportedEmailProvider;
  code: string;
  codeVerifier: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  email: string;
  scopes: string[];
}> {
  const redirectUri = getOAuthRedirectUri(params.provider);

  if (params.provider === "gmail") {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code: params.code,
        code_verifier: params.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Gmail token exchange failed (${tokenRes.status}).`);
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      scope?: string;
    };

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    if (!profileRes.ok) {
      throw new Error("Could not fetch Google account email address.");
    }
    const profile = (await profileRes.json()) as { email: string };

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      email: profile.email,
      scopes: tokens.scope ? tokens.scope.split(" ") : [...GMAIL_SCOPES],
    };
  }

  const tenant = env.MICROSOFT_TENANT_ID || "common";
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.MICROSOFT_CLIENT_ID,
        client_secret: env.MICROSOFT_CLIENT_SECRET,
        code: params.code,
        code_verifier: params.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        scope: OUTLOOK_SCOPES.join(" "),
      }),
    },
  );

  if (!tokenRes.ok) {
    throw new Error(`Outlook token exchange failed (${tokenRes.status}).`);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
  };

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meRes.ok) {
    throw new Error("Could not fetch Microsoft account profile.");
  }
  const me = (await meRes.json()) as {
    mail?: string;
    userPrincipalName?: string;
  };

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    email: me.mail || me.userPrincipalName || "outlook-user",
    scopes: tokens.scope ? tokens.scope.split(" ") : [...OUTLOOK_SCOPES],
  };
}

export async function refreshAccessToken(params: {
  provider: SupportedEmailProvider;
  encryptedRefreshToken: string;
}): Promise<string> {
  const refreshToken = decryptSecret(params.encryptedRefreshToken);

  if (params.provider === "gmail") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      throw new Error(`Gmail token refresh failed (${res.status}).`);
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  const tenant = env.MICROSOFT_TENANT_ID || "common";
  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.MICROSOFT_CLIENT_ID,
        client_secret: env.MICROSOFT_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: OUTLOOK_SCOPES.join(" "),
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Outlook token refresh failed (${res.status}).`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface SyncedProviderMessage {
  providerMessageId: string;
  threadId: string | null;
  sender: string | null;
  recipient: string | null;
  subject: string;
  snippet: string | null;
  occurredAt: Date;
}

/**
 * Read-only scan of Gmail messages matching recruitment keywords.
 * Never modifies, sends, or deletes any message.
 */
export async function fetchGmailMessagesReadOnly(
  accessToken: string,
): Promise<SyncedProviderMessage[]> {
  const query =
    "newer_than:90d (application OR interview OR assessment OR offer OR candidate OR recruitment OR lamaran OR wawancara)";
  const listUrl = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  );
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("maxResults", "25");

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    throw new Error(`Gmail messages list failed (${listRes.status}).`);
  }
  const listData = (await listRes.json()) as {
    messages?: { id: string; threadId: string }[];
  };
  const items = listData.messages ?? [];
  const results: SyncedProviderMessage[] = [];

  for (const item of items) {
    const detailUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`,
    );
    detailUrl.searchParams.set("format", "metadata");
    detailUrl.searchParams.append("metadataHeaders", "Subject");
    detailUrl.searchParams.append("metadataHeaders", "From");
    detailUrl.searchParams.append("metadataHeaders", "To");
    detailUrl.searchParams.append("metadataHeaders", "Date");

    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!detailRes.ok) continue;

    const detail = (await detailRes.json()) as {
      id: string;
      threadId?: string;
      snippet?: string;
      internalDate?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };

    const hdrs = detail.payload?.headers ?? [];
    const getHeader = (name: string) =>
      hdrs.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
      null;

    const subject = getHeader("Subject") ?? "(No subject)";
    const sender = getHeader("From");
    const recipient = getHeader("To");
    const occurredAt = detail.internalDate
      ? new Date(Number(detail.internalDate))
      : new Date();

    results.push({
      providerMessageId: detail.id,
      threadId: detail.threadId ?? null,
      sender,
      recipient,
      subject,
      snippet: detail.snippet ?? null,
      occurredAt,
    });
  }

  return results;
}

/**
 * Read-only scan of Microsoft Outlook messages via Microsoft Graph.
 * Never modifies, sends, or deletes any message.
 */
export async function fetchOutlookMessagesReadOnly(
  accessToken: string,
): Promise<SyncedProviderMessage[]> {
  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set("$top", "25");
  url.searchParams.set(
    "$select",
    "id,conversationId,subject,bodyPreview,from,toRecipients,receivedDateTime",
  );
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Microsoft Graph messages fetch failed (${res.status}).`);
  }
  const data = (await res.json()) as {
    value?: {
      id: string;
      conversationId?: string;
      subject?: string;
      bodyPreview?: string;
      receivedDateTime?: string;
      from?: { emailAddress?: { name?: string; address?: string } };
      toRecipients?: { emailAddress?: { address?: string } }[];
    }[];
  };

  return (data.value ?? []).map((msg) => {
    const fromAddr = msg.from?.emailAddress;
    const sender = fromAddr
      ? fromAddr.name
        ? `${fromAddr.name} <${fromAddr.address}>`
        : (fromAddr.address ?? null)
      : null;
    const recipient = msg.toRecipients?.[0]?.emailAddress?.address ?? null;
    return {
      providerMessageId: msg.id,
      threadId: msg.conversationId ?? null,
      sender,
      recipient,
      subject: msg.subject || "(No subject)",
      snippet: msg.bodyPreview ?? null,
      occurredAt: msg.receivedDateTime
        ? new Date(msg.receivedDateTime)
        : new Date(),
    };
  });
}
