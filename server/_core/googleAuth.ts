import { OAuth2Client } from "google-auth-library";
import type { Express, Request, Response } from "express";
import { SignJWT } from "jose";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";

// Initialize Google OAuth client
const getGoogleClient = () => {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    console.warn("[Google OAuth] Client ID or Secret not configured");
    return null;
  }
  return new OAuth2Client(
    ENV.googleClientId,
    ENV.googleClientSecret,
    ENV.googleCallbackUrl
  );
};

// Generate authorization URL
const getAuthUrl = (client: OAuth2Client): string => {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  });
};

// Get session secret for JWT signing
const getSessionSecret = () => {
  const secret = ENV.cookieSecret;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
};

// Create session token
async function createSessionToken(
  openId: string,
  name: string
): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
  const secretKey = getSessionSecret();

  return new SignJWT({
    openId,
    appId: ENV.appId || "careerflow",
    name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

// Register Google OAuth routes
export function registerGoogleAuthRoutes(app: Express): void {
  const client = getGoogleClient();

  // Check if Google OAuth is configured
  app.get("/api/auth/google/status", (_req: Request, res: Response) => {
    res.json({
      configured: !!client,
      hasClientId: !!ENV.googleClientId,
      hasClientSecret: !!ENV.googleClientSecret,
      hasCallbackUrl: !!ENV.googleCallbackUrl,
    });
  });

  // Redirect to Google login
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!client) {
      console.error("[Google OAuth] Not configured");
      return res.status(500).json({ error: "Google OAuth not configured" });
    }

    const authUrl = getAuthUrl(client);
    console.log("[Google OAuth] Redirecting to Google:", authUrl);
    res.redirect(authUrl);
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const { code, error } = req.query;

    if (error) {
      console.error("[Google OAuth] Error from Google:", error);
      return res.redirect(`${ENV.frontendUrl}/login?error=${error}`);
    }

    if (!code || typeof code !== "string") {
      console.error("[Google OAuth] No code received");
      return res.redirect(`${ENV.frontendUrl}/login?error=no_code`);
    }

    if (!client) {
      console.error("[Google OAuth] Not configured");
      return res.redirect(`${ENV.frontendUrl}/login?error=not_configured`);
    }

    try {
      // Exchange code for tokens
      console.log("[Google OAuth] Exchanging code for tokens...");
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Get user info
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: ENV.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error("No payload in ID token");
      }

      const googleId = payload.sub;
      const email = payload.email;
      const name = payload.name || email?.split("@")[0] || "User";
      const picture = payload.picture;

      console.log("[Google OAuth] User info:", { googleId, email, name });

      // Create or update user in database
      const openId = `google-${googleId}`;
      const now = new Date();

      await db.upsertUser({
        openId,
        name,
        email: email || null,
        loginMethod: "google",
        lastSignedIn: now,
      });

      // Get the user from database to get the ID
      const user = await db.getUserByOpenId(openId);
      if (!user) {
        throw new Error("Failed to create/get user");
      }

      // Create session token
      const sessionToken = await createSessionToken(openId, name);

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      console.log("[Google OAuth] Login successful for:", email);

      // Redirect to frontend
      res.redirect(ENV.frontendUrl);
    } catch (err) {
      console.error("[Google OAuth] Callback error:", err);
      res.redirect(`${ENV.frontendUrl}/login?error=auth_failed`);
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Get current user endpoint (for debugging)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const { verifySession } = await import("./sdk");
      const cookieValue = req.cookies?.[COOKIE_NAME];

      if (!cookieValue) {
        return res.json({ user: null });
      }

      const session = await verifySession(cookieValue);
      if (!session) {
        return res.json({ user: null });
      }

      const user = await db.getUserByOpenId(session.openId);
      res.json({ user });
    } catch (err) {
      console.error("[Auth] Error getting current user:", err);
      res.json({ user: null });
    }
  });

  console.log("[Google OAuth] Routes registered");
}
