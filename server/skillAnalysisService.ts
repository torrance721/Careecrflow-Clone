/**
 * Skill Analysis Service
 * Analyzes job descriptions against user resumes to calculate skill match scores
 */

import { getDb } from "./db";
import { skillAnalysisCache, resumes } from "../drizzle/schema";
import { eq, and, gt, lt } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import crypto from "crypto";

// Types
export interface SkillAnalysisResult {
  score: number;
  strongMatch: string[];
  partialMatch: Array<{ resume: string; job: string }>;
  missing: string[];
  cached: boolean;
}

export interface SkillAnalysisInput {
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  jobUrl?: string;
  resumeId?: number;
  userId: number;
}

// Generate cache key from job description and resume ID
function generateCacheKey(jobDescription: string, resumeId: number): string {
  const hash = crypto.createHash("sha256");
  hash.update(jobDescription + resumeId.toString());
  return hash.digest("hex").substring(0, 64);
}

// Generate hash for job description
function generateJobDescriptionHash(jobDescription: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(jobDescription);
  return hash.digest("hex").substring(0, 64);
}

// Get cached analysis result
async function getCachedAnalysis(
  cacheKey: string
): Promise<SkillAnalysisResult | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const cached = await db
    .select()
    .from(skillAnalysisCache)
    .where(
      and(
        eq(skillAnalysisCache.cacheKey, cacheKey),
        gt(skillAnalysisCache.expiresAt, now)
      )
    )
    .limit(1);

  if (cached.length > 0) {
    return {
      score: cached[0].score,
      strongMatch: cached[0].strongMatch as string[],
      partialMatch: cached[0].partialMatch as Array<{ resume: string; job: string }>,
      missing: cached[0].missing as string[],
      cached: true,
    };
  }

  return null;
}

// Save analysis result to cache
async function saveToCache(
  cacheKey: string,
  jobDescriptionHash: string,
  resumeId: number,
  userId: number,
  jobTitle: string | undefined,
  company: string | undefined,
  jobUrl: string | undefined,
  result: Omit<SkillAnalysisResult, "cached">
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

  await db.insert(skillAnalysisCache).values({
    cacheKey,
    jobDescriptionHash,
    resumeId,
    userId,
    jobTitle: jobTitle ?? null,
    company: company ?? null,
    jobUrl: jobUrl ?? null,
    score: result.score,
    strongMatch: result.strongMatch,
    partialMatch: result.partialMatch,
    missing: result.missing,
    expiresAt,
  });
}

// Get resume content as text
async function getResumeText(resumeId: number, userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const resume = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .limit(1);

  if (resume.length === 0) {
    return null;
  }

  const r = resume[0];
  
  // Build resume text from structured data
  const parts: string[] = [];
  
  // Personal info
  if (r.personalInfo) {
    const info = r.personalInfo as any;
    if (info.firstName || info.lastName) {
      parts.push(`Name: ${info.firstName || ''} ${info.lastName || ''}`);
    }
  }
  
  // Summary
  if (r.summary) {
    parts.push(`Summary: ${r.summary}`);
  }
  
  // Skills
  if (r.skills && Array.isArray(r.skills)) {
    const skillNames = (r.skills as any[]).map(s => s.name).filter(Boolean);
    if (skillNames.length > 0) {
      parts.push(`Skills: ${skillNames.join(', ')}`);
    }
  }
  
  // Experience
  if (r.experience && Array.isArray(r.experience)) {
    const expParts = (r.experience as any[]).map(exp => {
      const lines = [`${exp.position} at ${exp.company}`];
      if (exp.description) lines.push(exp.description);
      if (exp.highlights && Array.isArray(exp.highlights)) {
        lines.push(...exp.highlights);
      }
      return lines.join('. ');
    });
    if (expParts.length > 0) {
      parts.push(`Experience: ${expParts.join(' | ')}`);
    }
  }
  
  // Education
  if (r.education && Array.isArray(r.education)) {
    const eduParts = (r.education as any[]).map(edu => {
      return `${edu.degree} in ${edu.field || 'N/A'} from ${edu.institution}`;
    });
    if (eduParts.length > 0) {
      parts.push(`Education: ${eduParts.join(' | ')}`);
    }
  }
  
  // Projects
  if (r.projects && Array.isArray(r.projects)) {
    const projParts = (r.projects as any[]).map(proj => {
      const lines = [proj.name];
      if (proj.description) lines.push(proj.description);
      if (proj.technologies && Array.isArray(proj.technologies)) {
        lines.push(`Technologies: ${proj.technologies.join(', ')}`);
      }
      return lines.join('. ');
    });
    if (projParts.length > 0) {
      parts.push(`Projects: ${projParts.join(' | ')}`);
    }
  }
  
  // Certifications
  if (r.certifications && Array.isArray(r.certifications)) {
    const certNames = (r.certifications as any[]).map(c => c.name).filter(Boolean);
    if (certNames.length > 0) {
      parts.push(`Certifications: ${certNames.join(', ')}`);
    }
  }
  
  return parts.join('\n\n');
}

// Get user's default resume ID
async function getDefaultResumeId(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // First try to get the default resume
  const defaultResume = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.isDefault, 1)))
    .limit(1);

  if (defaultResume.length > 0) {
    return defaultResume[0].id;
  }

  // If no default, get the most recent resume
  const latestResume = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(eq(resumes.userId, userId))
    .orderBy(resumes.updatedAt)
    .limit(1);

  return latestResume.length > 0 ? latestResume[0].id : null;
}

// Main skill analysis function
export async function analyzeSkills(
  input: SkillAnalysisInput
): Promise<SkillAnalysisResult> {
  const { jobDescription, jobTitle, company, jobUrl, userId } = input;
  
  // Get resume ID (use provided or get default)
  let resumeId = input.resumeId;
  if (!resumeId) {
    const defaultId = await getDefaultResumeId(userId);
    if (!defaultId) {
      throw new Error("NO_RESUME");
    }
    resumeId = defaultId;
  }

  // Generate cache key
  const cacheKey = generateCacheKey(jobDescription, resumeId);
  const jobDescriptionHash = generateJobDescriptionHash(jobDescription);

  // Check cache first
  const cachedResult = await getCachedAnalysis(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Get resume text
  const resumeText = await getResumeText(resumeId, userId);
  if (!resumeText) {
    throw new Error("RESUME_NOT_FOUND");
  }

  // Call LLM for one-shot analysis
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an expert recruiter analyzing skill matches between job descriptions and resumes.

Analyze the job description and resume, then return a JSON object with:
1. score: 0-100 match score based on skill alignment
2. strongMatch: array of skills that exactly match (same skill in both)
3. partialMatch: array of objects {resume: "skill from resume", job: "similar skill from job"} for related but not exact matches
4. missing: array of important skills required by the job but not found in the resume

Scoring guidelines:
- 90-100: Excellent match, candidate has almost all required skills
- 70-89: Good match, candidate has most key skills
- 50-69: Moderate match, candidate has some relevant skills
- 30-49: Weak match, candidate lacks many required skills
- 0-29: Poor match, skills don't align

Be thorough but realistic. Focus on technical skills, tools, and domain expertise.`,
      },
      {
        role: "user",
        content: `Job Description:
${jobDescription}

Resume:
${resumeText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "skill_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            score: {
              type: "number",
              description: "Match score from 0 to 100",
            },
            strongMatch: {
              type: "array",
              items: { type: "string" },
              description: "Skills that exactly match between resume and job",
            },
            partialMatch: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  resume: { type: "string" },
                  job: { type: "string" },
                },
                required: ["resume", "job"],
                additionalProperties: false,
              },
              description: "Skills that partially match or are related",
            },
            missing: {
              type: "array",
              items: { type: "string" },
              description: "Important skills required by job but missing from resume",
            },
          },
          required: ["score", "strongMatch", "partialMatch", "missing"],
          additionalProperties: false,
        },
      },
    },
  });

  // Parse LLM response
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM_RESPONSE_EMPTY");
  }

  let analysisResult: Omit<SkillAnalysisResult, "cached">;
  try {
    analysisResult = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
  } catch (e) {
    throw new Error("LLM_RESPONSE_INVALID");
  }

  // Validate result
  if (
    typeof analysisResult.score !== "number" ||
    !Array.isArray(analysisResult.strongMatch) ||
    !Array.isArray(analysisResult.partialMatch) ||
    !Array.isArray(analysisResult.missing)
  ) {
    throw new Error("LLM_RESPONSE_INVALID");
  }

  // Save to cache
  await saveToCache(
    cacheKey,
    jobDescriptionHash,
    resumeId,
    userId,
    jobTitle,
    company,
    jobUrl,
    analysisResult
  );

  return {
    ...analysisResult,
    cached: false,
  };
}

// Clear cache for a specific resume (when resume is updated)
export async function clearCacheForResume(resumeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(skillAnalysisCache)
    .where(eq(skillAnalysisCache.resumeId, resumeId));
}

// Clear expired cache entries
export async function clearExpiredCache(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();
  await db
    .delete(skillAnalysisCache)
    .where(lt(skillAnalysisCache.expiresAt, now));
  
  return 0; // MySQL doesn't return affected rows easily
}
