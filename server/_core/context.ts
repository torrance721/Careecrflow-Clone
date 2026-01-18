import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { verifySession } from "./sdk";
import { COOKIE_NAME } from "../../shared/const";
import * as db from "../db";
import { parse as parseCookieHeader } from "cookie";

export type TrpcContext = {
  req: any;
  res: any;
  user: User | null;
};

// Check if Google OAuth is configured
const isGoogleOAuthConfigured = () => {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CALLBACK_URL
  );
};

// Parse cookies from request
function getCookieValue(req: any): string | undefined {
  // Try express parsed cookies first
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }

  // Fallback to parsing cookie header
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    const parsed = parseCookieHeader(cookieHeader);
    return parsed[COOKIE_NAME];
  }

  return undefined;
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Only authenticate if Google OAuth is configured
  if (isGoogleOAuthConfigured()) {
    try {
      const cookieValue = getCookieValue(opts.req);

      if (cookieValue) {
        const session = await verifySession(cookieValue);

        if (session) {
          // Get user from database
          const dbUser = await db.getUserByOpenId(session.openId);

          if (dbUser) {
            user = dbUser;
            // Update last signed in
            await db.upsertUser({
              openId: user.openId,
              lastSignedIn: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.error("[Auth] Error authenticating request:", error);
      user = null;
    }
  } else {
    // Demo mode - no authentication configured
    // Create a demo user for testing (but don't save to DB)
    console.log("[Auth] Google OAuth not configured - running in demo mode");
    user = {
      id: 0,
      openId: "demo-user",
      name: "Demo User",
      email: "demo@example.com",
      loginMethod: "demo",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
