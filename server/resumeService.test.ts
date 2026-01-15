/**
 * Resume Service Unit Tests
 * 
 * Tests for:
 * - Score calculation with detailed breakdown
 * - Resume duplication
 * - PDF generation
 */

import { describe, it, expect } from "vitest";
import { calculateResumeScore, prepareResumeDuplicate } from "./resumeService";
import type { Resume } from "../drizzle/schema";

// Mock resume data for testing
const createMockResume = (overrides: Partial<Resume> = {}): Resume => ({
  id: 1,
  userId: 1,
  title: "Test Resume",
  type: "base",
  isDefault: 0,
  score: 0,
  targetJobId: null,
  targetJobTitle: null,
  targetCompany: null,
  personalInfo: null,
  summary: null,
  experience: null,
  education: null,
  skills: null,
  projects: null,
  certifications: null,
  awards: null,
  publications: null,
  volunteering: null,
  templateId: "default",
  colorScheme: "professional",
  fontSize: "medium",
  sectionVisibility: null,
  pdfUrl: null,
  pdfGeneratedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("calculateResumeScore", () => {
  it("should return 0 for empty resume", () => {
    const resume = createMockResume();
    const result = calculateResumeScore(resume);
    
    expect(result.totalScore).toBe(0);
    expect(result.priority).toBe("high");
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it("should score contact information correctly", () => {
    const resume = createMockResume({
      personalInfo: {
        fullName: "John Doe",
        email: "john@example.com",
        phone: "123-456-7890",
        location: "San Francisco, CA",
        linkedinUrl: "https://linkedin.com/in/johndoe",
      } as any,
    });
    
    const result = calculateResumeScore(resume);
    const contactBreakdown = result.breakdown.find(b => b.category === "Contact Information");
    
    expect(contactBreakdown).toBeDefined();
    expect(contactBreakdown!.score).toBe(10); // Full score
    expect(contactBreakdown!.suggestions.length).toBe(0);
  });

  it("should score summary correctly", () => {
    const resume = createMockResume({
      summary: "Experienced software engineer with 5+ years of experience. Led teams of 10+ developers and delivered projects that improved efficiency by 40%.",
    });
    
    const result = calculateResumeScore(resume);
    const summaryBreakdown = result.breakdown.find(b => b.category === "Professional Summary");
    
    expect(summaryBreakdown).toBeDefined();
    expect(summaryBreakdown!.score).toBeGreaterThan(10); // Has action words and numbers
  });

  it("should score experience correctly", () => {
    const resume = createMockResume({
      experience: [
        {
          id: "1",
          company: "Tech Corp",
          position: "Senior Developer",
          startDate: "2020-01",
          endDate: "2023-01",
          current: false,
          description: "Led development of key features, improving performance by 50%. Managed team of 5 engineers.",
          highlights: ["Increased revenue by $1M", "Reduced bugs by 30%"],
        },
        {
          id: "2",
          company: "Startup Inc",
          position: "Developer",
          startDate: "2018-01",
          endDate: "2020-01",
          current: false,
          description: "Built core product features from scratch.",
        },
      ] as any,
    });
    
    const result = calculateResumeScore(resume);
    const expBreakdown = result.breakdown.find(b => b.category === "Work Experience");
    
    expect(expBreakdown).toBeDefined();
    expect(expBreakdown!.score).toBeGreaterThan(20); // Has multiple experiences with details
  });

  it("should score education correctly", () => {
    const resume = createMockResume({
      education: [
        {
          id: "1",
          school: "MIT",
          degree: "Bachelor of Science",
          field: "Computer Science",
          startDate: "2014-09",
          endDate: "2018-05",
          gpa: "3.8",
        },
      ] as any,
    });
    
    const result = calculateResumeScore(resume);
    const eduBreakdown = result.breakdown.find(b => b.category === "Education");
    
    expect(eduBreakdown).toBeDefined();
    expect(eduBreakdown!.score).toBe(15); // Full score with GPA
  });

  it("should score skills correctly", () => {
    const resume = createMockResume({
      skills: [
        { id: "1", name: "JavaScript", category: "Technical" },
        { id: "2", name: "TypeScript", category: "Technical" },
        { id: "3", name: "React", category: "Technical" },
        { id: "4", name: "Node.js", category: "Technical" },
        { id: "5", name: "Python", category: "Technical" },
        { id: "6", name: "SQL", category: "Technical" },
        { id: "7", name: "Leadership", category: "Soft Skills" },
        { id: "8", name: "Communication", category: "Soft Skills" },
        { id: "9", name: "Problem Solving", category: "Soft Skills" },
        { id: "10", name: "Teamwork", category: "Soft Skills" },
      ] as any,
    });
    
    const result = calculateResumeScore(resume);
    const skillBreakdown = result.breakdown.find(b => b.category === "Skills");
    
    expect(skillBreakdown).toBeDefined();
    expect(skillBreakdown!.score).toBe(15); // Full score with 10+ categorized skills
  });

  it("should calculate high score for complete resume", () => {
    const resume = createMockResume({
      personalInfo: {
        fullName: "John Doe",
        email: "john@example.com",
        phone: "123-456-7890",
        location: "San Francisco, CA",
        linkedinUrl: "https://linkedin.com/in/johndoe",
      } as any,
      summary: "Experienced software engineer with 5+ years of experience. Led teams of 10+ developers and delivered projects that improved efficiency by 40%. Passionate about building scalable systems.",
      experience: [
        {
          id: "1",
          company: "Tech Corp",
          position: "Senior Developer",
          startDate: "2020-01",
          current: true,
          description: "Led development of key features, improving performance by 50%. Managed team of 5 engineers.",
          highlights: ["Increased revenue by $1M"],
        },
        {
          id: "2",
          company: "Startup Inc",
          position: "Developer",
          startDate: "2018-01",
          endDate: "2020-01",
          current: false,
          description: "Built core product features from scratch, serving 100k+ users.",
        },
        {
          id: "3",
          company: "Agency",
          position: "Junior Developer",
          startDate: "2016-01",
          endDate: "2018-01",
          current: false,
          description: "Developed client websites and applications.",
        },
      ] as any,
      education: [
        {
          id: "1",
          school: "MIT",
          degree: "Bachelor of Science",
          field: "Computer Science",
          startDate: "2014-09",
          endDate: "2018-05",
          gpa: "3.8",
        },
      ] as any,
      skills: [
        { id: "1", name: "JavaScript", category: "Technical" },
        { id: "2", name: "TypeScript", category: "Technical" },
        { id: "3", name: "React", category: "Technical" },
        { id: "4", name: "Node.js", category: "Technical" },
        { id: "5", name: "Python", category: "Technical" },
        { id: "6", name: "SQL", category: "Technical" },
        { id: "7", name: "Leadership", category: "Soft Skills" },
        { id: "8", name: "Communication", category: "Soft Skills" },
        { id: "9", name: "Problem Solving", category: "Soft Skills" },
        { id: "10", name: "Teamwork", category: "Soft Skills" },
      ] as any,
      projects: [
        {
          id: "1",
          name: "Open Source Project",
          description: "Built a popular open source tool",
          technologies: ["React", "Node.js"],
        },
        {
          id: "2",
          name: "Personal Website",
          description: "Portfolio website",
          technologies: ["Next.js"],
        },
      ] as any,
      certifications: [
        {
          id: "1",
          name: "AWS Solutions Architect",
          issuer: "Amazon",
          date: "2022-01",
        },
      ] as any,
      awards: [
        {
          id: "1",
          title: "Employee of the Year",
          issuer: "Tech Corp",
          date: "2022",
        },
      ] as any,
    });
    
    const result = calculateResumeScore(resume);
    
    expect(result.totalScore).toBeGreaterThan(80);
    expect(result.priority).toBe("low");
    expect(result.overallFeedback).toContain("Excellent");
  });

  it("should provide appropriate feedback for medium score", () => {
    const resume = createMockResume({
      personalInfo: {
        fullName: "John Doe",
        email: "john@example.com",
        phone: "123-456-7890",
        location: "San Francisco",
      } as any,
      summary: "Experienced software engineer with 5+ years of experience building scalable applications. Led development teams and delivered high-impact projects.",
      experience: [
        {
          id: "1",
          company: "Tech Corp",
          position: "Developer",
          startDate: "2020-01",
          current: true,
          description: "Worked on various projects and improved system performance by 30%.",
        },
        {
          id: "2",
          company: "Startup Inc",
          position: "Junior Developer",
          startDate: "2018-01",
          endDate: "2020-01",
          current: false,
          description: "Built features for the core product.",
        },
      ] as any,
      education: [
        {
          id: "1",
          school: "State University",
          degree: "Bachelor of Science",
          field: "Computer Science",
          startDate: "2014-09",
          endDate: "2018-05",
        },
      ] as any,
      skills: [
        { id: "1", name: "JavaScript", category: "Technical" },
        { id: "2", name: "React", category: "Technical" },
        { id: "3", name: "Node.js", category: "Technical" },
        { id: "4", name: "SQL", category: "Technical" },
        { id: "5", name: "Git", category: "Technical" },
      ] as any,
    });
    
    const result = calculateResumeScore(resume);
    
    expect(result.totalScore).toBeGreaterThan(50);
    expect(result.totalScore).toBeLessThan(80);
    expect(result.priority).toBe("medium");
  });
});

describe("prepareResumeDuplicate", () => {
  it("should create duplicate data with default title", () => {
    const resume = createMockResume({
      title: "My Resume",
      summary: "Test summary",
      personalInfo: { fullName: "John Doe" } as any,
    });
    
    const duplicateData = prepareResumeDuplicate(resume);
    
    expect(duplicateData.title).toBe("My Resume (Copy)");
    expect(duplicateData.summary).toBe("Test summary");
    expect(duplicateData.personalInfo).toEqual({ fullName: "John Doe" });
  });

  it("should create duplicate data with custom title", () => {
    const resume = createMockResume({
      title: "My Resume",
    });
    
    const duplicateData = prepareResumeDuplicate(resume, "Custom Title");
    
    expect(duplicateData.title).toBe("Custom Title");
  });

  it("should preserve all resume fields", () => {
    const resume = createMockResume({
      title: "Full Resume",
      type: "tailored",
      personalInfo: { fullName: "John" } as any,
      summary: "Summary text",
      experience: [{ id: "1", company: "Corp" }] as any,
      education: [{ id: "1", school: "MIT" }] as any,
      skills: [{ id: "1", name: "JS" }] as any,
      projects: [{ id: "1", name: "Project" }] as any,
      certifications: [{ id: "1", name: "Cert" }] as any,
      awards: [{ id: "1", title: "Award" }] as any,
      publications: [{ id: "1", title: "Pub" }] as any,
      volunteering: [{ id: "1", organization: "Org" }] as any,
      templateId: "modern",
      colorScheme: "blue",
      fontSize: "large",
      sectionVisibility: { summary: true, experience: true } as any,
    });
    
    const duplicateData = prepareResumeDuplicate(resume);
    
    expect(duplicateData.type).toBe("tailored");
    expect(duplicateData.personalInfo).toEqual({ fullName: "John" });
    expect(duplicateData.summary).toBe("Summary text");
    expect(duplicateData.experience).toEqual([{ id: "1", company: "Corp" }]);
    expect(duplicateData.education).toEqual([{ id: "1", school: "MIT" }]);
    expect(duplicateData.skills).toEqual([{ id: "1", name: "JS" }]);
    expect(duplicateData.projects).toEqual([{ id: "1", name: "Project" }]);
    expect(duplicateData.certifications).toEqual([{ id: "1", name: "Cert" }]);
    expect(duplicateData.awards).toEqual([{ id: "1", title: "Award" }]);
    expect(duplicateData.publications).toEqual([{ id: "1", title: "Pub" }]);
    expect(duplicateData.volunteering).toEqual([{ id: "1", organization: "Org" }]);
    expect(duplicateData.templateId).toBe("modern");
    expect(duplicateData.colorScheme).toBe("blue");
    expect(duplicateData.fontSize).toBe("large");
    expect(duplicateData.sectionVisibility).toEqual({ summary: true, experience: true });
  });
});
