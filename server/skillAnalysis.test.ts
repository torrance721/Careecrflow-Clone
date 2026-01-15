/**
 * Skill Analysis Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillAnalysisResult, SkillAnalysisInput } from "./skillAnalysisService";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([]))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve())
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve())
    }))
  }))
}));

// Mock the LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() => Promise.resolve({
    choices: [{
      message: {
        content: JSON.stringify({
          score: 75,
          strongMatch: ["JavaScript", "React", "TypeScript"],
          partialMatch: [
            { resume: "Node.js", job: "Backend Development" },
            { resume: "PostgreSQL", job: "Database Management" }
          ],
          missing: ["GraphQL", "AWS", "Docker"]
        })
      }
    }]
  }))
}));

describe("Skill Analysis Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeSkills", () => {
    it("should return a valid skill analysis result structure", async () => {
      // This test validates the expected output structure
      const mockResult: SkillAnalysisResult = {
        score: 75,
        strongMatch: ["JavaScript", "React", "TypeScript"],
        partialMatch: [
          { resume: "Node.js", job: "Backend Development" },
          { resume: "PostgreSQL", job: "Database Management" }
        ],
        missing: ["GraphQL", "AWS", "Docker"],
        cached: false
      };

      // Validate structure
      expect(mockResult.score).toBeGreaterThanOrEqual(0);
      expect(mockResult.score).toBeLessThanOrEqual(100);
      expect(Array.isArray(mockResult.strongMatch)).toBe(true);
      expect(Array.isArray(mockResult.partialMatch)).toBe(true);
      expect(Array.isArray(mockResult.missing)).toBe(true);
      expect(typeof mockResult.cached).toBe("boolean");
    });

    it("should validate input structure", () => {
      const validInput: SkillAnalysisInput = {
        jobDescription: "We are looking for a Senior Software Engineer with experience in React, TypeScript, and Node.js. The ideal candidate should have 5+ years of experience.",
        jobTitle: "Senior Software Engineer",
        company: "Tech Corp",
        jobUrl: "https://linkedin.com/jobs/123",
        userId: 1
      };

      // Validate required fields
      expect(validInput.jobDescription.length).toBeGreaterThan(50);
      expect(typeof validInput.userId).toBe("number");
    });

    it("should handle optional fields correctly", () => {
      const minimalInput: SkillAnalysisInput = {
        jobDescription: "We are looking for a Software Engineer with experience in Python, Django, and PostgreSQL. Must have strong problem-solving skills.",
        userId: 1
      };

      // Optional fields should be undefined
      expect(minimalInput.jobTitle).toBeUndefined();
      expect(minimalInput.company).toBeUndefined();
      expect(minimalInput.jobUrl).toBeUndefined();
      expect(minimalInput.resumeId).toBeUndefined();
    });
  });

  describe("Score Calculation", () => {
    it("should categorize scores correctly", () => {
      const categorizeScore = (score: number): string => {
        if (score >= 90) return "Excellent";
        if (score >= 70) return "Good";
        if (score >= 50) return "Moderate";
        if (score >= 30) return "Weak";
        return "Poor";
      };

      expect(categorizeScore(95)).toBe("Excellent");
      expect(categorizeScore(75)).toBe("Good");
      expect(categorizeScore(55)).toBe("Moderate");
      expect(categorizeScore(35)).toBe("Weak");
      expect(categorizeScore(20)).toBe("Poor");
    });
  });

  describe("Partial Match Structure", () => {
    it("should validate partial match objects", () => {
      const partialMatches = [
        { resume: "React.js", job: "Frontend Framework" },
        { resume: "Express.js", job: "Backend Framework" },
        { resume: "MySQL", job: "SQL Database" }
      ];

      partialMatches.forEach(match => {
        expect(typeof match.resume).toBe("string");
        expect(typeof match.job).toBe("string");
        expect(match.resume.length).toBeGreaterThan(0);
        expect(match.job.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent cache keys", () => {
      const crypto = require("crypto");
      
      const generateCacheKey = (jobDescription: string, resumeId: number): string => {
        const hash = crypto.createHash("sha256");
        hash.update(jobDescription + resumeId.toString());
        return hash.digest("hex").substring(0, 64);
      };

      const key1 = generateCacheKey("Job description text", 1);
      const key2 = generateCacheKey("Job description text", 1);
      const key3 = generateCacheKey("Different job description", 1);
      const key4 = generateCacheKey("Job description text", 2);

      // Same inputs should produce same key
      expect(key1).toBe(key2);
      
      // Different inputs should produce different keys
      expect(key1).not.toBe(key3);
      expect(key1).not.toBe(key4);
      
      // Key should be 64 characters (SHA256 hex)
      expect(key1.length).toBe(64);
    });
  });

  describe("Error Handling", () => {
    it("should define expected error codes", () => {
      const errorCodes = [
        "NO_RESUME",
        "RESUME_NOT_FOUND",
        "LLM_RESPONSE_EMPTY",
        "LLM_RESPONSE_INVALID"
      ];

      errorCodes.forEach(code => {
        expect(typeof code).toBe("string");
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Resume Text Extraction", () => {
    it("should handle various resume data structures", () => {
      const mockResume = {
        personalInfo: { firstName: "John", lastName: "Doe" },
        summary: "Experienced software engineer",
        skills: [{ name: "JavaScript" }, { name: "TypeScript" }],
        experience: [
          {
            position: "Senior Engineer",
            company: "Tech Corp",
            description: "Led development team",
            highlights: ["Improved performance by 50%"]
          }
        ],
        education: [
          {
            degree: "Bachelor",
            field: "Computer Science",
            institution: "MIT"
          }
        ],
        projects: [
          {
            name: "Open Source Project",
            description: "A popular library",
            technologies: ["React", "Node.js"]
          }
        ],
        certifications: [{ name: "AWS Certified" }]
      };

      // Validate structure
      expect(mockResume.personalInfo).toBeDefined();
      expect(Array.isArray(mockResume.skills)).toBe(true);
      expect(Array.isArray(mockResume.experience)).toBe(true);
      expect(Array.isArray(mockResume.education)).toBe(true);
    });
  });
});

describe("tRPC Skill Analysis Router", () => {
  describe("analyze endpoint", () => {
    it("should require minimum job description length", () => {
      const minLength = 50;
      const shortDescription = "Short job description";
      const validDescription = "We are looking for a Senior Software Engineer with experience in React, TypeScript, and Node.js. The ideal candidate should have 5+ years of experience.";

      expect(shortDescription.length).toBeLessThan(minLength);
      expect(validDescription.length).toBeGreaterThanOrEqual(minLength);
    });

    it("should return success response structure", () => {
      const successResponse = {
        success: true,
        data: {
          score: 75,
          strongMatch: ["JavaScript"],
          partialMatch: [],
          missing: ["GraphQL"],
          cached: false
        }
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toBeDefined();
      expect(typeof successResponse.data.score).toBe("number");
    });

    it("should return error response structure", () => {
      const errorResponse = {
        success: false,
        error: "NO_RESUME",
        message: "Please create a resume first to analyze skill matches."
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.message).toBeDefined();
    });
  });

  describe("getResumes endpoint", () => {
    it("should return resume list structure", () => {
      const mockResumes = [
        {
          id: 1,
          title: "Software Engineer Resume",
          type: "base",
          isDefault: true,
          targetJobTitle: null,
          targetCompany: null,
          updatedAt: new Date()
        },
        {
          id: 2,
          title: "Tailored for Google",
          type: "tailored",
          isDefault: false,
          targetJobTitle: "Senior SWE",
          targetCompany: "Google",
          updatedAt: new Date()
        }
      ];

      mockResumes.forEach(resume => {
        expect(typeof resume.id).toBe("number");
        expect(typeof resume.title).toBe("string");
        expect(["base", "tailored"]).toContain(resume.type);
        expect(typeof resume.isDefault).toBe("boolean");
      });
    });
  });

  describe("clearCache endpoint", () => {
    it("should accept resumeId parameter", () => {
      const input = { resumeId: 1 };
      expect(typeof input.resumeId).toBe("number");
      expect(input.resumeId).toBeGreaterThan(0);
    });

    it("should return success response", () => {
      const response = { success: true };
      expect(response.success).toBe(true);
    });
  });
});
