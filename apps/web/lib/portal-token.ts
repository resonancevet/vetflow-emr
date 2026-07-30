import { createHash, randomBytes } from "crypto";

/** High-entropy portal access token (fits clients.access_token varchar(64)). */
export function generatePortalAccessToken(): string {
  return randomBytes(32).toString("hex"); // 64 hex chars
}

/** Raw magic-link token (hashed before storage). */
export function generatePortalMagicLinkToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPortalMagicLinkToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Public app origin for portal links (no trailing slash). */
export function getAppOrigin(): string {
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "") || "http://localhost:3000";
}

export function buildPortalUrl(accessToken: string): string {
  return `${getAppOrigin()}/portal/${accessToken}`;
}

export function buildPortalMagicLinkUrl(rawToken: string): string {
  return `${getAppOrigin()}/portal/auth/verify?token=${encodeURIComponent(rawToken)}`;
}

export const PORTAL_MAGIC_LINK_TTL_MS = 20 * 60 * 1000; // 20 minutes
