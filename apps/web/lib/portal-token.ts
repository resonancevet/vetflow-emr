import { randomBytes } from "crypto";

/** High-entropy portal access token (fits clients.access_token varchar(64)). */
export function generatePortalAccessToken(): string {
  return randomBytes(32).toString("hex"); // 64 hex chars
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
