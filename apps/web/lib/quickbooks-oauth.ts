import { createHmac, timingSafeEqual } from "crypto";

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export function quickbooksConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
      process.env.QUICKBOOKS_CLIENT_SECRET?.trim()
  );
}

export function quickbooksEnv(): "sandbox" | "production" {
  return process.env.QUICKBOOKS_ENV === "production"
    ? "production"
    : "sandbox";
}

export function quickbooksApiBase(): string {
  return quickbooksEnv() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function quickbooksRedirectUri(): string {
  const explicit = process.env.QUICKBOOKS_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const appUrl =
    process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!appUrl) {
    throw new Error("NEXTAUTH_URL is required for QuickBooks OAuth");
  }
  return `${appUrl}/api/integrations/quickbooks/callback`;
}

function clientId(): string {
  const id = process.env.QUICKBOOKS_CLIENT_ID?.trim();
  if (!id) throw new Error("QUICKBOOKS_CLIENT_ID is not set");
  return id;
}

function clientSecret(): string {
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("QUICKBOOKS_CLIENT_SECRET is not set");
  return secret;
}

function stateSecret(): string {
  return (
    process.env.QUICKBOOKS_TOKEN_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ""
  );
}

/** Signed OAuth state: practiceId.timestamp.sig */
export function createOAuthState(practiceId: string): string {
  const ts = Date.now().toString(36);
  const payload = `${practiceId}.${ts}`;
  const sig = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function parseOAuthState(
  state: string
): { practiceId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [practiceId, ts, sig] = parts;
  if (!practiceId || !ts || !sig) return null;
  const payload = `${practiceId}.${ts}`;
  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const ageMs = Date.now() - parseInt(ts, 36);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 15 * 60 * 1000) {
    return null;
  }
  return { practiceId };
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: quickbooksRedirectUri(),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
  token_type: string;
};

async function tokenRequest(
  body: URLSearchParams
): Promise<TokenResponse> {
  const basic = Buffer.from(`${clientId()}:${clientSecret()}`).toString(
    "base64"
  );
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const intuitTid =
    res.headers.get("intuit_tid") || res.headers.get("Intuit-Tid") || null;
  const json = (await res.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    const baseMsg =
      json.error_description ||
      json.error ||
      `QuickBooks token exchange failed (${res.status})`;
    console.error("[QuickBooks] token error", {
      status: res.status,
      intuit_tid: intuitTid,
      error: json.error,
      message: baseMsg,
    });
    throw new Error(
      intuitTid ? `${baseMsg} (intuit_tid: ${intuitTid})` : baseMsg
    );
  }
  return json;
}

export async function exchangeAuthorizationCode(
  code: string
): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: quickbooksRedirectUri(),
    })
  );
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}
