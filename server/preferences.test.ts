import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
  getJobRecommendations: vi.fn(),
  createJobRecommendation: vi.fn(),
  deleteJobRecommendations: vi.fn(),
  getInterviewHistory: vi.fn(),
  createInterviewHistory: vi.fn(),
  getInterviewHistoryById: vi.fn(),
  deleteInterviewHistory: vi.fn(),
}));

import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
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
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("preferences.get", () => {
    it("returns user preferences when they exist", async () => {
      const mockPreferences = {
        id: 1,
        userId: 1,
        employmentTypes: ["Full-time", "Part-time"],
        workMode: "Remote",
        location: "New York City, New York",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getUserPreferences).mockResolvedValue(mockPreferences);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.preferences.get();

      expect(result).toEqual(mockPreferences);
      expect(db.getUserPreferences).toHaveBeenCalledWith(1);
    });

    it("returns undefined when no preferences exist", async () => {
      vi.mocked(db.getUserPreferences).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.preferences.get();

      expect(result).toBeUndefined();
    });
  });

  describe("preferences.save", () => {
    it("saves user preferences successfully", async () => {
      const savedPreferences = {
        id: 1,
        userId: 1,
        employmentTypes: ["Full-time"],
        workMode: "Onsite",
        location: "San Francisco, California",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.upsertUserPreferences).mockResolvedValue(savedPreferences);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.preferences.save({
        employmentTypes: ["Full-time"],
        workMode: "Onsite",
        location: "San Francisco, California",
      });

      expect(result).toEqual(savedPreferences);
      expect(db.upsertUserPreferences).toHaveBeenCalledWith(1, {
        employmentTypes: ["Full-time"],
        workMode: "Onsite",
        location: "San Francisco, California",
      });
    });
  });
});

describe("jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("jobs.list", () => {
    it("returns job recommendations for user", async () => {
      const mockJobs = [
        {
          id: 1,
          userId: 1,
          company: "Test Company",
          position: "Software Engineer",
          location: "New York, NY",
          postedAt: new Date(),
          matchPercentage: 85,
          salaryMin: "100000.00",
          salaryMax: "150000.00",
          jobType: "Full-time",
          industry: "Technology",
          description: "Test description",
          linkedinUrl: "https://linkedin.com/jobs/123",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getJobRecommendations).mockResolvedValue(mockJobs);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.jobs.list();

      expect(result).toEqual(mockJobs);
      expect(db.getJobRecommendations).toHaveBeenCalledWith(1);
    });
  });

  describe("jobs.generateMock", () => {
    it("generates mock job recommendations", async () => {
      vi.mocked(db.deleteJobRecommendations).mockResolvedValue(undefined);
      vi.mocked(db.getUserPreferences).mockResolvedValue({
        id: 1,
        userId: 1,
        employmentTypes: ["Full-time"],
        workMode: "Remote",
        location: "New York, NY",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(db.createJobRecommendation).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.jobs.generateMock();

      expect(result.success).toBe(true);
      expect(result.count).toBe(7);
      expect(db.deleteJobRecommendations).toHaveBeenCalledWith(1);
      expect(db.createJobRecommendation).toHaveBeenCalledTimes(7);
    });
  });
});

describe("interviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("interviews.list", () => {
    it("returns interview history for user", async () => {
      const mockInterviews = [
        {
          id: 1,
          userId: 1,
          question: "Test question?",
          date: new Date(),
          score: 8,
          audioDuration: "1m:30s",
          audioUrl: "",
          aiFeedback: {
            scoreReason: "Good answer",
            capabilityAssessed: "Problem solving",
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getInterviewHistory).mockResolvedValue(mockInterviews);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.interviews.list();

      expect(result).toEqual(mockInterviews);
      expect(db.getInterviewHistory).toHaveBeenCalledWith(1);
    });
  });

  describe("interviews.create", () => {
    it("creates a new interview record", async () => {
      vi.mocked(db.createInterviewHistory).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.interviews.create({
        question: "What is your experience with React?",
        score: 7,
        audioDuration: "2m:15s",
        aiFeedback: {
          scoreReason: "Good technical depth",
          capabilityAssessed: "Technical knowledge",
        },
      });

      expect(result.success).toBe(true);
      expect(db.createInterviewHistory).toHaveBeenCalledWith({
        userId: 1,
        question: "What is your experience with React?",
        score: 7,
        audioDuration: "2m:15s",
        audioUrl: undefined,
        aiFeedback: {
          scoreReason: "Good technical depth",
          capabilityAssessed: "Technical knowledge",
        },
      });
    });
  });

  describe("interviews.delete", () => {
    it("deletes an interview record", async () => {
      vi.mocked(db.deleteInterviewHistory).mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.interviews.delete({ id: 1 });

      expect(result.success).toBe(true);
      expect(db.deleteInterviewHistory).toHaveBeenCalledWith(1);
    });
  });
});
