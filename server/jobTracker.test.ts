import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Create a mock authenticated user context
function createAuthContext(): TrpcContext {
  const user = {
    id: 999,
    openId: "test-job-tracker-user",
    email: "jobtracker@test.com",
    name: "Job Tracker Test User",
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

describe("Job Tracker API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let createdJobIds: number[] = [];

  beforeEach(() => {
    const ctx = createAuthContext();
    caller = appRouter.createCaller(ctx);
    createdJobIds = [];
  });

  afterEach(async () => {
    // Clean up created jobs
    for (const id of createdJobIds) {
      try {
        await caller.jobTracker.delete({ id });
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
  });

  describe("jobTracker.create", () => {
    it("should create a job with required fields", async () => {
      const result = await caller.jobTracker.create({
        jobTitle: "Software Engineer",
        companyName: "Test Company",
        status: "saved",
      });

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
      if (result?.id) createdJobIds.push(result.id);
    });

    it("should create a job with all optional fields", async () => {
      const result = await caller.jobTracker.create({
        jobTitle: "Senior Engineer",
        companyName: "Full Company",
        status: "applied",
        location: "San Francisco, CA",
        jobUrl: "https://example.com/job",
        salary: "$150,000 - $200,000",
        description: "Great opportunity for a senior engineer",
        notes: "Applied via LinkedIn",
        tags: ["remote", "tech"],
      });

      expect(result).toBeDefined();
      expect(result?.id).toBeDefined();
      if (result?.id) createdJobIds.push(result.id);
    });
  });

  describe("jobTracker.list", () => {
    it("should return all jobs for the user", async () => {
      // Create a job first
      const created = await caller.jobTracker.create({
        jobTitle: "Engineer",
        companyName: "List Test Company",
        status: "saved",
      });
      if (created?.id) createdJobIds.push(created.id);

      // List jobs
      const jobs = await caller.jobTracker.list();

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      
      // Find our created job
      const foundJob = jobs.find((j: { id: number }) => j.id === created?.id);
      expect(foundJob).toBeDefined();
      expect(foundJob?.companyName).toBe("List Test Company");
    });
  });

  describe("jobTracker.updateStatus", () => {
    it("should update job status", async () => {
      // Create a job
      const created = await caller.jobTracker.create({
        jobTitle: "Engineer",
        companyName: "Update Status Company",
        status: "saved",
      });
      if (created?.id) createdJobIds.push(created.id);

      // Update the status
      const updated = await caller.jobTracker.updateStatus({
        id: created!.id,
        status: "interviewing",
      });

      expect(updated?.status).toBe("interviewing");
    });
  });

  describe("jobTracker.delete", () => {
    it("should delete a job", async () => {
      // Create a job
      const created = await caller.jobTracker.create({
        jobTitle: "Engineer",
        companyName: "Delete Test Company",
        status: "saved",
      });

      // Delete the job
      const result = await caller.jobTracker.delete({ id: created!.id });
      expect(result.success).toBe(true);

      // Verify the job is deleted by listing
      const jobs = await caller.jobTracker.list();
      const foundJob = jobs.find((j: { id: number }) => j.id === created?.id);
      expect(foundJob).toBeUndefined();
    });
  });
});


// ============ Additional Unit Tests for Job Tracker Logic ============

describe("Job Tracker Logic (Unit Tests)", () => {
  describe("Job Search Logic", () => {
    const mockJobs = [
      { id: 1, jobTitle: "Software Engineer", companyName: "Google", location: "San Francisco", tags: ["tech", "remote"] },
      { id: 2, jobTitle: "Product Manager", companyName: "Meta", location: "New York", tags: ["product", "hybrid"] },
      { id: 3, jobTitle: "Data Scientist", companyName: "Amazon", location: "Seattle", tags: ["data", "ml"] },
      { id: 4, jobTitle: "Frontend Developer", companyName: "Netflix", location: "Los Angeles", tags: ["frontend", "react"] },
    ];

    const searchJobs = (jobs: typeof mockJobs, query: string) => {
      if (!query) return jobs;
      const lowerQuery = query.toLowerCase();
      return jobs.filter(job => 
        job.jobTitle.toLowerCase().includes(lowerQuery) ||
        job.companyName.toLowerCase().includes(lowerQuery) ||
        (job.location && job.location.toLowerCase().includes(lowerQuery)) ||
        (job.tags && job.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
      );
    };

    it("should return all jobs when search query is empty", () => {
      const result = searchJobs(mockJobs, "");
      expect(result.length).toBe(4);
    });

    it("should search by job title", () => {
      const result = searchJobs(mockJobs, "engineer");
      expect(result.length).toBe(1);
      expect(result[0].jobTitle).toBe("Software Engineer");
    });

    it("should search by company name", () => {
      const result = searchJobs(mockJobs, "google");
      expect(result.length).toBe(1);
      expect(result[0].companyName).toBe("Google");
    });

    it("should search by location", () => {
      const result = searchJobs(mockJobs, "new york");
      expect(result.length).toBe(1);
      expect(result[0].location).toBe("New York");
    });

    it("should search by tags", () => {
      const result = searchJobs(mockJobs, "react");
      expect(result.length).toBe(1);
      expect(result[0].tags).toContain("react");
    });

    it("should be case insensitive", () => {
      const result1 = searchJobs(mockJobs, "GOOGLE");
      const result2 = searchJobs(mockJobs, "google");
      expect(result1.length).toBe(1);
      expect(result2.length).toBe(1);
    });
  });

  describe("Job Filter Logic", () => {
    const mockJobs = [
      { id: 1, status: "saved", jobTitle: "Job 1" },
      { id: 2, status: "applied", jobTitle: "Job 2" },
      { id: 3, status: "interviewing", jobTitle: "Job 3" },
      { id: 4, status: "offer", jobTitle: "Job 4" },
      { id: 5, status: "rejected", jobTitle: "Job 5" },
      { id: 6, status: "saved", jobTitle: "Job 6" },
    ];

    const filterByStatus = (jobs: typeof mockJobs, status: string | "all") => {
      if (status === "all") return jobs;
      return jobs.filter(job => job.status === status);
    };

    it("should return all jobs when filter is 'all'", () => {
      const result = filterByStatus(mockJobs, "all");
      expect(result.length).toBe(6);
    });

    it("should filter by saved status", () => {
      const result = filterByStatus(mockJobs, "saved");
      expect(result.length).toBe(2);
    });

    it("should filter by applied status", () => {
      const result = filterByStatus(mockJobs, "applied");
      expect(result.length).toBe(1);
    });
  });

  describe("Job Stats Calculation", () => {
    const mockJobs = [
      { id: 1, status: "saved" },
      { id: 2, status: "saved" },
      { id: 3, status: "applied" },
      { id: 4, status: "applied" },
      { id: 5, status: "applied" },
      { id: 6, status: "interviewing" },
      { id: 7, status: "interviewing" },
      { id: 8, status: "offer" },
      { id: 9, status: "rejected" },
      { id: 10, status: "rejected" },
    ];

    const calculateStats = (jobs: typeof mockJobs) => ({
      total: jobs.length,
      saved: jobs.filter(j => j.status === "saved").length,
      applied: jobs.filter(j => j.status === "applied").length,
      interviewing: jobs.filter(j => j.status === "interviewing").length,
      offer: jobs.filter(j => j.status === "offer").length,
      rejected: jobs.filter(j => j.status === "rejected").length,
    });

    it("should calculate correct total", () => {
      const stats = calculateStats(mockJobs);
      expect(stats.total).toBe(10);
    });

    it("should calculate correct status counts", () => {
      const stats = calculateStats(mockJobs);
      expect(stats.saved).toBe(2);
      expect(stats.applied).toBe(3);
      expect(stats.interviewing).toBe(2);
      expect(stats.offer).toBe(1);
      expect(stats.rejected).toBe(2);
    });

    it("should handle empty jobs array", () => {
      const stats = calculateStats([]);
      expect(stats.total).toBe(0);
    });
  });

  describe("Tags Management", () => {
    const addTag = (tags: string[], newTag: string): string[] => {
      const trimmed = newTag.trim();
      if (!trimmed || tags.includes(trimmed)) return tags;
      return [...tags, trimmed];
    };

    const removeTag = (tags: string[], tagToRemove: string): string[] => {
      return tags.filter(t => t !== tagToRemove);
    };

    it("should add new tag", () => {
      const result = addTag(["tech"], "remote");
      expect(result).toEqual(["tech", "remote"]);
    });

    it("should not add duplicate tag", () => {
      const result = addTag(["tech", "remote"], "tech");
      expect(result).toEqual(["tech", "remote"]);
    });

    it("should not add empty tag", () => {
      const result = addTag(["tech"], "");
      expect(result).toEqual(["tech"]);
    });

    it("should remove existing tag", () => {
      const result = removeTag(["tech", "remote", "hybrid"], "remote");
      expect(result).toEqual(["tech", "hybrid"]);
    });
  });
});
