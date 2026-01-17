import type { VercelRequest, VercelResponse } from '@vercel/node';

// Minimal handler to test if the function works
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Health check endpoint
  if (request.url === '/health' || request.url?.startsWith('/health')) {
    return response.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV
      }
    });
  }

  // For all other requests, try to load the full app
  try {
    const express = (await import("express")).default;
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers.js");
    const { createContext } = await import("../server/_core/context");

    const app = express();

    // Configure body parser
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // CORS configuration
    app.use((req: any, res: any, next: any) => {
      const origin = req.headers?.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // tRPC API
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );

    // Handle request with Express
    return new Promise((resolve) => {
      app(request as any, response as any, (err: any) => {
        if (err) {
          console.error('[Handler Error]', err);
          response.status(500).json({ error: 'Internal Server Error', message: String(err) });
        }
        resolve(undefined);
      });
    });
  } catch (error: any) {
    console.error('[Module Load Error]', error);
    return response.status(500).json({
      error: 'Failed to load modules',
      message: error?.message || String(error),
      stack: error?.stack
    });
  }
}
