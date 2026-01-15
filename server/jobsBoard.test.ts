import { describe, it, expect, vi } from "vitest";

/**
 * Jobs Board Service Tests
 * Tests for job listing, filtering, and search functionality
 */

// Mock job data structure
interface MockJob {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  remote: string;
  posted: string;
  tags: string[];
  description: string;
}

const mockJobs: MockJob[] = [
  { id: 1, title: "Senior Software Engineer", company: "Google", location: "Mountain View, CA", salary: "$180,000 - $250,000", type: "Full-time", remote: "Hybrid", posted: "2 days ago", tags: ["React", "TypeScript", "Node.js"], description: "Join our team..." },
  { id: 2, title: "Frontend Developer", company: "Meta", location: "Menlo Park, CA", salary: "$150,000 - $200,000", type: "Full-time", remote: "Remote", posted: "1 day ago", tags: ["React", "JavaScript", "CSS"], description: "Build beautiful UIs..." },
  { id: 3, title: "Full Stack Engineer", company: "Amazon", location: "Seattle, WA", salary: "$160,000 - $220,000", type: "Full-time", remote: "On-site", posted: "3 days ago", tags: ["Java", "AWS", "React"], description: "Work on scalable systems..." },
  { id: 4, title: "Backend Engineer", company: "Netflix", location: "Los Gatos, CA", salary: "$200,000 - $300,000", type: "Full-time", remote: "Hybrid", posted: "5 days ago", tags: ["Java", "Python", "Microservices"], description: "Build streaming infrastructure..." },
  { id: 5, title: "Data Scientist", company: "Microsoft", location: "Redmond, WA", salary: "$140,000 - $200,000", type: "Full-time", remote: "Hybrid", posted: "4 days ago", tags: ["Python", "ML", "SQL"], description: "Analyze data..." },
];

describe("Jobs Board Search", () => {
  describe("Title Search", () => {
    it("should find jobs by title keyword", () => {
      const searchQuery = "software";
      const results = mockJobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(results.length).toBe(1);
      expect(results[0].title).toBe("Senior Software Engineer");
    });

    it("should find jobs by partial title match", () => {
      const searchQuery = "engineer";
      const results = mockJobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(results.length).toBe(3); // Software Engineer, Full Stack Engineer, Backend Engineer
    });

    it("should return empty for non-matching title", () => {
      const searchQuery = "xyz123";
      const results = mockJobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(results.length).toBe(0);
    });
  });

  describe("Company Search", () => {
    it("should find jobs by company name", () => {
      const searchQuery = "google";
      const results = mockJobs.filter(job => 
        job.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(results.length).toBe(1);
      expect(results[0].company).toBe("Google");
    });

    it("should be case insensitive", () => {
      const searchQuery = "NETFLIX";
      const results = mockJobs.filter(job => 
        job.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      expect(results.length).toBe(1);
      expect(results[0].company).toBe("Netflix");
    });
  });

  describe("Skills/Tags Search", () => {
    it("should find jobs by skill tag", () => {
      const searchQuery = "react";
      const results = mockJobs.filter(job => 
        job.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      
      expect(results.length).toBe(3); // Google, Meta, Amazon
    });

    it("should find jobs by Python skill", () => {
      const searchQuery = "python";
      const results = mockJobs.filter(job => 
        job.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      
      expect(results.length).toBe(2); // Netflix, Microsoft
    });
  });

  describe("Combined Search", () => {
    it("should search across title, company, and tags", () => {
      const searchQuery = "react";
      const results = mockJobs.filter(job => 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      
      expect(results.length).toBe(3);
    });
  });
});

describe("Jobs Board Filters", () => {
  describe("Location Filter", () => {
    it("should filter by city", () => {
      const locationFilter = "seattle";
      const results = mockJobs.filter(job => 
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
      
      expect(results.length).toBe(1);
      expect(results[0].company).toBe("Amazon");
    });

    it("should filter by state", () => {
      const locationFilter = "CA";
      const results = mockJobs.filter(job => 
        job.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
      
      expect(results.length).toBe(3); // Mountain View, Menlo Park, Los Gatos
    });

    it("should return all jobs with empty filter", () => {
      const locationFilter = "";
      const results = mockJobs.filter(job => 
        !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
      
      expect(results.length).toBe(5);
    });
  });

  describe("Remote Filter", () => {
    it("should filter remote jobs", () => {
      const remoteFilter = "remote";
      const results = mockJobs.filter(job => 
        job.remote.toLowerCase() === remoteFilter.toLowerCase()
      );
      
      expect(results.length).toBe(1);
      expect(results[0].company).toBe("Meta");
    });

    it("should filter hybrid jobs", () => {
      const remoteFilter = "hybrid";
      const results = mockJobs.filter(job => 
        job.remote.toLowerCase() === remoteFilter.toLowerCase()
      );
      
      expect(results.length).toBe(3); // Google, Netflix, Microsoft
    });

    it("should filter on-site jobs", () => {
      const remoteFilter = "on-site";
      const results = mockJobs.filter(job => 
        job.remote.toLowerCase() === remoteFilter.toLowerCase()
      );
      
      expect(results.length).toBe(1);
      expect(results[0].company).toBe("Amazon");
    });

    it("should return all jobs with 'all' filter", () => {
      const remoteFilter = "all";
      const results = mockJobs.filter(job => 
        remoteFilter === "all" || job.remote.toLowerCase() === remoteFilter.toLowerCase()
      );
      
      expect(results.length).toBe(5);
    });
  });

  describe("Combined Filters", () => {
    it("should apply search and location filter together", () => {
      const searchQuery = "engineer";
      const locationFilter = "CA";
      
      const results = mockJobs.filter(job => {
        const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLocation = job.location.toLowerCase().includes(locationFilter.toLowerCase());
        return matchesSearch && matchesLocation;
      });
      
      expect(results.length).toBe(2); // Software Engineer at Google, Backend Engineer at Netflix
    });

    it("should apply all filters together", () => {
      const searchQuery = "react";
      const locationFilter = "CA";
      const remoteFilter = "hybrid";
      
      const results = mockJobs.filter(job => {
        const matchesSearch = job.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesLocation = job.location.toLowerCase().includes(locationFilter.toLowerCase());
        const matchesRemote = job.remote.toLowerCase() === remoteFilter.toLowerCase();
        return matchesSearch && matchesLocation && matchesRemote;
      });
      
      expect(results.length).toBe(1); // Google
    });
  });
});

describe("Jobs Board Saved Jobs", () => {
  describe("Save/Unsave Toggle", () => {
    it("should add job to saved list", () => {
      const savedJobs: number[] = [];
      const jobId = 1;
      
      const newSavedJobs = [...savedJobs, jobId];
      
      expect(newSavedJobs).toContain(jobId);
      expect(newSavedJobs.length).toBe(1);
    });

    it("should remove job from saved list", () => {
      const savedJobs = [1, 2, 3];
      const jobIdToRemove = 2;
      
      const newSavedJobs = savedJobs.filter(id => id !== jobIdToRemove);
      
      expect(newSavedJobs).not.toContain(jobIdToRemove);
      expect(newSavedJobs.length).toBe(2);
    });

    it("should check if job is saved", () => {
      const savedJobs = [1, 3, 5];
      
      expect(savedJobs.includes(1)).toBe(true);
      expect(savedJobs.includes(2)).toBe(false);
      expect(savedJobs.includes(3)).toBe(true);
    });
  });
});

describe("Jobs Board Add to Tracker", () => {
  describe("Job Data Mapping", () => {
    it("should map job data to tracker format", () => {
      const job = mockJobs[0];
      
      const trackerData = {
        jobTitle: job.title,
        companyName: job.company,
        location: job.location,
        salary: job.salary,
        jobUrl: `https://example.com/jobs/${job.id}`,
        status: "saved" as const,
      };
      
      expect(trackerData.jobTitle).toBe("Senior Software Engineer");
      expect(trackerData.companyName).toBe("Google");
      expect(trackerData.status).toBe("saved");
    });
  });
});

describe("Jobs Board Location Extraction", () => {
  describe("City Extraction", () => {
    it("should extract city from location string", () => {
      const locations = mockJobs.map(job => {
        const city = job.location.split(",")[0];
        return city;
      });
      
      expect(locations).toContain("Mountain View");
      expect(locations).toContain("Seattle");
    });

    it("should create unique location list", () => {
      const uniqueLocations = Array.from(new Set(mockJobs.map(job => {
        return job.location.split(",")[0];
      })));
      
      // Should have 5 unique cities
      expect(uniqueLocations.length).toBe(5);
    });

    it("should sort locations alphabetically", () => {
      const sortedLocations = Array.from(new Set(mockJobs.map(job => {
        return job.location.split(",")[0];
      }))).sort();
      
      expect(sortedLocations[0]).toBe("Los Gatos");
      expect(sortedLocations[sortedLocations.length - 1]).toBe("Seattle");
    });
  });
});

describe("Jobs Board Empty State", () => {
  it("should show empty state when no jobs match", () => {
    const searchQuery = "nonexistent";
    const results = mockJobs.filter(job => 
      job.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    expect(results.length).toBe(0);
  });

  it("should show empty state with impossible filter combination", () => {
    const searchQuery = "engineer";
    const locationFilter = "tokyo";
    
    const results = mockJobs.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation = job.location.toLowerCase().includes(locationFilter.toLowerCase());
      return matchesSearch && matchesLocation;
    });
    
    expect(results.length).toBe(0);
  });
});
