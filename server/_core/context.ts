import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: any;
  res: any;
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Authentication disabled - always return null user
  // To enable authentication later, uncomment and configure:
  // import { sdk } from "./sdk";
  // try {
  //   user = await sdk.authenticateRequest(opts.req);
  // } catch (error) {
  //   user = null;
  // }

  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
