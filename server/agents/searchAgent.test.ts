import { describe, it, expect } from "vitest";
import { 
  normalizeCompanyName, 
  normalizePositionName,
  searchGlassdoor,
  searchLeetCode,
  SearchAgent 
} from "./searchAgent";

describe("Search Agent", () => {
  describe("normalizeCompanyName", () => {
    it("should normalize company names to lowercase without special chars", () => {
      expect(normalizeCompanyName("Google")).toBe("google");
      expect(normalizeCompanyName("Meta (Facebook)")).toBe("metafacebook");
      expect(normalizeCompanyName("Amazon.com")).toBe("amazoncom");
    });
  });

  describe("normalizePositionName", () => {
    it("should normalize position names", () => {
      expect(normalizePositionName("Software Engineer")).toBe("software engineer");
      expect(normalizePositionName("Product Manager - L5")).toBe("product manager l5");
    });
  });

  // Integration tests - these actually call the APIs
  // Skip in CI, run manually for verification
  describe.skip("Glassdoor Integration", () => {
    it("should fetch interview data from Glassdoor", async () => {
      const results = await searchGlassdoor("Google", 5);
      console.log("Glassdoor results:", results.length);
      console.log("Sample result:", JSON.stringify(results[0], null, 2));
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 300000); // 5 minute timeout
  });

  describe.skip("LeetCode Integration", () => {
    it("should fetch interview questions from LeetCode", async () => {
      const results = await searchLeetCode("Google", 10);
      console.log("LeetCode results:", results.length);
      console.log("Sample result:", JSON.stringify(results[0], null, 2));
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    }, 300000);
  });

  describe.skip("Full Search Integration", () => {
    it("should search all sources in parallel", async () => {
      const agent = new SearchAgent({
        enableGlassdoor: true,
        enableLeetCode: true,
        enableTavily: true,
        enableIndeed: false,
        maxGlassdoorResults: 5,
        maxLeetCodeResults: 10,
        maxTavilyResults: 5,
      });
      
      const results = await agent.search("Google", "Software Engineer");
      console.log("Total results:", results.length);
      
      // Group by source
      const bySource = results.reduce((acc, r) => {
        acc[r.source] = (acc[r.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log("Results by source:", bySource);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 600000); // 10 minute timeout
  });
});
