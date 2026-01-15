/**
 * Persona Generator for Agent Loop
 * 
 * Generates mock user personas for testing the interview system.
 * Uses adversarial evolution to make personas increasingly critical.
 */

import { invokeLLM } from '../../_core/llm';
import * as fs from 'fs';
import * as path from 'path';

export interface MockPersona {
  id: string;
  name: string;
  background: {
    yearsOfExperience: number;
    currentRole: string;
    currentCompany: string;
    education: string;
    skills: string[];
  };
  targetJob: {
    company: string;
    position: string;
  };
  personality: {
    communicationStyle: 'verbose' | 'concise' | 'rambling' | 'structured';
    confidenceLevel: 'high' | 'medium' | 'low';
    criticalness: number; // 1-10, how critical they are in feedback
    patience: number; // 1-10, how patient with the system
    trustLevel: number; // 1-10, how much they trust the system initially (lower = more skeptical)
  };
  interviewBehavior: {
    typicalResponseLength: 'brief' | 'medium' | 'detailed';
    usesExamples: boolean;
    asksForClarification: boolean;
    getsNervous: boolean;
  };
  resumeText: string;
  situation: string;
  feedbackStyle: string; // How they give feedback
  createdAt: string;
  iteration: number;
}

export interface PersonaGeneratorConfig {
  iteration: number;
  existingPersonas: MockPersona[];
  targetCriticalness: number | { min: number; max: number }; // Increases with each iteration
  targetJob?: { company: string; position: string }; // Optional: force specific job target
}

/**
 * 目标用户画像约束
 * 
 * 我们的目标用户是：
 * - 年龄：30 岁以下
 * - 目标：找个好工作，需要面试
 * - 行为：会"海投"
 * - 挑剔度提升方向：更详实的 profile、更高的期望标准
 * 
 * 不包括：
 * - VP、C-level 等高管职位
 * - 资深专业人士（10+ 年经验）
 * - 不需要面试的人（如创业者、自由职业者）
 */
export const TARGET_USER_CONSTRAINTS = {
  // 年龄约束
  maxAge: 30,
  minAge: 18,
  
  // 经验约束
  maxYearsOfExperience: 8, // 最多 8 年经验（30 岁以下）
  minYearsOfExperience: 0, // 包括应届生
  
  // 职位约束（排除高管）
  excludedPositions: [
    'VP', 'Vice President',
    'Director', 'Senior Director',
    'C-Level', 'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CIO', 'CISO',
    'Chief', 'President', 'Partner',
    'Executive', 'Head of',
    'Principal', 'Distinguished',
  ],
  
  // 允许的职位级别
  allowedLevels: [
    'Intern', 'Junior', 'Associate',
    'Mid-level', 'Senior', 'Lead',
    'Staff', 'Engineer', 'Developer',
    'Analyst', 'Specialist', 'Coordinator',
    'Manager', // 允许一线经理
  ],
  
  // 目标公司类型（海投场景）
  targetCompanyTypes: [
    'Tech startup', 'FAANG', 'Big Tech',
    'Unicorn', 'Series A-C startup',
    'Fortune 500', 'Consulting firm',
    'Finance/Fintech', 'E-commerce',
  ],
  
  // 挑剔度提升方向（而非资历提升）
  criticalnessDimensions: [
    'profile_detail', // 更详实的简历和背景
    'expectation_clarity', // 更清晰的期望
    'feedback_depth', // 更深入的反馈
    'question_sophistication', // 更成熟的提问
    'interview_preparation', // 更充分的面试准备
  ],
  
  // 用户心态特征（新增）
  mindset: {
    willingToChange: true, // 愿意改变自己
    seekingBetterOpportunity: true, // 寻找更好的工作机会
    caresAboutGrowth: true, // 介意岗位发展度（成长空间）
    caresAboutSpecialization: false, // 不介意岗位的专业性（愿意跨领域尝试）
    massApplying: true, // 海投策略
  },
  
  // 关注点优先级
  priorities: [
    'career_growth', // 职业发展空间
    'learning_opportunity', // 学习机会
    'company_reputation', // 公司名声
    'work_life_balance', // 工作生活平衡
    'salary', // 薪资
  ],
  
  // 不关注的点
  notPriorities: [
    'job_specialization', // 岗位专业性
    'domain_expertise_match', // 领域专业匹配
    'technical_depth_requirement', // 技术深度要求
  ],
  
  // 信任度维度（影响话题结束时机）
  trustLevelBehaviors: {
    // 低信任度 (1-3): 怀疑系统能力，需要快速看到价值
    low: {
      maxRoundsBeforeFeedback: 2, // 最多 2 轮就要看结果
      responseLength: 'brief', // 回答简短
      likelyToAbandon: true, // 容易放弃
      needsQuickWins: true, // 需要快速的价值证明
    },
    // 中等信任度 (4-6): 愿意尝试，但不会耗费太多时间
    medium: {
      maxRoundsBeforeFeedback: 4, // 最多 4 轮
      responseLength: 'medium', // 回答中等
      likelyToAbandon: false, // 不容易放弃
      needsQuickWins: false, // 不需要快速价值证明
    },
    // 高信任度 (7-10): 愿意深入交流，相信系统能提供价值
    high: {
      maxRoundsBeforeFeedback: 8, // 可以聊很久
      responseLength: 'detailed', // 回答详细
      likelyToAbandon: false, // 不会放弃
      needsQuickWins: false, // 不需要快速价值证明
    },
  },
} as const;

const PERSONAS_DIR = '/home/ubuntu/UHWeb/data/personas';

/**
 * Ensure personas directory exists
 */
function ensurePersonasDir(): void {
  if (!fs.existsSync(PERSONAS_DIR)) {
    fs.mkdirSync(PERSONAS_DIR, { recursive: true });
  }
}

/**
 * Load existing personas from disk
 */
export function loadExistingPersonas(): MockPersona[] {
  ensurePersonasDir();
  const personas: MockPersona[] = [];
  
  try {
    const files = fs.readdirSync(PERSONAS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(PERSONAS_DIR, file), 'utf-8');
        personas.push(JSON.parse(content));
      }
    }
  } catch (error) {
    console.error('[PersonaGenerator] Error loading personas:', error);
  }
  
  return personas;
}

/**
 * Save persona to disk
 */
export function savePersona(persona: MockPersona): void {
  ensurePersonasDir();
  const filePath = path.join(PERSONAS_DIR, `${persona.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(persona, null, 2));
}

/**
 * Generate a unique persona ID
 */
function generatePersonaId(): string {
  return `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证 Persona 是否符合目标用户约束
 */
function validatePersonaConstraints(persona: MockPersona): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  // 检查经验年限
  if (persona.background.yearsOfExperience > TARGET_USER_CONSTRAINTS.maxYearsOfExperience) {
    reasons.push(`Experience ${persona.background.yearsOfExperience} years exceeds max ${TARGET_USER_CONSTRAINTS.maxYearsOfExperience}`);
  }
  
  // 检查职位级别（排除高管）
  const currentRole = persona.background.currentRole.toLowerCase();
  const targetPosition = persona.targetJob.position.toLowerCase();
  
  for (const excluded of TARGET_USER_CONSTRAINTS.excludedPositions) {
    const excludedLower = excluded.toLowerCase();
    if (currentRole.includes(excludedLower) || targetPosition.includes(excludedLower)) {
      reasons.push(`Position contains excluded term: ${excluded}`);
    }
  }
  
  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * 尝试修复不符合约束的 Persona
 */
function fixPersonaConstraints(persona: MockPersona): MockPersona | null {
  const fixed = { ...persona };
  
  // 确保 trustLevel 存在，如果不存在则根据 criticalness 生成
  if (fixed.personality.trustLevel === undefined) {
    // 高挑剔度用户通常信任度低（更难满足）
    const criticalness = fixed.personality.criticalness || 5;
    fixed.personality = {
      ...fixed.personality,
      trustLevel: Math.max(1, Math.min(10, 11 - criticalness + Math.floor(Math.random() * 3) - 1)),
    };
  }
  
  // 修复经验年限
  if (fixed.background.yearsOfExperience > TARGET_USER_CONSTRAINTS.maxYearsOfExperience) {
    fixed.background = {
      ...fixed.background,
      yearsOfExperience: Math.min(
        fixed.background.yearsOfExperience,
        TARGET_USER_CONSTRAINTS.maxYearsOfExperience
      ),
    };
  }
  
  // 修复职位级别
  const positionReplacements: Record<string, string> = {
    'vp of': 'Senior',
    'vice president': 'Senior Manager',
    'director of': 'Lead',
    'senior director': 'Senior Lead',
    'head of': 'Lead',
    'chief': 'Senior',
    'executive': 'Senior',
    'principal': 'Staff',
    'distinguished': 'Senior Staff',
  };
  
  let currentRole = fixed.background.currentRole;
  let targetPosition = fixed.targetJob.position;
  
  for (const [pattern, replacement] of Object.entries(positionReplacements)) {
    const regex = new RegExp(pattern, 'gi');
    currentRole = currentRole.replace(regex, replacement);
    targetPosition = targetPosition.replace(regex, replacement);
  }
  
  fixed.background = { ...fixed.background, currentRole };
  fixed.targetJob = { ...fixed.targetJob, position: targetPosition };
  
  // 再次验证
  const validation = validatePersonaConstraints(fixed);
  if (validation.valid) {
    return fixed;
  }
  
  // 如果还是不符合，返回 null
  return null;
}

/**
 * Generate new mock personas that are different from existing ones
 */
export async function generatePersonas(
  config: PersonaGeneratorConfig,
  count: number = 3
): Promise<MockPersona[]> {
  const { iteration, existingPersonas, targetCriticalness, targetJob } = config;
  
  // 处理 targetCriticalness 可能是数字或范围
  const criticalness = typeof targetCriticalness === 'number' 
    ? targetCriticalness 
    : Math.floor((targetCriticalness.min + targetCriticalness.max) / 2);
  
  // Build context about existing personas to ensure diversity
  const existingContext = existingPersonas.length > 0
    ? `Existing personas (DO NOT duplicate these characteristics):
${existingPersonas.slice(-5).map(p => `- ${p.name}: ${p.background.currentRole} with ${p.background.yearsOfExperience} years, ${p.personality.communicationStyle} style, criticalness ${p.personality.criticalness}/10`).join('\n')}`
    : 'No existing personas yet.';
  
  // 如果指定了 targetJob，添加约束
  const targetJobConstraint = targetJob 
    ? `\n=== REQUIRED TARGET JOB (MUST USE EXACTLY) ===\nThe persona MUST be applying for: ${targetJob.position} at ${targetJob.company}\nDo NOT change or modify this job target.\n`
    : '';

  // 目标用户约束说明
  const targetUserConstraints = `
=== TARGET USER PROFILE (MUST FOLLOW) ===
Our target users are job seekers under 30 who are actively "mass applying" (海投) to many companies:

1. AGE: 18-30 years old (typically 0-8 years of work experience)
2. GOAL: Looking for a good job, need interview practice
3. BEHAVIOR: Mass applying to multiple companies (10-50+ applications)
4. JOB LEVELS ALLOWED: Intern, Junior, Associate, Mid-level, Senior, Lead, Staff Engineer, Manager
5. JOB LEVELS EXCLUDED: VP, Director, C-Level, Executive, Head of, Principal, Distinguished, Partner

=== USER MINDSET (MUST REFLECT IN PERSONA) ===
6. WILLING TO CHANGE: Open to learning new skills, adapting to new environments, and changing career direction
7. SEEKING BETTER OPPORTUNITIES: Actively looking for growth, not just any job
8. CARES ABOUT GROWTH: Prioritizes career development space, learning opportunities, and company reputation
9. DOES NOT CARE ABOUT SPECIALIZATION: Willing to try cross-domain roles, not fixated on matching exact expertise
10. MASS APPLYING STRATEGY: Applies to many companies (10-50+), values efficiency in interview prep

=== PRIORITIES (REFLECT IN FEEDBACK) ===
- Career growth and development space (HIGH priority)
- Learning opportunities (HIGH priority)
- Company reputation and brand (MEDIUM priority)
- Work-life balance (MEDIUM priority)
- Salary (MEDIUM priority)
- Job specialization/domain match (LOW priority - they are flexible)

IMPORTANT - How to increase criticalness WITHOUT changing seniority:
- Higher criticalness = MORE DETAILED profile, CLEARER expectations, DEEPER feedback
- Higher criticalness = MORE PREPARED for interviews, HIGHER standards for the tool
- Higher criticalness = MORE SPECIFIC about what they want, MORE DEMANDING about quality
- DO NOT increase criticalness by making them more senior or experienced
- A junior developer can be criticalness 10/10 if they are very detail-oriented and demanding
- A senior engineer can be criticalness 4/10 if they are easy-going and patient

Examples of valid high-criticalness personas (criticalness 8-10):
- Fresh grad who researched extensively and has very specific expectations
- 3-year engineer who is meticulous about details and gives thorough feedback
- Career changer who prepared intensively and expects professional-level experience

Examples of INVALID personas (DO NOT GENERATE):
- VP of Engineering (too senior)
- Director of Product (too senior)
- 15-year veteran (too experienced)
- Someone not looking for a job (not our target)
`;

  const prompt = `Generate ${count} unique mock user personas for testing an AI interview preparation system.

${targetUserConstraints}
${targetJobConstraint}
${existingContext}

Requirements:
1. Each persona must be DISTINCTLY DIFFERENT from existing ones
2. Target criticalness level: ${criticalness}/10 (higher = more demanding/critical in feedback, NOT more senior)
3. Iteration: ${iteration} (personas should have increasingly detailed profiles and clearer expectations)
4. Include diverse backgrounds: different industries, education levels, cultures
5. MUST be under 30 years old with 0-8 years of experience
6. MUST be actively job hunting and mass applying to multiple companies
7. Each persona should have a realistic resume summary and current situation
${targetJob ? `8. MUST use the exact target job specified above: ${targetJob.position} at ${targetJob.company}` : ''}

For each persona, generate:
- Name (diverse cultural backgrounds)
- Background (0-8 years experience, role appropriate for their level, education, skills)
- Target job (${targetJob ? `MUST BE: ${targetJob.position} at ${targetJob.company}` : 'company and position they\'re applying for - NOT VP/Director/C-level'})
- Personality traits (communication style, confidence, criticalness, patience, trustLevel)
- Interview behavior (response length, uses examples, asks clarification, gets nervous)
- A realistic resume text (200-300 words, appropriate for their experience level)
- Current situation (why they're job hunting, mention mass applying, 50-100 words)
- Feedback style (how they give feedback about the interview experience)

Return as JSON array:
[
  {
    "name": "...",
    "background": {
      "yearsOfExperience": number,
      "currentRole": "...",
      "currentCompany": "...",
      "education": "...",
      "skills": ["...", "..."]
    },
    "targetJob": {
      "company": "...",
      "position": "..."
    },
    "personality": {
      "communicationStyle": "verbose|concise|rambling|structured",
      "confidenceLevel": "high|medium|low",
      "criticalness": number (1-10),
      "patience": number (1-10),
      "trustLevel": number (1-10, lower = more skeptical of the system, needs faster proof of value)
    },
    "interviewBehavior": {
      "typicalResponseLength": "brief|medium|detailed",
      "usesExamples": boolean,
      "asksForClarification": boolean,
      "getsNervous": boolean
    },
    "resumeText": "...",
    "situation": "...",
    "feedbackStyle": "..."
  }
]`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'personas',
          strict: true,
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                background: {
                  type: 'object',
                  properties: {
                    yearsOfExperience: { type: 'number' },
                    currentRole: { type: 'string' },
                    currentCompany: { type: 'string' },
                    education: { type: 'string' },
                    skills: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['yearsOfExperience', 'currentRole', 'currentCompany', 'education', 'skills'],
                  additionalProperties: false,
                },
                targetJob: {
                  type: 'object',
                  properties: {
                    company: { type: 'string' },
                    position: { type: 'string' },
                  },
                  required: ['company', 'position'],
                  additionalProperties: false,
                },
                personality: {
                  type: 'object',
                  properties: {
                    communicationStyle: { type: 'string', enum: ['verbose', 'concise', 'rambling', 'structured'] },
                    confidenceLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
                    criticalness: { type: 'number' },
                    patience: { type: 'number' },
                    trustLevel: { type: 'number' },
                  },
                  required: ['communicationStyle', 'confidenceLevel', 'criticalness', 'patience', 'trustLevel'],
                  additionalProperties: false,
                },
                interviewBehavior: {
                  type: 'object',
                  properties: {
                    typicalResponseLength: { type: 'string', enum: ['brief', 'medium', 'detailed'] },
                    usesExamples: { type: 'boolean' },
                    asksForClarification: { type: 'boolean' },
                    getsNervous: { type: 'boolean' },
                  },
                  required: ['typicalResponseLength', 'usesExamples', 'asksForClarification', 'getsNervous'],
                  additionalProperties: false,
                },
                resumeText: { type: 'string' },
                situation: { type: 'string' },
                feedbackStyle: { type: 'string' },
              },
              required: ['name', 'background', 'targetJob', 'personality', 'interviewBehavior', 'resumeText', 'situation', 'feedbackStyle'],
              additionalProperties: false,
            },
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const rawPersonas = JSON.parse(content);
      
      // Add metadata and validate
      const personas: MockPersona[] = rawPersonas.map((p: Omit<MockPersona, 'id' | 'createdAt' | 'iteration'>) => {
        // 如果指定了 targetJob，强制应用
        const finalTargetJob = targetJob || p.targetJob;
        return {
          ...p,
          targetJob: finalTargetJob,
          id: generatePersonaId(),
          createdAt: new Date().toISOString(),
          iteration,
        };
      });
      
      // Validate each persona against target user constraints
      const validPersonas: MockPersona[] = [];
      for (const persona of personas) {
        const validation = validatePersonaConstraints(persona);
        if (validation.valid) {
          savePersona(persona);
          validPersonas.push(persona);
        } else {
          console.warn(`[PersonaGenerator] Persona ${persona.name} rejected: ${validation.reasons.join(', ')}`);
          // Try to fix the persona
          const fixedPersona = fixPersonaConstraints(persona);
          if (fixedPersona) {
            savePersona(fixedPersona);
            validPersonas.push(fixedPersona);
            console.log(`[PersonaGenerator] Fixed persona ${fixedPersona.name}`);
          }
        }
      }
      
      return validPersonas;
    }
  } catch (error) {
    console.error('[PersonaGenerator] Error generating personas:', error);
  }

  return [];
}

/**
 * Update the persona generator prompt based on feedback
 * This implements the adversarial evolution
 */
export async function evolvePersonaGenerator(
  feedbackSummary: string,
  currentIteration: number
): Promise<string> {
  const prompt = `Based on the following feedback from mock interviews, suggest how to evolve the persona generator to create more challenging and diverse test users.

Feedback Summary:
${feedbackSummary}

Current Iteration: ${currentIteration}

Provide specific suggestions for:
1. What new personality types to add
2. What edge cases to cover
3. How to make personas more critical/demanding
4. What interview behaviors to simulate

Return a brief evolution strategy (100-200 words).`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[PersonaGenerator] Error evolving generator:', error);
  }

  return 'Continue with current strategy, increase criticalness by 1.';
}
