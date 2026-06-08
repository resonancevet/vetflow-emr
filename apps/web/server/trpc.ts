import { initTRPC, TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@openpims/db/client";
import type { Database } from "@openpims/db/client";

type UserRole = "admin" | "veterinarian" | "technician" | "front_desk";

interface AppSession extends Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    practiceId: string;
  };
}

export type TRPCContext = {
  db: Database;
  session: AppSession | null;
  ipAddress: string | null;
};

export async function createTRPCContext(opts?: {
  req?: Request;
}): Promise<TRPCContext> {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  const ipAddress = opts?.req
    ? (opts.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        opts.req.headers.get("x-real-ip"))
    : null;
  return { db, session, ipAddress };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createRouter = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated session */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.session.user,
      practiceId: ctx.session.user.practiceId,
      ipAddress: ctx.ipAddress,
    },
  });
});

/** Requires specific roles */
export function requireRole(...roles: UserRole[]) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.session.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of: ${roles.join(", ")}`,
      });
    }
    return next({
      ctx: {
        session: ctx.session,
        user: ctx.session.user,
        practiceId: ctx.session.user.practiceId,
        ipAddress: ctx.ipAddress,
      },
    });
  });
}
