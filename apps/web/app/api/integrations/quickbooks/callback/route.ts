import { and, eq, isNull } from "drizzle-orm";
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      `${appBase()}/settings?tab=practice&qb=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!quickbooksConfigured()) {
    return NextResponse.redirect(
      `${appBase()}/settings?tab=practice&qb=error&message=${encodeURIComponent("QuickBooks is not configured")}`
    );
  }

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  if (!code || !realmId || !state) {
    return NextResponse.redirect(
      `${appBase()}/settings?tab=practice&qb=error&message=${encodeURIComponent("Missing OAuth parameters")}`
    );
  }

  const parsed = parseOAuthState(state);
  if (!parsed) {
    return NextResponse.redirect(
      `${appBase()}/settings?tab=practice&qb=error&message=${encodeURIComponent("Invalid or expired OAuth state")}`
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
      .where(
        and(
          eq(quickbooksConnections.practiceId, parsed.practiceId),
          isNull(quickbooksConnections.deletedAt)
        )
      )
      .limit(1);

    const values = {
      practiceId: parsed.practiceId,
      realmId,
      companyName,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      accessTokenExpiresAt: expiresAt,
      lastError: null as string | null,
      updatedAt: new Date(),
    };

    if (existing[0]) {
      await db
        .update(quickbooksConnections)
        .set(values)
        .where(eq(quickbooksConnections.id, existing[0].id));
    } else {
      await db.insert(quickbooksConnections).values(values);
    }

    return NextResponse.redirect(
      `${appBase()}/settings?tab=practice&qb=connected`
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "QuickBooks connection failed";
    console.error("[QuickBooks] OAuth callback failed:", message);
    return NextResponse.redirect(
      `${appBase()}/settings?tab=practice&qb=error&message=${encodeURIComponent(message)}`
    );
  }
}
