import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { db } from "@/db";

import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface User {
    role?: string;
    sessionVersion?: number;
    isActive?: boolean;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      sessionVersion: number;
      isActive: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    sessionVersion?: number;
    isActive?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const usernameStr = (credentials.username as string).trim().toLowerCase();
        const APPROVED_DOMAINS = ["chadwickswitchboards.com.au"];
        const domain = usernameStr.split("@").pop();
        if (!domain || !APPROVED_DOMAINS.includes(domain)) {
          return null;
        }

        const user = await db.query.users.findFirst({
          where: eq(users.username, usernameStr),
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        // Update last login timestamp in background
        try {
          await db.update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id));
        } catch (e) {
          console.error("Failed to update lastLoginAt:", e);
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.username,
          role: user.role,
          sessionVersion: user.sessionVersion,
          isActive: user.isActive,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.isActive = user.isActive;
        return token;
      }

      // Skip database synchronization when running in the Next.js edge/middleware runtime
      // since standard TCP database connections are not supported in this sandbox.
      if (process.env.NEXT_RUNTIME === "edge") {
        return token;
      }

      // Keep token in sync with database on subsequent requests to avoid stale states
      if (token.id) {
        try {
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, Number(token.id)),
            columns: {
              role: true,
              sessionVersion: true,
              isActive: true,
            }
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.isActive = dbUser.isActive;
            if (dbUser.sessionVersion !== token.sessionVersion) {
              // Session version mismatch (e.g. password changed), invalidate session
              token.isActive = false;
            }
          } else {
            token.isActive = false; // User deleted
          }
        } catch (e) {
          console.error("[auth] Error fetching user in jwt callback:", e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.sessionVersion = token.sessionVersion as number;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    },
    authorized({ request, auth }) {
      const isLoggedIn = !!auth?.user;
      const isActive = auth?.user?.isActive === true;
      return isLoggedIn && isActive;
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
});
