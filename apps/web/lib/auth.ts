import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@openpims/db/client";
import { users } from "@openpims/db";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/server/lib/audit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "admin" | "veterinarian" | "technician" | "front_desk";
      practiceId: string;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: "admin" | "veterinarian" | "technician" | "front_desk";
    practiceId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "veterinarian" | "technician" | "front_desk";
    practiceId: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.trim();
        const rateLimitKey = email.toLowerCase();

        const { success } = rateLimit({
          key: `login:${rateLimitKey}`,
          limit: 10,
          windowMs: 15 * 60 * 1000,
        });
        if (!success) {
          await writeAudit({
            action: "login.rate_limited",
            entityType: "user",
            changes: { email: rateLimitKey },
          });
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || user.deletedAt) {
          await writeAudit({
            practiceId: user?.practiceId ?? null,
            action: "login.failed",
            entityType: "user",
            entityId: user?.id ?? null,
            changes: { email, reason: user?.deletedAt ? "deactivated" : "not_found" },
          });
          return null;
        }

        const isValid = await compare(credentials.password, user.passwordHash);
        if (!isValid) {
          await writeAudit({
            practiceId: user.practiceId,
            userId: user.id,
            action: "login.failed",
            entityType: "user",
            entityId: user.id,
            changes: { email, reason: "invalid_password" },
          });
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          practiceId: user.practiceId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.practiceId = user.practiceId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.practiceId = token.practiceId;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await writeAudit({
        practiceId: user.practiceId,
        userId: user.id,
        action: "login.success",
        entityType: "user",
        entityId: user.id,
      });
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
