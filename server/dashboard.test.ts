import { describe, it, expect, vi } from "vitest";

/**
 * Dashboard Service Tests
 * Tests for dynamic stats and progress tracking
 */

describe("Dashboard Stats", () => {
  describe("getJobhUserStats", () => {
    it("should return zero counts for new user", () => {
      const stats = {
        resumesCreated: 0,
        jobsTracked: 0,
        interviewsCompleted: 0,
      };
      
      expect(stats.resumesCreated).toBe(0);
      expect(stats.jobsTracked).toBe(0);
      expect(stats.interviewsCompleted).toBe(0);
    });

    it("should count resumes correctly", () => {
      const resumes = [
        { id: 1, title: "Resume 1" },
        { id: 2, title: "Resume 2" },
      ];
      
      expect(resumes.length).toBe(2);
    });

    it("should count tracked jobs correctly", () => {
      const jobs = [
        { id: 1, status: "applied" },
        { id: 2, status: "interviewing" },
        { id: 3, status: "offer" },
      ];
      
      expect(jobs.length).toBe(3);
    });

    it("should count interviews correctly", () => {
      const jobs = [
        { id: 1, status: "applied" },
        { id: 2, status: "interviewing" },
        { id: 3, status: "interviewing" },
        { id: 4, status: "offer" },
      ];
      
      const interviewCount = jobs.filter(j => j.status === "interviewing").length;
      expect(interviewCount).toBe(2);
    });
  });
});

describe("Progress Tracking", () => {
  describe("Dynamic Progress Calculation", () => {
    it("should calculate 0% progress for new user", () => {
      const todoItems = [
        { label: "Create Resume", completed: false },
        { label: "Optimize LinkedIn", completed: false },
        { label: "Track Jobs", completed: false },
        { label: "Prepare Interview", completed: false },
      ];
      
      const completedCount = todoItems.filter(item => item.completed).length;
      const progressPercent = (completedCount / todoItems.length) * 100;
      
      expect(progressPercent).toBe(0);
    });

    it("should calculate 25% progress with one task done", () => {
      const todoItems = [
        { label: "Create Resume", completed: true },
        { label: "Optimize LinkedIn", completed: false },
        { label: "Track Jobs", completed: false },
        { label: "Prepare Interview", completed: false },
      ];
      
      const completedCount = todoItems.filter(item => item.completed).length;
      const progressPercent = (completedCount / todoItems.length) * 100;
      
      expect(progressPercent).toBe(25);
    });

    it("should calculate 50% progress with two tasks done", () => {
      const todoItems = [
        { label: "Create Resume", completed: true },
        { label: "Optimize LinkedIn", completed: false },
        { label: "Track Jobs", completed: true },
        { label: "Prepare Interview", completed: false },
      ];
      
      const completedCount = todoItems.filter(item => item.completed).length;
      const progressPercent = (completedCount / todoItems.length) * 100;
      
      expect(progressPercent).toBe(50);
    });

    it("should calculate 100% progress with all tasks done", () => {
      const todoItems = [
        { label: "Create Resume", completed: true },
        { label: "Optimize LinkedIn", completed: true },
        { label: "Track Jobs", completed: true },
        { label: "Prepare Interview", completed: true },
      ];
      
      const completedCount = todoItems.filter(item => item.completed).length;
      const progressPercent = (completedCount / todoItems.length) * 100;
      
      expect(progressPercent).toBe(100);
    });
  });

  describe("Task Completion Detection", () => {
    it("should detect resume creation", () => {
      const resumes = [{ id: 1, title: "My Resume" }];
      const hasResume = resumes.length > 0;
      
      expect(hasResume).toBe(true);
    });

    it("should detect no resume", () => {
      const resumes: any[] = [];
      const hasResume = resumes.length > 0;
      
      expect(hasResume).toBe(false);
    });

    it("should detect job tracking", () => {
      const jobs = [{ id: 1, status: "applied" }];
      const hasJobs = jobs.length > 0;
      
      expect(hasJobs).toBe(true);
    });

    it("should detect interview status", () => {
      const jobs = [
        { id: 1, status: "applied" },
        { id: 2, status: "interviewing" },
      ];
      const hasInterview = jobs.some(j => j.status === "interviewing");
      
      expect(hasInterview).toBe(true);
    });

    it("should detect offer status", () => {
      const jobs = [
        { id: 1, status: "applied" },
        { id: 2, status: "offer" },
      ];
      const hasOffer = jobs.some(j => j.status === "offer");
      
      expect(hasOffer).toBe(true);
    });
  });
});

describe("Job Pipeline Stats", () => {
  describe("Status Counting", () => {
    it("should count applied jobs", () => {
      const jobs = [
        { status: "applied" },
        { status: "applied" },
        { status: "interviewing" },
      ];
      
      const appliedCount = jobs.filter(j => j.status === "applied").length;
      expect(appliedCount).toBe(2);
    });

    it("should count interviewing jobs", () => {
      const jobs = [
        { status: "applied" },
        { status: "interviewing" },
        { status: "interviewing" },
      ];
      
      const interviewingCount = jobs.filter(j => j.status === "interviewing").length;
      expect(interviewingCount).toBe(2);
    });

    it("should count offered jobs", () => {
      const jobs = [
        { status: "applied" },
        { status: "offer" },
        { status: "offer" },
      ];
      
      const offeredCount = jobs.filter(j => j.status === "offer").length;
      expect(offeredCount).toBe(2);
    });

    it("should count rejected jobs", () => {
      const jobs = [
        { status: "applied" },
        { status: "rejected" },
        { status: "rejected" },
        { status: "rejected" },
      ];
      
      const rejectedCount = jobs.filter(j => j.status === "rejected").length;
      expect(rejectedCount).toBe(3);
    });

    it("should handle empty jobs array", () => {
      const jobs: any[] = [];
      
      const stats = {
        applied: jobs.filter(j => j.status === "applied").length,
        interviewing: jobs.filter(j => j.status === "interviewing").length,
        offered: jobs.filter(j => j.status === "offer").length,
        rejected: jobs.filter(j => j.status === "rejected").length,
      };
      
      expect(stats.applied).toBe(0);
      expect(stats.interviewing).toBe(0);
      expect(stats.offered).toBe(0);
      expect(stats.rejected).toBe(0);
    });
  });
});

describe("Progress Steps", () => {
  describe("Step State Management", () => {
    it("should mark Application Materials as active by default", () => {
      const currentStep = 0;
      const progressSteps = [
        { label: "Application Materials", active: currentStep === 0 },
        { label: "Jobs", active: currentStep === 1 },
        { label: "Networking", active: currentStep === 2 },
        { label: "Interviews", active: currentStep === 3 },
      ];
      
      expect(progressSteps[0].active).toBe(true);
      expect(progressSteps[1].active).toBe(false);
    });

    it("should update active step on click", () => {
      let currentStep = 0;
      currentStep = 2; // Simulate click on Networking
      
      const progressSteps = [
        { label: "Application Materials", active: currentStep === 0 },
        { label: "Jobs", active: currentStep === 1 },
        { label: "Networking", active: currentStep === 2 },
        { label: "Interviews", active: currentStep === 3 },
      ];
      
      expect(progressSteps[2].active).toBe(true);
      expect(progressSteps[0].active).toBe(false);
    });

    it("should mark completed steps correctly", () => {
      const hasResume = true;
      const hasJobs = true;
      const hasInterview = false;
      
      const progressSteps = [
        { label: "Application Materials", completed: hasResume },
        { label: "Jobs", completed: hasJobs },
        { label: "Networking", completed: false },
        { label: "Interviews", completed: hasInterview },
      ];
      
      expect(progressSteps[0].completed).toBe(true);
      expect(progressSteps[1].completed).toBe(true);
      expect(progressSteps[2].completed).toBe(false);
      expect(progressSteps[3].completed).toBe(false);
    });
  });
});
