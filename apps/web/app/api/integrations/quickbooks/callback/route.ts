import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@openpims/db/client";
import { quickbooksConnections } from "@openpims/db";
import { encryptSecret } from "@/lib/quickbooks-crypto";
import {
  exchangeAuthorizationCode,
  parseOAuthState,
  quickbooksConfigured,
} from "@/lib/quickbooks-oauth";
import { qboGetCompanyName } from "@/lib/quickbooks-api";

function appBase(): string {
  return (
    process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function redirect(pathWithQuery: string) {
  const response = NextResponse.redirect(`${appBase()}${pathWithQuery}`);
  response.headers.set("Cache-Control", "no-cache, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return redirect(
      `/settings?tab=practice&qb=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!quickbooksConfigured()) {
    return redirect(
      `/settings?tab=practice&qb=error&message=${encodeURIComponent("QuickBooks is not configured")}`
    );
  }

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  if (!code || !realmId || !state) {
    return redirect(
      `/settings?tab=practice&qb=error&message=${encodeURIComponent("Missing OAuth parameters")}`
    );
  }

  const parsed = parseOAuthState(state);
  if (!parsed) {
    return redirect(
      `/settings?tab=practice&qb=error&message=${encodeURIComponent("Invalid or expired OAuth state")}`
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode(code);
    const companyName = await qboGetCompanyName(
      tokens.access_token,
      realmId
    );
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existing = await db
      .select({ id: quickbooksConnections.id })
      .from(quickbooksConnections)
      .where(eq(quickbooksConnections.practiceId, parsed.practiceId))
      .limit(1);

    const values = {
      practiceId: parsed.practiceId,
      realmId,
      companyName,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      accessTokenExpiresAt: expiresAt,
      lastError: null as string | null,
      deletedAt: null as Date | null,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      // Revive soft-deleted rows on reconnect (practice_id is unique).
      await db
        .update(quickbooksConnections)
        .set(values)
        .where(eq(quickbooksConnections.id, existing[0].id));
    } else {
      await db.insert(quickbooksConnections).values(values);
    }

    return redirect(`/settings?tab=practice&qb=connected`);
  } catch (err) {
    console.error("[QuickBooks] OAuth callback failed:", err);
    // Never put raw DB/driver messages in the redirect (they can include tokens).
    return redirect(
      `/settings?tab=practice&qb=error&message=${encodeURIComponent("QuickBooks connection failed. Try again.")}`
    );
  }
}
