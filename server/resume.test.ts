import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Create a mock authenticated user context
function createAuthContext(): TrpcContext {
  const user = {
    id: 999,
    openId: "test-resume-user",
    email: "resume@test.com",
    name: "Resume Test User",
    loginMethod: "manus" as const,
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Resume API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let createdResumeIds: number[] = [];

  beforeEach(() => {
    const ctx = createAuthContext();
    caller = appRouter.createCaller(ctx);
    createdResumeIds = [];
  });

  afterEach(async () => {
    // Clean up created resumes
    for (const id of createdResumeIds) {
      try {
        await caller.resume.delete({ id });
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });

  describe("resume.create", () => {
    it("should create a base resume", async () => {
      const result = await caller.resume.create({
        title: "Test Base Resume",
        type: "base",
      });

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
      expect(result?.title).toBe("Test Base Resume");
      expect(result?.type).toBe("base");
      if (result?.id) createdResumeIds.push(result.id);
    });

    it("should create a tailored resume", async () => {
      const result = await caller.resume.create({
        title: "Test Tailored Resume",
        type: "tailored",
      });

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
      expect(result?.type).toBe("tailored");
      if (result?.id) createdResumeIds.push(result.id);
    });
  });

  describe("resume.list", () => {
    it("should return all resumes for the user", async () => {
      // Create a resume first
      const created = await caller.resume.create({
        title: "List Test Resume",
        type: "base",
      });
      if (created?.id) createdResumeIds.push(created.id);

      // List resumes
      const resumes = await caller.resume.list();

      expect(Array.isArray(resumes)).toBe(true);
      expect(resumes.length).toBeGreaterThanOrEqual(1);
      
      // Find our created resume
      const foundResume = resumes.find((r: { id: number }) => r.id === created?.id);
      expect(foundResume).toBeDefined();
      expect(foundResume?.title).toBe("List Test Resume");
    });
  });

  describe("resume.get", () => {
    it("should return a specific resume by id", async () => {
      // Create a resume first
      const created = await caller.resume.create({
        title: "Get Test Resume",
        type: "base",
      });
      if (created?.id) createdResumeIds.push(created.id);

      // Get the resume
      const resume = await caller.resume.get({ id: created!.id });

      expect(resume).toBeDefined();
      expect(resume?.id).toBe(created?.id);
      expect(resume?.title).toBe("Get Test Resume");
    });
  });

  describe("resume.update", () => {
    it("should update a resume", async () => {
      // Create a resume first
      const created = await caller.resume.create({
        title: "Update Test Resume",
        type: "base",
      });
      if (created?.id) createdResumeIds.push(created.id);

      // Update the resume
      const updated = await caller.resume.update({
        id: created!.id,
        title: "Updated Resume Title",
        summary: "This is a test summary",
      });

      expect(updated?.title).toBe("Updated Resume Title");
      expect(updated?.summary).toBe("This is a test summary");
    });
  });

  describe("resume.delete", () => {
    it("should delete a resume", async () => {
      // Create a resume first
      const created = await caller.resume.create({
        title: "Delete Test Resume",
        type: "base",
      });

      // Delete the resume
      const result = await caller.resume.delete({ id: created!.id });
      expect(result.success).toBe(true);

      // Verify the resume is deleted
      const resumes = await caller.resume.list();
      const foundResume = resumes.find((r: { id: number }) => r.id === created?.id);
      expect(foundResume).toBeUndefined();
    });
  });
});
