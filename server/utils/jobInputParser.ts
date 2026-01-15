/**
 * Job Input Parser
 * 
 * Uses LLM to extract company and position from user's natural language input.
 * Supports various formats:
 * - "Product Manager at Meta"
 * - "Google SWE"
 * - "字节跳动后端"
 * - "我想去 Amazon 做数据分析"
 * - "Software Engineer"
 */

import { invokeLLM } from "../_core/llm";

export interface ParsedJobInput {
  company: string | null;           // Standardized company name (English)
  companyOriginal: string | null;   // Original company name from input
  position: string;                 // Standardized position name (English)
  positionOriginal: string;         // Original position name from input
  level: string | null;             // Level if mentioned (L4, Senior, etc.)
  location: string | null;          // Location if mentioned
  confidence: number;               // 0-1, how confident the parsing is
}

const JOB_INPUT_PARSER_PROMPT = `You are a job input parser. Extract structured information from the user's career goal input.

## Input
"{{input}}"

## Task
Extract the following information:
1. **company**: The company name (standardize to English, e.g., "字节跳动" → "ByteDance", "谷歌" → "Google")
2. **companyOriginal**: The original company name as mentioned in input
3. **position**: The job position (standardize to English, e.g., "产品经理" → "Product Manager", "后端" → "Backend Engineer")
4. **positionOriginal**: The original position name as mentioned in input
5. **level**: Job level if mentioned (e.g., "L4", "Senior", "Junior", "Intern")
6. **location**: Location if mentioned
7. **confidence**: How confident you are in the parsing (0-1)

## Rules
- If no company is mentioned, set company and companyOriginal to null
- If the input is just a company name without position, infer a general position like "Software Engineer"
- If the input is vague (e.g., "大厂", "startup"), set company to null
- Common company aliases:
  - 字节/字节跳动/ByteDance/TikTok → "ByteDance"
  - 谷歌/Google → "Google"
  - 脸书/Facebook/Meta → "Meta"
  - 亚马逊/Amazon → "Amazon"
  - 微软/Microsoft → "Microsoft"
  - 苹果/Apple → "Apple"
  - 阿里/阿里巴巴/Alibaba → "Alibaba"
  - 腾讯/Tencent → "Tencent"
- Common position aliases:
  - PM/产品经理/Product Manager → "Product Manager"
  - SWE/SDE/软件工程师/码农 → "Software Engineer"
  - 前端/Frontend → "Frontend Engineer"
  - 后端/Backend → "Backend Engineer"
  - 数据分析/Data Analyst → "Data Analyst"
  - 数据科学/Data Scientist → "Data Scientist"
  - 算法/ML/机器学习 → "Machine Learning Engineer"

## Output
Return ONLY a valid JSON object, no markdown code blocks:
{
  "company": "Google",
  "companyOriginal": "谷歌",
  "position": "Software Engineer",
  "positionOriginal": "软件工程师",
  "level": "L4",
  "location": null,
  "confidence": 0.95
}`;

export async function parseJobInput(input: string): Promise<ParsedJobInput> {
  if (!input || input.trim().length === 0) {
    return {
      company: null,
      companyOriginal: null,
      position: "Software Engineer",
      positionOriginal: input,
      level: null,
      location: null,
      confidence: 0,
    };
  }

  try {
    const prompt = JOB_INPUT_PARSER_PROMPT.replace("{{input}}", input.trim());
    
    const response = await invokeLLM({
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "parsed_job_input",
          strict: true,
          schema: {
            type: "object",
            properties: {
              company: { type: ["string", "null"], description: "Standardized company name" },
              companyOriginal: { type: ["string", "null"], description: "Original company name" },
              position: { type: "string", description: "Standardized position name" },
              positionOriginal: { type: "string", description: "Original position name" },
              level: { type: ["string", "null"], description: "Job level" },
              location: { type: ["string", "null"], description: "Location" },
              confidence: { type: "number", description: "Confidence score 0-1" },
            },
            required: ["company", "companyOriginal", "position", "positionOriginal", "level", "location", "confidence"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr) as ParsedJobInput;
    
    // Ensure position is never empty
    if (!parsed.position || parsed.position.trim() === "") {
      parsed.position = "Software Engineer";
    }
    
    return parsed;
  } catch (error) {
    console.error("Error parsing job input:", error);
    
    // Fallback: try simple regex patterns
    return fallbackParse(input);
  }
}

/**
 * Fallback parser using simple patterns when LLM fails
 */
function fallbackParse(input: string): ParsedJobInput {
  const trimmed = input.trim();
  
  // Pattern: "X at Y" or "X @ Y"
  const atPattern = /^(.+?)\s+(?:at|@)\s+(.+)$/i;
  const atMatch = trimmed.match(atPattern);
  if (atMatch) {
    return {
      company: atMatch[2].trim(),
      companyOriginal: atMatch[2].trim(),
      position: atMatch[1].trim(),
      positionOriginal: atMatch[1].trim(),
      level: null,
      location: null,
      confidence: 0.7,
    };
  }
  
  // Pattern: "Y的X" (Chinese)
  const chinesePattern = /^(.+?)的(.+)$/;
  const chineseMatch = trimmed.match(chinesePattern);
  if (chineseMatch) {
    return {
      company: chineseMatch[1].trim(),
      companyOriginal: chineseMatch[1].trim(),
      position: chineseMatch[2].trim(),
      positionOriginal: chineseMatch[2].trim(),
      level: null,
      location: null,
      confidence: 0.6,
    };
  }
  
  // Pattern: "Company Position" (e.g., "Google SWE")
  const knownCompanies = [
    "Google", "Meta", "Amazon", "Apple", "Microsoft", "Netflix", "ByteDance",
    "Alibaba", "Tencent", "Uber", "Airbnb", "Stripe", "Coinbase", "OpenAI",
  ];
  
  for (const company of knownCompanies) {
    if (trimmed.toLowerCase().startsWith(company.toLowerCase())) {
      const position = trimmed.slice(company.length).trim();
      if (position) {
        return {
          company,
          companyOriginal: company,
          position: position || "Software Engineer",
          positionOriginal: position || trimmed,
          level: null,
          location: null,
          confidence: 0.6,
        };
      }
    }
  }
  
  // Default: treat entire input as position
  return {
    company: null,
    companyOriginal: null,
    position: trimmed,
    positionOriginal: trimmed,
    level: null,
    location: null,
    confidence: 0.5,
  };
}

/**
 * Normalize company name for knowledge base lookup
 */
export function normalizeCompanyName(name: string | null): string | null {
  if (!name) return null;
  
  const normalized = name.trim().toLowerCase();
  
  const aliases: Record<string, string> = {
    "字节": "ByteDance",
    "字节跳动": "ByteDance",
    "bytedance": "ByteDance",
    "tiktok": "ByteDance",
    "谷歌": "Google",
    "google": "Google",
    "脸书": "Meta",
    "facebook": "Meta",
    "meta": "Meta",
    "亚马逊": "Amazon",
    "amazon": "Amazon",
    "微软": "Microsoft",
    "microsoft": "Microsoft",
    "苹果": "Apple",
    "apple": "Apple",
    "阿里": "Alibaba",
    "阿里巴巴": "Alibaba",
    "alibaba": "Alibaba",
    "腾讯": "Tencent",
    "tencent": "Tencent",
    "netflix": "Netflix",
    "uber": "Uber",
    "airbnb": "Airbnb",
    "stripe": "Stripe",
    "coinbase": "Coinbase",
    "openai": "OpenAI",
  };
  
  return aliases[normalized] || name;
}

/**
 * Normalize position name for knowledge base lookup
 */
export function normalizePositionName(name: string): string {
  const normalized = name.trim().toLowerCase();
  
  const aliases: Record<string, string> = {
    "pm": "Product Manager",
    "产品经理": "Product Manager",
    "product manager": "Product Manager",
    "swe": "Software Engineer",
    "sde": "Software Engineer",
    "软件工程师": "Software Engineer",
    "码农": "Software Engineer",
    "software engineer": "Software Engineer",
    "前端": "Frontend Engineer",
    "frontend": "Frontend Engineer",
    "frontend engineer": "Frontend Engineer",
    "后端": "Backend Engineer",
    "backend": "Backend Engineer",
    "backend engineer": "Backend Engineer",
    "全栈": "Full Stack Engineer",
    "fullstack": "Full Stack Engineer",
    "full stack": "Full Stack Engineer",
    "数据分析": "Data Analyst",
    "data analyst": "Data Analyst",
    "数据科学": "Data Scientist",
    "data scientist": "Data Scientist",
    "算法": "Machine Learning Engineer",
    "ml": "Machine Learning Engineer",
    "机器学习": "Machine Learning Engineer",
    "machine learning": "Machine Learning Engineer",
  };
  
  return aliases[normalized] || name;
}
