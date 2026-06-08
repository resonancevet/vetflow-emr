import { db } from "@openpims/db/client";
import { auditLog } from "@openpims/db";

export type AuditInput = {
  practiceId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/** Append-only audit entry. Failures are logged but never throw. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      practiceId: input.practiceId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      changes: input.changes ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return req.headers.get("x-real-ip");
}
