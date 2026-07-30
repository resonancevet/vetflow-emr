import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@openpims/db/client";
import { clients, portalLoginTokens } from "@openpims/db";
import {
  buildPortalUrl,
  hashPortalMagicLinkToken,
} from "@/lib/portal-token";
import { writeAudit, getClientIp } from "@/server/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function loginErrorRedirect(request: Request, reason: string) {
  const url = new URL("/portal/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawToken = searchParams.get("token")?.trim() ?? "";
  const ip = getClientIp(request) ?? "unknown";

  const limit = rateLimit({
    key: `portal-magic-verify:ip:${ip}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.success) {
    return loginErrorRedirect(request, "rate_limited");
  }

  if (!rawToken || rawToken.length < 32) {
    return loginErrorRedirect(request, "invalid");
  }

  const tokenHash = hashPortalMagicLinkToken(rawToken);
  const [row] = await db
    .select({
      id: portalLoginTokens.id,
      clientId: portalLoginTokens.clientId,
      practiceId: portalLoginTokens.practiceId,
      expiresAt: portalLoginTokens.expiresAt,
      usedAt: portalLoginTokens.usedAt,
    })
    .from(portalLoginTokens)
    .where(
      and(
        eq(portalLoginTokens.tokenHash, tokenHash),
        isNull(portalLoginTokens.deletedAt)
      )
    )
    .limit(1);

  if (!row) {
    await writeAudit({
      action: "portal.magic_link.verify_failed",
      entityType: "portal_login_token",
      changes: { reason: "not_found" },
      ipAddress: ip,
    });
    return loginErrorRedirect(request, "invalid");
  }

  if (row.usedAt) {
    await writeAudit({
      practiceId: row.practiceId,
      action: "portal.magic_link.verify_failed",
      entityType: "client",
      entityId: row.clientId,
      changes: { reason: "already_used" },
      ipAddress: ip,
    });
    return loginErrorRedirect(request, "used");
  }

  if (row.expiresAt.getTime() < Date.now()) {
    await writeAudit({
      practiceId: row.practiceId,
      action: "portal.magic_link.verify_failed",
      entityType: "client",
      entityId: row.clientId,
      changes: { reason: "expired" },
      ipAddress: ip,
    });
    return loginErrorRedirect(request, "expired");
  }

  const [client] = await db
    .select({
      id: clients.id,
      accessToken: clients.accessToken,
      deletedAt: clients.deletedAt,
    })
    .from(clients)
    .where(eq(clients.id, row.clientId))
    .limit(1);

  if (!client || client.deletedAt || !client.accessToken) {
    await writeAudit({
      practiceId: row.practiceId,
      action: "portal.magic_link.verify_failed",
      entityType: "client",
      entityId: row.clientId,
      changes: { reason: "portal_disabled" },
      ipAddress: ip,
    });
    return loginErrorRedirect(request, "disabled");
  }

  await db
    .update(portalLoginTokens)
    .set({ usedAt: new Date() })
    .where(eq(portalLoginTokens.id, row.id));

  await writeAudit({
    practiceId: row.practiceId,
    action: "portal.magic_link.consumed",
    entityType: "client",
    entityId: client.id,
    ipAddress: ip,
  });

  return NextResponse.redirect(buildPortalUrl(client.accessToken));
}
