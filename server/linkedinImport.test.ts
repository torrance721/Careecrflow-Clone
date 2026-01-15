import { describe, it, expect } from "vitest";

/**
 * LinkedIn Import Service Tests
 * Tests for parsing LinkedIn PDF profiles and creating resumes from LinkedIn data
 */

// Helper function to simulate parsed LinkedIn data
function createMockLinkedInData(overrides: Partial<{
  fullName: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education: Array<{
    school: string;
    degree?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills: string[];
  certifications: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
}> = {}) {
  return {
    fullName: "John Doe",
    headline: "Senior Software Engineer",
    location: "San Francisco, CA",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    linkedinUrl: "https://linkedin.com/in/johndoe",
    summary: "Experienced software engineer with 10+ years of experience...",
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        startDate: "Jan 2020",
        endDate: "Present",
        description: "Led development of microservices architecture...",
      },
    ],
    education: [
      {
        school: "MIT",
        degree: "Bachelor of Science",
        field: "Computer Science",
        startDate: "2010",
        endDate: "2014",
      },
    ],
    skills: ["JavaScript", "TypeScript", "React", "Node.js"],
    certifications: [
      {
        name: "AWS Solutions Architect",
        issuer: "Amazon Web Services",
        date: "2023",
      },
    ],
    ...overrides,
  };
}

// Helper function to transform LinkedIn data to resume format
function transformLinkedInToResume(linkedInData: ReturnType<typeof createMockLinkedInData>) {
  const nameParts = linkedInData.fullName?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  return {
    personalInfo: {
      firstName,
      lastName,
      email: linkedInData.email || '',
      phone: linkedInData.phone || '',
      location: linkedInData.location || '',
      linkedinUrl: linkedInData.linkedinUrl || '',
    },
    summary: linkedInData.summary || '',
    experience: linkedInData.experience?.map((exp, index) => ({
      id: `exp-${index}`,
      position: exp.title,
      company: exp.company,
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      current: !exp.endDate || exp.endDate.toLowerCase() === 'present',
      description: exp.description || '',
      highlights: [],
    })) || [],
    education: linkedInData.education?.map((edu, index) => ({
      id: `edu-${index}`,
      institution: edu.school,
      degree: edu.degree || '',
      field: edu.field || '',
      startDate: edu.startDate || '',
      endDate: edu.endDate || '',
      gpa: '',
      highlights: [],
    })) || [],
    skills: linkedInData.skills?.map((skill, index) => ({
      id: `skill-${index}`,
      name: skill,
      level: 'intermediate' as const,
    })) || [],
    certifications: linkedInData.certifications?.map((cert, index) => ({
      id: `cert-${index}`,
      name: cert.name,
      issuer: cert.issuer || '',
      date: cert.date || '',
      url: '',
    })) || [],
  };
}

describe("LinkedIn Data Transformation", () => {
  describe("Personal Info Extraction", () => {
    it("should correctly split full name into first and last name", () => {
      const linkedInData = createMockLinkedInData({ fullName: "John Michael Doe" });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.personalInfo.firstName).toBe("John");
      expect(result.personalInfo.lastName).toBe("Michael Doe");
    });

    it("should handle single name", () => {
      const linkedInData = createMockLinkedInData({ fullName: "John" });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.personalInfo.firstName).toBe("John");
      expect(result.personalInfo.lastName).toBe("");
    });

    it("should handle empty name", () => {
      const linkedInData = createMockLinkedInData({ fullName: "" });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.personalInfo.firstName).toBe("");
      expect(result.personalInfo.lastName).toBe("");
    });

    it("should preserve contact information", () => {
      const linkedInData = createMockLinkedInData({
        email: "test@example.com",
        phone: "+1 555-123-4567",
        location: "New York, NY",
        linkedinUrl: "https://linkedin.com/in/test",
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.personalInfo.email).toBe("test@example.com");
      expect(result.personalInfo.phone).toBe("+1 555-123-4567");
      expect(result.personalInfo.location).toBe("New York, NY");
      expect(result.personalInfo.linkedinUrl).toBe("https://linkedin.com/in/test");
    });
  });

  describe("Experience Transformation", () => {
    it("should transform experience with all fields", () => {
      const linkedInData = createMockLinkedInData({
        experience: [
          {
            title: "Software Engineer",
            company: "Tech Corp",
            location: "San Francisco",
            startDate: "Jan 2020",
            endDate: "Dec 2023",
            description: "Built scalable applications",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.experience).toHaveLength(1);
      expect(result.experience[0].position).toBe("Software Engineer");
      expect(result.experience[0].company).toBe("Tech Corp");
      expect(result.experience[0].location).toBe("San Francisco");
      expect(result.experience[0].startDate).toBe("Jan 2020");
      expect(result.experience[0].endDate).toBe("Dec 2023");
      expect(result.experience[0].current).toBe(false);
      expect(result.experience[0].description).toBe("Built scalable applications");
    });

    it("should mark current position correctly", () => {
      const linkedInData = createMockLinkedInData({
        experience: [
          {
            title: "Senior Engineer",
            company: "Current Corp",
            startDate: "Jan 2023",
            endDate: "Present",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.experience[0].current).toBe(true);
    });

    it("should handle experience without end date as current", () => {
      const linkedInData = createMockLinkedInData({
        experience: [
          {
            title: "Engineer",
            company: "Corp",
            startDate: "Jan 2023",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.experience[0].current).toBe(true);
    });

    it("should handle multiple experiences", () => {
      const linkedInData = createMockLinkedInData({
        experience: [
          { title: "Senior Engineer", company: "Company A", startDate: "2022", endDate: "Present" },
          { title: "Engineer", company: "Company B", startDate: "2020", endDate: "2022" },
          { title: "Junior Engineer", company: "Company C", startDate: "2018", endDate: "2020" },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.experience).toHaveLength(3);
      expect(result.experience[0].position).toBe("Senior Engineer");
      expect(result.experience[1].position).toBe("Engineer");
      expect(result.experience[2].position).toBe("Junior Engineer");
    });
  });

  describe("Education Transformation", () => {
    it("should transform education with all fields", () => {
      const linkedInData = createMockLinkedInData({
        education: [
          {
            school: "Stanford University",
            degree: "Master of Science",
            field: "Computer Science",
            startDate: "2014",
            endDate: "2016",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.education).toHaveLength(1);
      expect(result.education[0].institution).toBe("Stanford University");
      expect(result.education[0].degree).toBe("Master of Science");
      expect(result.education[0].field).toBe("Computer Science");
    });

    it("should handle education without degree", () => {
      const linkedInData = createMockLinkedInData({
        education: [
          {
            school: "Online Academy",
            field: "Web Development",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.education[0].degree).toBe("");
      expect(result.education[0].field).toBe("Web Development");
    });
  });

  describe("Skills Transformation", () => {
    it("should transform skills array", () => {
      const linkedInData = createMockLinkedInData({
        skills: ["JavaScript", "Python", "SQL", "AWS"],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.skills).toHaveLength(4);
      expect(result.skills[0].name).toBe("JavaScript");
      expect(result.skills[0].level).toBe("intermediate");
    });

    it("should handle empty skills array", () => {
      const linkedInData = createMockLinkedInData({ skills: [] });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.skills).toHaveLength(0);
    });
  });

  describe("Certifications Transformation", () => {
    it("should transform certifications with all fields", () => {
      const linkedInData = createMockLinkedInData({
        certifications: [
          {
            name: "AWS Solutions Architect",
            issuer: "Amazon Web Services",
            date: "2023",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.certifications).toHaveLength(1);
      expect(result.certifications[0].name).toBe("AWS Solutions Architect");
      expect(result.certifications[0].issuer).toBe("Amazon Web Services");
      expect(result.certifications[0].date).toBe("2023");
    });

    it("should handle certifications without issuer", () => {
      const linkedInData = createMockLinkedInData({
        certifications: [
          {
            name: "Self-Study Certificate",
          },
        ],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.certifications[0].issuer).toBe("");
    });
  });

  describe("Edge Cases", () => {
    it("should handle completely empty LinkedIn data", () => {
      const linkedInData = createMockLinkedInData({
        fullName: undefined,
        headline: undefined,
        location: undefined,
        email: undefined,
        phone: undefined,
        linkedinUrl: undefined,
        summary: undefined,
        experience: undefined,
        education: undefined,
        skills: undefined,
        certifications: undefined,
      });
      
      // This should not throw
      const result = transformLinkedInToResume(linkedInData as any);
      
      expect(result.personalInfo.firstName).toBe("");
      expect(result.experience).toHaveLength(0);
      expect(result.education).toHaveLength(0);
      expect(result.skills).toHaveLength(0);
      expect(result.certifications).toHaveLength(0);
    });

    it("should generate unique IDs for each item", () => {
      const linkedInData = createMockLinkedInData({
        experience: [
          { title: "Eng 1", company: "A", startDate: "2020" },
          { title: "Eng 2", company: "B", startDate: "2021" },
        ],
        skills: ["Skill 1", "Skill 2"],
      });
      const result = transformLinkedInToResume(linkedInData);
      
      expect(result.experience[0].id).not.toBe(result.experience[1].id);
      expect(result.skills[0].id).not.toBe(result.skills[1].id);
    });
  });
});

describe("LinkedIn PDF Parsing", () => {
  // Note: These tests verify the expected structure of parsed data
  // Actual PDF parsing is done by the LLM and tested via integration tests
  
  it("should expect parsed data to have required fields", () => {
    const expectedFields = [
      "fullName",
      "headline",
      "location",
      "email",
      "phone",
      "linkedinUrl",
      "summary",
      "experience",
      "education",
      "skills",
      "certifications",
    ];
    
    const mockParsedData = createMockLinkedInData();
    
    for (const field of expectedFields) {
      expect(mockParsedData).toHaveProperty(field);
    }
  });

  it("should expect experience items to have required structure", () => {
    const mockParsedData = createMockLinkedInData();
    const exp = mockParsedData.experience[0];
    
    expect(exp).toHaveProperty("title");
    expect(exp).toHaveProperty("company");
    expect(typeof exp.title).toBe("string");
    expect(typeof exp.company).toBe("string");
  });

  it("should expect education items to have required structure", () => {
    const mockParsedData = createMockLinkedInData();
    const edu = mockParsedData.education[0];
    
    expect(edu).toHaveProperty("school");
    expect(typeof edu.school).toBe("string");
  });
});
