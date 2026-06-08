import { z } from "zod";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicProcedure, protectedProcedure } from "../trpc";
import { users, practices, locations } from "@openpims/db";
import { rateLimit } from "@/lib/rate-limit";

export const authRouter = createRouter({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        practiceName: z.string().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (process.env.ALLOW_REGISTRATION !== "true") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Registration is disabled.",
        });
      }

      // Rate limit by email: 5 registrations per hour
      const { success } = rateLimit({
        key: `register:${input.email}`,
        limit: 5,
        windowMs: 3600000,
      });

      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many registration attempts. Please try again later.",
        });
      }

      // Check if email already exists
      const [existing] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existing) {
        throw new Error("Email already registered");
      }

      const passwordHash = await hash(input.password, 10);

      // Create practice
      const [practice] = await ctx.db
        .insert(practices)
        .values({
          name: input.practiceName,
        })
        .returning();

      // Create default location
      await ctx.db.insert(locations).values({
        practiceId: practice!.id,
        name: "Main Location",
        isPrimary: true,
      });

      // Create admin user
      const [user] = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          name: input.name,
          role: "admin",
          practiceId: practice!.id,
        })
        .returning();

      return { id: user!.id, email: user!.email };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        practiceId: users.practiceId,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return user;
  }),
});
