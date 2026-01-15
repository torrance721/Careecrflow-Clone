import { describe, it, expect } from "vitest";
import { parseJobInput, normalizeCompanyName, normalizePositionName } from "./jobInputParser";

describe("Job Input Parser", () => {
  describe("normalizeCompanyName", () => {
    it("should normalize Chinese company names", () => {
      expect(normalizeCompanyName("字节跳动")).toBe("ByteDance");
      expect(normalizeCompanyName("谷歌")).toBe("Google");
      expect(normalizeCompanyName("腾讯")).toBe("Tencent");
      expect(normalizeCompanyName("阿里巴巴")).toBe("Alibaba");
    });

    it("should normalize English company names case-insensitively", () => {
      expect(normalizeCompanyName("google")).toBe("Google");
      expect(normalizeCompanyName("GOOGLE")).toBe("Google");
      expect(normalizeCompanyName("meta")).toBe("Meta");
      expect(normalizeCompanyName("facebook")).toBe("Meta");
    });

    it("should return null for null input", () => {
      expect(normalizeCompanyName(null)).toBeNull();
    });

    it("should return original name for unknown companies", () => {
      expect(normalizeCompanyName("Acme Corp")).toBe("Acme Corp");
    });
  });

  describe("normalizePositionName", () => {
    it("should normalize position abbreviations", () => {
      expect(normalizePositionName("PM")).toBe("Product Manager");
      expect(normalizePositionName("SWE")).toBe("Software Engineer");
      expect(normalizePositionName("SDE")).toBe("Software Engineer");
    });

    it("should normalize Chinese position names", () => {
      expect(normalizePositionName("产品经理")).toBe("Product Manager");
      expect(normalizePositionName("软件工程师")).toBe("Software Engineer");
      expect(normalizePositionName("前端")).toBe("Frontend Engineer");
      expect(normalizePositionName("后端")).toBe("Backend Engineer");
    });

    it("should return original name for unknown positions", () => {
      expect(normalizePositionName("Chief Happiness Officer")).toBe("Chief Happiness Officer");
    });
  });

  describe("parseJobInput", () => {
    it("should parse 'Position at Company' format", async () => {
      const result = await parseJobInput("Product Manager at Meta");
      expect(result.company).toBe("Meta");
      expect(result.position).toContain("Product Manager");
      expect(result.confidence).toBeGreaterThan(0.5);
    }, 30000);

    it("should parse 'Company Position' format", async () => {
      const result = await parseJobInput("Google SWE");
      expect(result.company).toBe("Google");
      // LLM may return "SWE" or "Software Engineer"
      expect(["SWE", "Software Engineer"]).toContain(result.position);
    }, 30000);

    it("should parse Chinese input", async () => {
      const result = await parseJobInput("字节跳动后端");
      // LLM should recognize ByteDance or return the original
      expect(result.company === "ByteDance" || result.companyOriginal === "字节跳动" || result.company === null).toBe(true);
      // Position should contain backend-related term
      expect(result.position.toLowerCase()).toMatch(/backend|后端|engineer/);
    }, 30000);

    it("should handle position-only input", async () => {
      const result = await parseJobInput("Software Engineer");
      expect(result.company).toBeNull();
      expect(result.position).toContain("Software Engineer");
    }, 30000);

    it("should handle empty input", async () => {
      const result = await parseJobInput("");
      expect(result.position).toBe("Software Engineer");
      expect(result.confidence).toBe(0);
    });
  });
});
