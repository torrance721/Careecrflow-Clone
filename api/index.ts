import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes } from "../server/_core/oauth";
import interviewProgressRouter from "../server/routes/interviewProgress";
import reactAgentsRouter from "../server/routes/reactAgents";
import topicPracticeStreamRouter from '../server/routes/topicPracticeStream';
import topicPracticeStreamResponseRouter from '../server/routes/topicPracticeStreamResponse';
import { testAuthRouter } from '../server/testAuth';

// Create Express app
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

// Health check
app.get("/health", (req: any, res: any) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// OAuth callback under /api/oauth/callback
registerOAuthRoutes(app);

// Interview progress SSE endpoint
app.use('/api', interviewProgressRouter);

// ReAct Agent streaming endpoints
app.use('/api', reactAgentsRouter);

// Topic Practice streaming endpoints
app.use('/api', topicPracticeStreamRouter);

// Topic Practice stream response endpoints
app.use('/api/topic-practice', topicPracticeStreamResponseRouter);

// Test authentication endpoints (for E2E testing)
app.use('/api/test-auth', testAuthRouter);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[API Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Export Vercel serverless handler
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    // Use Express app to handle the request
    return new Promise((resolve, reject) => {
      app(request as any, response as any, (err: any) => {
        if (err) {
          console.error('[Handler Error]', err);
          response.status(500).json({ error: 'Internal Server Error' });
          resolve(undefined);
        } else {
          resolve(undefined);
        }
      });
    });
  } catch (error) {
    console.error('[Uncaught Error]', error);
    response.status(500).json({ error: 'Internal Server Error' });
  }
}
