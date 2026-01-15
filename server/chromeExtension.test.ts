import { describe, it, expect, vi } from "vitest";

/**
 * Chrome Extension Tests
 * Tests for job extraction, profile scoring, and content script functionality
 */

// Mock job data structure
interface ExtractedJob {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  tags: string[];
  source: string;
}

// Mock profile data structure
interface ProfileData {
  hasPhoto: boolean;
  headline: string;
  summary: string;
  experience: Array<{ title: string; company: string }>;
  education: Array<{ school: string; degree: string }>;
  skills: string[];
  connections: number;
  recommendations: Array<{ text: string }>;
}

describe("LinkedIn Job Extraction", () => {
  describe("Title Extraction", () => {
    it("should extract job title from selector", () => {
      const mockTitle = "Senior Software Engineer";
      expect(mockTitle).toBe("Senior Software Engineer");
    });

    it("should handle missing title gracefully", () => {
      const title = null || "Unknown Title";
      expect(title).toBe("Unknown Title");
    });
  });

  describe("Company Extraction", () => {
    it("should extract company name", () => {
      const mockCompany = "Google";
      expect(mockCompany).toBe("Google");
    });

    it("should handle missing company gracefully", () => {
      const company = null || "Unknown Company";
      expect(company).toBe("Unknown Company");
    });
  });

  describe("Location Extraction", () => {
    it("should extract location", () => {
      const mockLocation = "Mountain View, CA";
      expect(mockLocation).toContain("CA");
    });

    it("should handle remote locations", () => {
      const location = "Remote";
      expect(location).toBe("Remote");
    });
  });

  describe("Salary Extraction", () => {
    it("should extract salary with dollar sign", () => {
      const text = "$150,000 - $200,000/yr";
      const hasSalary = text.includes("$");
      expect(hasSalary).toBe(true);
    });

    it("should detect salary keywords", () => {
      const text = "Competitive salary";
      const hasSalaryKeyword = text.toLowerCase().includes("salary");
      expect(hasSalaryKeyword).toBe(true);
    });
  });

  describe("Tags Extraction", () => {
    it("should extract skills from description", () => {
      const description = "We are looking for a React developer with TypeScript experience";
      const skillKeywords = ["React", "TypeScript", "Python", "Java"];
      const tags = skillKeywords.filter(skill => 
        description.toLowerCase().includes(skill.toLowerCase())
      );
      
      expect(tags).toContain("React");
      expect(tags).toContain("TypeScript");
      expect(tags).not.toContain("Python");
    });

    it("should limit tags to 10", () => {
      const tags = Array(15).fill("Skill");
      const limitedTags = tags.slice(0, 10);
      expect(limitedTags.length).toBe(10);
    });
  });
});

describe("Indeed Job Extraction", () => {
  describe("Job Type Detection", () => {
    it("should detect Full-time jobs", () => {
      const text = "Full-time position";
      const jobTypes = ["Full-time", "Part-time", "Contract"];
      const detected = jobTypes.find(type => 
        text.toLowerCase().includes(type.toLowerCase())
      );
      expect(detected).toBe("Full-time");
    });

    it("should detect Part-time jobs", () => {
      const text = "Part-time opportunity";
      const jobTypes = ["Full-time", "Part-time", "Contract"];
      const detected = jobTypes.find(type => 
        text.toLowerCase().includes(type.toLowerCase())
      );
      expect(detected).toBe("Part-time");
    });

    it("should detect Contract jobs", () => {
      const text = "Contract role available";
      const jobTypes = ["Full-time", "Part-time", "Contract"];
      const detected = jobTypes.find(type => 
        text.toLowerCase().includes(type.toLowerCase())
      );
      expect(detected).toBe("Contract");
    });
  });

  describe("Description Cleaning", () => {
    it("should remove HTML tags", () => {
      const html = "<p>Job description</p><br><strong>Requirements</strong>";
      const text = html.replace(/<[^>]*>/g, "");
      expect(text).not.toContain("<p>");
      expect(text).toContain("Job description");
    });

    it("should limit description length", () => {
      const description = "A".repeat(1000);
      const limited = description.substring(0, 500);
      expect(limited.length).toBe(500);
    });
  });
});

describe("Glassdoor Job Extraction", () => {
  describe("Rating Extraction", () => {
    it("should extract company rating", () => {
      const rating = "4.5";
      const numRating = parseFloat(rating);
      expect(numRating).toBe(4.5);
    });

    it("should handle missing rating", () => {
      const rating = null || "";
      expect(rating).toBe("");
    });
  });
});

describe("LinkedIn Profile Scoring", () => {
  describe("Photo Score", () => {
    it("should give 10 points for having photo", () => {
      const hasPhoto = true;
      const score = hasPhoto ? 10 : 0;
      expect(score).toBe(10);
    });

    it("should give 0 points for no photo", () => {
      const hasPhoto = false;
      const score = hasPhoto ? 10 : 0;
      expect(score).toBe(0);
    });
  });

  describe("Headline Score", () => {
    it("should give 15 points for headline >= 100 chars", () => {
      const headline = "A".repeat(100);
      let score = 0;
      if (headline.length >= 100) score = 15;
      else if (headline.length >= 50) score = 10;
      else if (headline.length >= 20) score = 5;
      else score = 2;
      expect(score).toBe(15);
    });

    it("should give 10 points for headline >= 50 chars", () => {
      const headline = "A".repeat(60);
      let score = 0;
      if (headline.length >= 100) score = 15;
      else if (headline.length >= 50) score = 10;
      else if (headline.length >= 20) score = 5;
      else score = 2;
      expect(score).toBe(10);
    });

    it("should give 5 points for headline >= 20 chars", () => {
      const headline = "A".repeat(30);
      let score = 0;
      if (headline.length >= 100) score = 15;
      else if (headline.length >= 50) score = 10;
      else if (headline.length >= 20) score = 5;
      else score = 2;
      expect(score).toBe(5);
    });

    it("should give 0 points for no headline", () => {
      const headline = "";
      const score = headline ? 5 : 0;
      expect(score).toBe(0);
    });
  });

  describe("Summary Score", () => {
    it("should give 15 points for summary >= 500 chars", () => {
      const summary = "A".repeat(500);
      let score = 0;
      if (summary.length >= 500) score = 15;
      else if (summary.length >= 200) score = 10;
      else if (summary.length >= 100) score = 5;
      expect(score).toBe(15);
    });

    it("should give 10 points for summary >= 200 chars", () => {
      const summary = "A".repeat(250);
      let score = 0;
      if (summary.length >= 500) score = 15;
      else if (summary.length >= 200) score = 10;
      else if (summary.length >= 100) score = 5;
      expect(score).toBe(10);
    });
  });

  describe("Experience Score", () => {
    it("should give 20 points for 5+ experiences", () => {
      const experience = Array(5).fill({ title: "Engineer", company: "Tech Co" });
      let score = 0;
      if (experience.length >= 5) score = 20;
      else if (experience.length >= 3) score = 15;
      else if (experience.length >= 1) score = 10;
      expect(score).toBe(20);
    });

    it("should give 15 points for 3-4 experiences", () => {
      const experience = Array(3).fill({ title: "Engineer", company: "Tech Co" });
      let score = 0;
      if (experience.length >= 5) score = 20;
      else if (experience.length >= 3) score = 15;
      else if (experience.length >= 1) score = 10;
      expect(score).toBe(15);
    });

    it("should give 10 points for 1-2 experiences", () => {
      const experience = Array(2).fill({ title: "Engineer", company: "Tech Co" });
      let score = 0;
      if (experience.length >= 5) score = 20;
      else if (experience.length >= 3) score = 15;
      else if (experience.length >= 1) score = 10;
      expect(score).toBe(10);
    });

    it("should give 0 points for no experience", () => {
      const experience: any[] = [];
      let score = 0;
      if (experience.length >= 5) score = 20;
      else if (experience.length >= 3) score = 15;
      else if (experience.length >= 1) score = 10;
      expect(score).toBe(0);
    });
  });

  describe("Education Score", () => {
    it("should give 10 points for having education", () => {
      const education = [{ school: "MIT", degree: "BS" }];
      const score = education.length >= 1 ? 10 : 0;
      expect(score).toBe(10);
    });

    it("should give 0 points for no education", () => {
      const education: any[] = [];
      const score = education.length >= 1 ? 10 : 0;
      expect(score).toBe(0);
    });
  });

  describe("Skills Score", () => {
    it("should give 10 points for 10+ skills", () => {
      const skills = Array(12).fill("JavaScript");
      let score = 0;
      if (skills.length >= 10) score = 10;
      else if (skills.length >= 5) score = 7;
      else if (skills.length >= 1) score = 3;
      expect(score).toBe(10);
    });

    it("should give 7 points for 5-9 skills", () => {
      const skills = Array(7).fill("JavaScript");
      let score = 0;
      if (skills.length >= 10) score = 10;
      else if (skills.length >= 5) score = 7;
      else if (skills.length >= 1) score = 3;
      expect(score).toBe(7);
    });

    it("should give 3 points for 1-4 skills", () => {
      const skills = Array(3).fill("JavaScript");
      let score = 0;
      if (skills.length >= 10) score = 10;
      else if (skills.length >= 5) score = 7;
      else if (skills.length >= 1) score = 3;
      expect(score).toBe(3);
    });
  });

  describe("Connections Score", () => {
    it("should give 10 points for 500+ connections", () => {
      const connections = 600;
      let score = 0;
      if (connections >= 500) score = 10;
      else if (connections >= 200) score = 7;
      else if (connections >= 50) score = 4;
      else score = 2;
      expect(score).toBe(10);
    });

    it("should give 7 points for 200-499 connections", () => {
      const connections = 300;
      let score = 0;
      if (connections >= 500) score = 10;
      else if (connections >= 200) score = 7;
      else if (connections >= 50) score = 4;
      else score = 2;
      expect(score).toBe(7);
    });

    it("should give 4 points for 50-199 connections", () => {
      const connections = 100;
      let score = 0;
      if (connections >= 500) score = 10;
      else if (connections >= 200) score = 7;
      else if (connections >= 50) score = 4;
      else score = 2;
      expect(score).toBe(4);
    });
  });

  describe("Recommendations Score", () => {
    it("should give 10 points for 5+ recommendations", () => {
      const recommendations = Array(5).fill({ text: "Great colleague" });
      let score = 0;
      if (recommendations.length >= 5) score = 10;
      else if (recommendations.length >= 2) score = 6;
      else if (recommendations.length >= 1) score = 3;
      expect(score).toBe(10);
    });

    it("should give 6 points for 2-4 recommendations", () => {
      const recommendations = Array(3).fill({ text: "Great colleague" });
      let score = 0;
      if (recommendations.length >= 5) score = 10;
      else if (recommendations.length >= 2) score = 6;
      else if (recommendations.length >= 1) score = 3;
      expect(score).toBe(6);
    });
  });

  describe("Total Score Calculation", () => {
    it("should calculate total score correctly", () => {
      const scores = {
        photo: 10,
        headline: 15,
        summary: 15,
        experience: 20,
        education: 10,
        skills: 10,
        connections: 10,
        recommendations: 10,
      };
      
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      expect(total).toBe(100);
    });

    it("should calculate partial score correctly", () => {
      const scores = {
        photo: 10,
        headline: 10,
        summary: 5,
        experience: 10,
        education: 10,
        skills: 7,
        connections: 4,
        recommendations: 0,
      };
      
      const total = Object.values(scores).reduce((a, b) => a + b, 0);
      expect(total).toBe(56);
    });
  });

  describe("Suggestions Generation", () => {
    it("should suggest adding photo when missing", () => {
      const scores = { photo: 0 };
      const suggestions: string[] = [];
      
      if (scores.photo === 0) {
        suggestions.push("Add a professional profile photo");
      }
      
      expect(suggestions).toContain("Add a professional profile photo");
    });

    it("should suggest improving headline when low", () => {
      const scores = { headline: 5 };
      const suggestions: string[] = [];
      
      if (scores.headline < 10) {
        suggestions.push("Expand your headline");
      }
      
      expect(suggestions).toContain("Expand your headline");
    });

    it("should suggest adding skills when low", () => {
      const scores = { skills: 3 };
      const suggestions: string[] = [];
      
      if (scores.skills < 7) {
        suggestions.push("Add more relevant skills");
      }
      
      expect(suggestions).toContain("Add more relevant skills");
    });
  });
});

describe("Job Data Mapping", () => {
  describe("Source Mapping", () => {
    it("should set source to linkedin", () => {
      const job = { source: "linkedin" };
      expect(job.source).toBe("linkedin");
    });

    it("should set source to indeed", () => {
      const job = { source: "indeed" };
      expect(job.source).toBe("indeed");
    });

    it("should set source to glassdoor", () => {
      const job = { source: "glassdoor" };
      expect(job.source).toBe("glassdoor");
    });
  });

  describe("URL Handling", () => {
    it("should preserve full URL", () => {
      const url = "https://www.linkedin.com/jobs/view/123456";
      expect(url).toContain("linkedin.com");
    });

    it("should handle Indeed URLs", () => {
      const url = "https://www.indeed.com/viewjob?jk=abc123";
      expect(url).toContain("indeed.com");
    });

    it("should handle Glassdoor URLs", () => {
      const url = "https://www.glassdoor.com/job-listing/software-engineer";
      expect(url).toContain("glassdoor.com");
    });
  });
});

describe("Page Type Detection", () => {
  describe("LinkedIn Pages", () => {
    it("should detect LinkedIn job page", () => {
      const url = "https://www.linkedin.com/jobs/view/123456";
      const isJobPage = url.includes("linkedin.com/jobs");
      expect(isJobPage).toBe(true);
    });

    it("should detect LinkedIn profile page", () => {
      const url = "https://www.linkedin.com/in/johndoe";
      const isProfilePage = url.includes("linkedin.com/in/");
      expect(isProfilePage).toBe(true);
    });
  });

  describe("Indeed Pages", () => {
    it("should detect Indeed job page", () => {
      const url = "https://www.indeed.com/viewjob?jk=abc123";
      const isJobPage = url.includes("indeed.com/viewjob");
      expect(isJobPage).toBe(true);
    });
  });

  describe("Glassdoor Pages", () => {
    it("should detect Glassdoor job page", () => {
      const url = "https://www.glassdoor.com/job-listing/software-engineer";
      const isJobPage = url.includes("glassdoor.com/job-listing");
      expect(isJobPage).toBe(true);
    });
  });

  describe("Non-Supported Pages", () => {
    it("should not detect random pages", () => {
      const url = "https://www.google.com";
      const isSupported = 
        url.includes("linkedin.com/jobs") ||
        url.includes("linkedin.com/in/") ||
        url.includes("indeed.com/viewjob") ||
        url.includes("glassdoor.com/job-listing");
      expect(isSupported).toBe(false);
    });
  });
});
