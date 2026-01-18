import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerGoogleAuthRoutes } from "./_core/googleAuth";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import interviewProgressRouter from "./routes/interviewProgress";
import reactAgentsRouter from "./routes/reactAgents";
import topicPracticeStreamRouter from './routes/topicPracticeStream';
import topicPracticeStreamResponseRouter from './routes/topicPracticeStreamResponse';
import { testAuthRouter } from './testAuth';

const app = express();
const PORT = process.env.PORT || 5000;

// Cookie parser middleware (must be before routes)
app.use(cookieParser());

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
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
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// OAuth callback under /api/oauth/callback (legacy Manus OAuth)
registerOAuthRoutes(app);

// Google OAuth routes
registerGoogleAuthRoutes(app);

// Interview progress SSE endpoint
app.use('/api', interviewProgressRouter);

// ReAct Agent streaming endpoints
app.use('/api', reactAgentsRouter);

// Topic Practice streaming endpoints
app.use('/api', topicPracticeStreamRouter);

// Topic Practice stream response endpoints
app.use('/api/topic-practice', topicPracticeStreamResponseRouter);

// Test authentication endpoints (for E2E testing - only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test-auth', testAuthRouter);
}

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
});
