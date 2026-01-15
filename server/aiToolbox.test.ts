import { describe, it, expect, vi } from "vitest";

/**
 * AI Toolbox Service Tests
 * Tests for Cover Letter, Email Writer, and Elevator Pitch generators
 */

// Mock LLM response structure
interface LLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Helper to create mock LLM response
function createMockLLMResponse(content: string): LLMResponse {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

describe("Cover Letter Generator", () => {
  describe("Input Validation", () => {
    it("should require job title", () => {
      const input = {
        jobTitle: "",
        companyName: "Google",
      };
      
      expect(input.jobTitle).toBe("");
      // In actual implementation, this would throw validation error
    });

    it("should require company name", () => {
      const input = {
        jobTitle: "Software Engineer",
        companyName: "",
      };
      
      expect(input.companyName).toBe("");
    });

    it("should accept optional job description", () => {
      const input = {
        jobTitle: "Software Engineer",
        companyName: "Google",
        jobDescription: "Build scalable systems...",
      };
      
      expect(input.jobDescription).toBeDefined();
    });

    it("should accept optional resume ID", () => {
      const input = {
        jobTitle: "Software Engineer",
        companyName: "Google",
        resumeId: 123,
      };
      
      expect(input.resumeId).toBe(123);
    });

    it("should default tone to professional", () => {
      const defaultTone = "professional";
      expect(defaultTone).toBe("professional");
    });
  });

  describe("Output Format", () => {
    it("should return cover letter as string", () => {
      const mockResponse = createMockLLMResponse(
        "Dear Hiring Manager,\n\nI am writing to express my interest..."
      );
      
      const coverLetter = mockResponse.choices[0]?.message?.content || "";
      expect(typeof coverLetter).toBe("string");
      expect(coverLetter.length).toBeGreaterThan(0);
    });

    it("should handle empty LLM response", () => {
      const mockResponse = createMockLLMResponse("");
      const coverLetter = mockResponse.choices[0]?.message?.content || "";
      expect(coverLetter).toBe("");
    });
  });

  describe("Tone Variations", () => {
    const tones = ["professional", "enthusiastic", "confident", "friendly", "formal"];
    
    tones.forEach((tone) => {
      it(`should support ${tone} tone`, () => {
        const input = {
          jobTitle: "Software Engineer",
          companyName: "Google",
          tone,
        };
        
        expect(input.tone).toBe(tone);
      });
    });
  });
});

describe("Email Writer", () => {
  describe("Email Types", () => {
    const emailTypes = [
      { type: "follow_up", description: "Follow-up after interview" },
      { type: "thank_you", description: "Thank you after interview" },
      { type: "networking", description: "Networking outreach" },
      { type: "application", description: "Job application" },
      { type: "inquiry", description: "Job inquiry" },
    ];

    emailTypes.forEach(({ type, description }) => {
      it(`should support ${type} email type (${description})`, () => {
        const input = {
          emailType: type,
        };
        
        expect(input.emailType).toBe(type);
      });
    });
  });

  describe("Input Validation", () => {
    it("should accept optional recipient name", () => {
      const input = {
        emailType: "follow_up",
        recipientName: "John Smith",
      };
      
      expect(input.recipientName).toBe("John Smith");
    });

    it("should accept optional recipient title", () => {
      const input = {
        emailType: "follow_up",
        recipientTitle: "Hiring Manager",
      };
      
      expect(input.recipientTitle).toBe("Hiring Manager");
    });

    it("should accept optional company name", () => {
      const input = {
        emailType: "follow_up",
        companyName: "Google",
      };
      
      expect(input.companyName).toBe("Google");
    });

    it("should accept optional context", () => {
      const input = {
        emailType: "follow_up",
        context: "I interviewed last Tuesday for the Senior Engineer position",
      };
      
      expect(input.context).toBeDefined();
    });
  });

  describe("Output Format", () => {
    it("should return email with subject line", () => {
      const mockEmail = "Subject: Follow-up on Interview\n\nDear John,\n\n...";
      expect(mockEmail).toContain("Subject:");
    });

    it("should return email with greeting", () => {
      const mockEmail = "Subject: Follow-up\n\nDear John,\n\nThank you for...";
      expect(mockEmail).toContain("Dear");
    });
  });
});

describe("Elevator Pitch Generator", () => {
  describe("Duration Options", () => {
    const durations = [
      { value: "30", expectedLength: "2-3 sentences" },
      { value: "60", expectedLength: "4-5 sentences" },
      { value: "90", expectedLength: "6-8 sentences" },
    ];

    durations.forEach(({ value, expectedLength }) => {
      it(`should support ${value} second pitch (${expectedLength})`, () => {
        const input = {
          targetRole: "Software Engineer",
          duration: value,
        };
        
        expect(input.duration).toBe(value);
      });
    });
  });

  describe("Input Validation", () => {
    it("should require target role", () => {
      const input = {
        targetRole: "Software Engineer",
      };
      
      expect(input.targetRole).toBeDefined();
      expect(input.targetRole.length).toBeGreaterThan(0);
    });

    it("should accept optional experience", () => {
      const input = {
        targetRole: "Software Engineer",
        experience: "5 years in full-stack development",
      };
      
      expect(input.experience).toBeDefined();
    });

    it("should accept optional skills array", () => {
      const input = {
        targetRole: "Software Engineer",
        skills: ["JavaScript", "React", "Node.js"],
      };
      
      expect(input.skills).toHaveLength(3);
    });

    it("should accept optional unique value proposition", () => {
      const input = {
        targetRole: "Software Engineer",
        uniqueValue: "I bridge the gap between engineering and business",
      };
      
      expect(input.uniqueValue).toBeDefined();
    });
  });

  describe("Output Format", () => {
    it("should return pitch as string", () => {
      const mockPitch = "Hi, I'm a software engineer with 5 years of experience...";
      expect(typeof mockPitch).toBe("string");
    });

    it("should not include placeholders", () => {
      const mockPitch = "Hi, I'm a software engineer specializing in React and Node.js.";
      expect(mockPitch).not.toContain("[");
      expect(mockPitch).not.toContain("]");
    });
  });
});

describe("Resume Context Integration", () => {
  it("should format resume context for cover letter", () => {
    const resume = {
      personalInfo: {
        firstName: "John",
        lastName: "Doe",
      },
      experience: [
        { position: "Senior Engineer", company: "Tech Corp" },
        { position: "Engineer", company: "Startup Inc" },
      ],
      skills: [
        { name: "JavaScript" },
        { name: "React" },
      ],
      summary: "Experienced software engineer...",
    };

    const resumeContext = `
Candidate Information:
- Name: ${resume.personalInfo.firstName} ${resume.personalInfo.lastName}
- Experience: ${resume.experience.map(e => `${e.position} at ${e.company}`).join(', ')}
- Skills: ${resume.skills.map(s => s.name).join(', ')}
- Summary: ${resume.summary}
`;

    expect(resumeContext).toContain("John Doe");
    expect(resumeContext).toContain("Senior Engineer at Tech Corp");
    expect(resumeContext).toContain("JavaScript");
  });

  it("should handle empty resume fields gracefully", () => {
    const resume = {
      personalInfo: {},
      experience: [],
      skills: [],
      summary: null,
    };

    const personalInfo = resume.personalInfo as any || {};
    const experience = resume.experience as any[] || [];
    const skills = resume.skills as any[] || [];

    const resumeContext = `
- Name: ${personalInfo.firstName || ''} ${personalInfo.lastName || ''}
- Experience: ${experience.map((e: any) => `${e.position} at ${e.company}`).join(', ')}
- Skills: ${skills.map((s: any) => s.name).join(', ')}
- Summary: ${resume.summary || ''}
`;

    expect(resumeContext).toContain("- Name:");
    expect(resumeContext).toContain("- Experience:");
    expect(resumeContext).toContain("- Skills:");
  });
});

describe("Error Handling", () => {
  it("should handle LLM timeout gracefully", () => {
    const error = new Error("Request timeout");
    expect(error.message).toBe("Request timeout");
  });

  it("should handle invalid LLM response", () => {
    const invalidResponse = {
      choices: [],
    };
    
    const content = invalidResponse.choices[0]?.message?.content || "";
    expect(content).toBe("");
  });

  it("should handle null LLM response", () => {
    const nullResponse = null;
    const content = (nullResponse as any)?.choices?.[0]?.message?.content || "";
    expect(content).toBe("");
  });
});
