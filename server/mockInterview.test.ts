import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("mockInterview router", () => {
  it("should have createSession procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify the procedure exists
    expect(caller.mockInterview).toBeDefined();
    expect(caller.mockInterview.createSession).toBeDefined();
  });

  it("should have sendMessage procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.mockInterview.sendMessage).toBeDefined();
  });

  it("should have endSession procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.mockInterview.endSession).toBeDefined();
  });

  it("should have getSession procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.mockInterview.getSession).toBeDefined();
  });

  it("should have getReport procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.mockInterview.getReport).toBeDefined();
  });

  it("should have listReports procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.mockInterview.listReports).toBeDefined();
  });
});

describe("jobs router", () => {
  it("should have list procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.jobs).toBeDefined();
    expect(caller.jobs.list).toBeDefined();
  });

  it("should have generateMock procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.jobs.generateMock).toBeDefined();
  });
});

describe("preferences router", () => {
  it("should have get procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.preferences).toBeDefined();
    expect(caller.preferences.get).toBeDefined();
  });

  it("should have update procedure defined", () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.preferences.update).toBeDefined();
  });
});
