import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: any;
  res: any;
  user: User | null;
};

// Mock user for development/demo mode when OAuth is not configured
const MOCK_USER: User = {
  id: 1,
  openId: "demo-user-001",
  name: "Demo User",
  email: "demo@example.com",
  loginMethod: "demo",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Authentication disabled - return mock user for demo mode
  // To enable real authentication later, uncomment and configure:
  // import { sdk } from "./sdk";
  // try {
  //   user = await sdk.authenticateRequest(opts.req);
  // } catch (error) {
  //   user = null;
  // }

  return {
    req: opts.req,
    res: opts.res,
    user: MOCK_USER,
  };
}
