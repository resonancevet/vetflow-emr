import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { createRouter, protectedProcedure, requireRole } from "../trpc";
import { auditLog, users } from "@openpims/db";

const adminProcedure = protectedProcedure.use(requireRole("admin"));

export const auditRouter = createRouter({
  list: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        entityType: z.string().optional(),
        entityId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(auditLog.practiceId, ctx.practiceId)];

      if (input.entityType) {
        conditions.push(eq(auditLog.entityType, input.entityType));
      }
      if (input.entityId) {
        conditions.push(eq(auditLog.entityId, input.entityId));
      }

      const whereClause = and(...conditions);

      const [items, countResult] = await Promise.all([
        ctx.db
          .select({
            id: auditLog.id,
            action: auditLog.action,
            entityType: auditLog.entityType,
            entityId: auditLog.entityId,
            changes: auditLog.changes,
            ipAddress: auditLog.ipAddress,
            userName: users.name,
            createdAt: auditLog.createdAt,
          })
          .from(auditLog)
          .leftJoin(users, eq(auditLog.userId, users.id))
          .where(whereClause)
          .orderBy(desc(auditLog.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(auditLog)
          .where(whereClause),
      ]);

      return {
        items,
        total: Number(countResult[0]?.count ?? 0),
      };
    }),
});
