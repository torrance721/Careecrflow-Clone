/**
 * CareerPathMatchingAgent - 职业路径匹配 Agent
 * 
 * 动态分析用户职业轨迹，提取职业目标，识别技能差距，
 * 搜索匹配职位，生成个性化匹配理由。
 * 
 * 替代原有的固定 70% 匹配逻辑。
 */

import { StreamingBaseReActAgent } from './react/streamingBaseAgent';
import { ReActConfig, Tool, ReActTrace } from './react/types';
import { scrapeLinkedInJobs, LinkedInJobResult } from '../apify';

// ==================== 输入输出类型 ====================

export interface CareerPathInput {
  userBackground: {
    currentRole?: string;
    yearsOfExperience?: number;
    skills: string[];
    education?: string;
    previousRoles?: string[];
    targetRole?: string;
    targetIndustry?: string;
    preferredLocation?: string;
    preferredWorkMode?: 'remote' | 'hybrid' | 'onsite' | 'any';
  };
  interviewPerformance: {
    strengths: string[];
    weaknesses: string[];
    overallScore?: number;
    topicScores?: Record<string, number>;
  };
  language: 'en' | 'zh';
}

export interface CareerPathOutput {
  careerAnalysis: {
    currentStage: string;  // 当前职业阶段
    trajectory: string;    // 职业轨迹分析
    goals: string[];       // 识别的职业目标
    skillGaps: string[];   // 技能差距
  };
  recommendations: Array<{
    jobId: string;
    title: string;
    company: string;
    location: string;
    matchScore: number;      // 0-100 动态计算
    matchReasons: string[];  // 为什么匹配
    growthOpportunities: string[];  // 成长机会
    challenges: string[];    // 可能的挑战
    applyUrl?: string;
  }>;
  careerAdvice: string;  // 整体职业建议
}

// ==================== 工具定义 ====================

const analyzeCareerTrajectoryTool: Tool = {
  name: 'analyze_career_trajectory',
  description: 'Analyze the user\'s career trajectory based on their background and experience',
  parameters: {
    type: 'object',
    properties: {
      currentRole: {
        type: 'string',
        description: 'Current job role',
      },
      previousRoles: {
        type: 'array',
        description: 'List of previous job roles',
      },
      yearsOfExperience: {
        type: 'number',
        description: 'Total years of experience',
      },
      skills: {
        type: 'array',
        description: 'List of skills',
      },
    },
    required: ['skills'],
  },
  estimatedTimeMs: 500,
  execute: async (params) => {
    // 这个工具主要是让 LLM 进行分析，返回结构化的分析框架
    const { currentRole, previousRoles, yearsOfExperience, skills } = params as {
      currentRole?: string;
      previousRoles?: string[];
      yearsOfExperience?: number;
      skills: string[];
    };
    
    // 确定职业阶段
    let stage = 'Entry Level';
    if (yearsOfExperience) {
      if (yearsOfExperience >= 10) stage = 'Senior/Leadership';
      else if (yearsOfExperience >= 5) stage = 'Mid-Senior Level';
      else if (yearsOfExperience >= 2) stage = 'Mid Level';
    }
    
    // 分析技能类别
    const technicalSkills = skills.filter(s => 
      /programming|coding|software|data|engineering|design|development/i.test(s)
    );
    const softSkills = skills.filter(s => 
      /communication|leadership|management|teamwork|problem.solving/i.test(s)
    );
    
    return {
      success: true,
      data: {
        stage,
        roleProgression: previousRoles ? [...previousRoles, currentRole].filter(Boolean) : [currentRole].filter(Boolean),
        skillCategories: {
          technical: technicalSkills,
          soft: softSkills,
          total: skills.length,
        },
        experienceLevel: yearsOfExperience || 0,
      },
      executionTimeMs: 50,
    };
  },
};

const extractCareerGoalsTool: Tool = {
  name: 'extract_career_goals',
  description: 'Extract and infer career goals from user\'s target role and interview performance',
  parameters: {
    type: 'object',
    properties: {
      targetRole: {
        type: 'string',
        description: 'User\'s target role',
      },
      targetIndustry: {
        type: 'string',
        description: 'User\'s target industry',
      },
      strengths: {
        type: 'array',
        description: 'User\'s demonstrated strengths',
      },
      currentRole: {
        type: 'string',
        description: 'Current role for comparison',
      },
    },
    required: ['strengths'],
  },
  estimatedTimeMs: 300,
  execute: async (params) => {
    const { targetRole, targetIndustry, strengths, currentRole } = params as {
      targetRole?: string;
      targetIndustry?: string;
      strengths: string[];
      currentRole?: string;
    };
    
    const goals: string[] = [];
    
    // 基于目标角色推断目标
    if (targetRole) {
      if (targetRole.toLowerCase().includes('senior') || targetRole.toLowerCase().includes('lead')) {
        goals.push('Career advancement to leadership position');
      }
      if (targetRole !== currentRole) {
        goals.push(`Role transition from ${currentRole || 'current position'} to ${targetRole}`);
      }
    }
    
    // 基于优势推断目标
    if (strengths.some(s => /technical|engineering|coding/i.test(s))) {
      goals.push('Technical depth and expertise development');
    }
    if (strengths.some(s => /leadership|management|team/i.test(s))) {
      goals.push('People management and leadership growth');
    }
    
    // 行业相关目标
    if (targetIndustry) {
      goals.push(`Industry focus: ${targetIndustry}`);
    }
    
    return {
      success: true,
      data: {
        inferredGoals: goals,
        targetRole: targetRole || 'Not specified',
        targetIndustry: targetIndustry || 'Not specified',
        careerDirection: targetRole?.toLowerCase().includes('manager') ? 'management' : 'individual contributor',
      },
      executionTimeMs: 30,
    };
  },
};

const identifySkillGapsTool: Tool = {
  name: 'identify_skill_gaps',
  description: 'Identify skill gaps between current skills and target role requirements',
  parameters: {
    type: 'object',
    properties: {
      currentSkills: {
        type: 'array',
        description: 'User\'s current skills',
      },
      targetRole: {
        type: 'string',
        description: 'Target role to analyze',
      },
      weaknesses: {
        type: 'array',
        description: 'Identified weaknesses from interview',
      },
    },
    required: ['currentSkills', 'weaknesses'],
  },
  estimatedTimeMs: 400,
  execute: async (params) => {
    const { currentSkills, targetRole, weaknesses } = params as {
      currentSkills: string[];
      targetRole?: string;
      weaknesses: string[];
    };
    
    // 常见角色的技能要求映射
    const roleSkillRequirements: Record<string, string[]> = {
      'software engineer': ['algorithms', 'system design', 'coding', 'testing', 'git'],
      'product manager': ['product strategy', 'user research', 'data analysis', 'stakeholder management'],
      'data scientist': ['machine learning', 'statistics', 'python', 'sql', 'data visualization'],
      'designer': ['ui design', 'ux research', 'prototyping', 'design systems', 'figma'],
      'marketing': ['digital marketing', 'analytics', 'content strategy', 'seo', 'social media'],
    };
    
    // 找到匹配的角色技能要求
    let requiredSkills: string[] = [];
    if (targetRole) {
      const normalizedRole = targetRole.toLowerCase();
      for (const [role, skills] of Object.entries(roleSkillRequirements)) {
        if (normalizedRole.includes(role)) {
          requiredSkills = skills;
          break;
        }
      }
    }
    
    // 计算技能差距
    const currentSkillsLower = currentSkills.map(s => s.toLowerCase());
    const gaps = requiredSkills.filter(skill => 
      !currentSkillsLower.some(cs => cs.includes(skill) || skill.includes(cs))
    );
    
    // 结合面试中发现的弱点
    const allGaps = Array.from(new Set([...gaps, ...weaknesses]));
    
    return {
      success: true,
      data: {
        skillGaps: allGaps,
        currentSkillCount: currentSkills.length,
        requiredSkillCount: requiredSkills.length,
        gapPercentage: requiredSkills.length > 0 
          ? Math.round((gaps.length / requiredSkills.length) * 100) 
          : 0,
        priorityGaps: allGaps.slice(0, 3),  // 最重要的 3 个差距
      },
      executionTimeMs: 40,
    };
  },
};

const searchAlignedPositionsTool: Tool = {
  name: 'search_aligned_positions',
  description: 'Search for job positions that align with user\'s career path',
  parameters: {
    type: 'object',
    properties: {
      keywords: {
        type: 'array',
        description: 'Search keywords based on career analysis',
      },
      location: {
        type: 'string',
        description: 'Preferred location',
      },
      workMode: {
        type: 'string',
        description: 'Work mode preference (remote/hybrid/onsite)',
      },
      experienceLevel: {
        type: 'string',
        description: 'Experience level filter',
      },
    },
    required: ['keywords'],
  },
  estimatedTimeMs: 8000,
  execute: async (params) => {
    const { keywords, location, workMode, experienceLevel } = params as {
      keywords: string[];
      location?: string;
      workMode?: string;
      experienceLevel?: string;
    };
    
    try {
      const startTime = Date.now();
      // 搜索 LinkedIn 职位
      const searchQuery = keywords.join(' ');
      const jobs = await scrapeLinkedInJobs({
        title: searchQuery,
        location: location || 'United States',
        workType: workMode === 'remote' ? 'remote' : undefined,
        rows: 10,
      });
      
      return {
        success: true,
        data: {
          jobs: jobs.slice(0, 10).map((job: LinkedInJobResult) => ({
            id: job.jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: job.title,
            company: job.company || 'Unknown Company',
            location: job.location || 'Not specified',
            applyUrl: job.applyUrl || job.linkedinUrl,
            postedDate: job.postedAt,
            description: job.description ? job.description.substring(0, 500) : undefined,
          })),
          totalFound: jobs.length,
          searchQuery,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error searching jobs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search jobs',
        executionTimeMs: 0,
      };
    }
  },
};

const generateCareerFitReasoningTool: Tool = {
  name: 'generate_career_fit_reasoning',
  description: 'Generate detailed reasoning for why a job matches the user\'s career path',
  parameters: {
    type: 'object',
    properties: {
      job: {
        type: 'object',
        description: 'Job details',
      },
      userSkills: {
        type: 'array',
        description: 'User\'s skills',
      },
      userStrengths: {
        type: 'array',
        description: 'User\'s strengths',
      },
      careerGoals: {
        type: 'array',
        description: 'User\'s career goals',
      },
      skillGaps: {
        type: 'array',
        description: 'Identified skill gaps',
      },
    },
    required: ['job', 'userSkills', 'userStrengths'],
  },
  estimatedTimeMs: 300,
  execute: async (params) => {
    const { job, userSkills, userStrengths, careerGoals, skillGaps } = params as {
      job: { title: string; company: string; description?: string };
      userSkills: string[];
      userStrengths: string[];
      careerGoals?: string[];
      skillGaps?: string[];
    };
    
    const matchReasons: string[] = [];
    const growthOpportunities: string[] = [];
    const challenges: string[] = [];
    
    // 基于技能匹配生成理由
    const jobDescription = (job.description || job.title).toLowerCase();
    const matchedSkills = userSkills.filter(skill => 
      jobDescription.includes(skill.toLowerCase())
    );
    
    if (matchedSkills.length > 0) {
      matchReasons.push(`Your skills in ${matchedSkills.slice(0, 3).join(', ')} directly align with this role`);
    }
    
    // 基于优势生成理由
    if (userStrengths.length > 0) {
      matchReasons.push(`Your demonstrated strengths in ${userStrengths[0]} will be valuable here`);
    }
    
    // 基于职业目标生成理由
    if (careerGoals && careerGoals.length > 0) {
      const relevantGoal = careerGoals.find(goal => 
        jobDescription.includes(goal.toLowerCase().split(' ')[0])
      );
      if (relevantGoal) {
        matchReasons.push(`Aligns with your career goal: ${relevantGoal}`);
      }
    }
    
    // 生成成长机会
    if (skillGaps && skillGaps.length > 0) {
      growthOpportunities.push(`Opportunity to develop: ${skillGaps.slice(0, 2).join(', ')}`);
    }
    growthOpportunities.push(`Exposure to ${job.company}'s industry practices`);
    
    // 生成挑战
    if (skillGaps && skillGaps.length > 0) {
      challenges.push(`May need to quickly learn: ${skillGaps[0]}`);
    }
    
    // 计算匹配分数
    let matchScore = 50; // 基础分
    matchScore += matchedSkills.length * 10; // 每个匹配技能 +10
    matchScore += userStrengths.length * 5;  // 每个优势 +5
    matchScore = Math.min(100, matchScore);  // 最高 100
    
    return {
      success: true,
      data: {
        matchScore,
        matchReasons: matchReasons.length > 0 ? matchReasons : ['General fit based on your background'],
        growthOpportunities,
        challenges: challenges.length > 0 ? challenges : ['Standard learning curve for new role'],
      },
      executionTimeMs: 30,
    };
  },
};

// ==================== Agent 实现 ====================

export class CareerPathMatchingAgent extends StreamingBaseReActAgent<CareerPathInput, CareerPathOutput> {
  constructor() {
    const config: ReActConfig = {
      moduleName: 'career_path_matching',
      thinking: {
        maxSteps: 8,
        adaptiveDepth: true,
      },
      timeBudget: {
        maxTimeMs: 30000,  // 30 秒总时间
        priority: 'quality',
        warningThresholdMs: 25000,
      },
      quality: {
        minScore: 0.6,
        earlyStopOnQuality: true,
      },
      tools: [
        analyzeCareerTrajectoryTool,
        extractCareerGoalsTool,
        identifySkillGapsTool,
        searchAlignedPositionsTool,
        generateCareerFitReasoningTool,
      ],
    };
    super(config);
  }

  protected getAgentDescription(): string {
    return '正在分析您的职业路径，匹配最适合的职位...';
  }

  protected async getInitialContext(input: CareerPathInput): Promise<Record<string, unknown>> {
    return {
      userBackground: input.userBackground,
      performance: input.interviewPerformance,
      language: input.language,
    };
  }

  protected buildSystemPrompt(input: CareerPathInput, _context: Record<string, unknown>): string {
    const { userBackground, interviewPerformance, language } = input;
    
    const languageInstruction = language === 'zh' 
      ? '请用中文回复。'
      : 'Please respond in English.';
    
    return `You are a Career Path Matching Agent. Your goal is to analyze the user's career trajectory and find the best matching job opportunities.

${languageInstruction}

## User Background
- Current Role: ${userBackground.currentRole || 'Not specified'}
- Years of Experience: ${userBackground.yearsOfExperience || 'Not specified'}
- Skills: ${userBackground.skills.join(', ')}
- Education: ${userBackground.education || 'Not specified'}
- Previous Roles: ${userBackground.previousRoles?.join(' → ') || 'Not specified'}
- Target Role: ${userBackground.targetRole || 'Not specified'}
- Target Industry: ${userBackground.targetIndustry || 'Not specified'}
- Preferred Location: ${userBackground.preferredLocation || 'Any'}
- Work Mode Preference: ${userBackground.preferredWorkMode || 'Any'}

## Interview Performance
- Strengths: ${interviewPerformance.strengths.join(', ')}
- Areas for Improvement: ${interviewPerformance.weaknesses.join(', ')}
- Overall Score: ${interviewPerformance.overallScore || 'Not available'}

## Your Task
1. First, analyze the user's career trajectory using analyze_career_trajectory
2. Extract their career goals using extract_career_goals
3. Identify skill gaps using identify_skill_gaps
4. Search for aligned positions using search_aligned_positions (use dynamic keywords based on your analysis)
5. For each promising job, generate detailed fit reasoning using generate_career_fit_reasoning

## Important Guidelines
- DO NOT use hardcoded matching percentages
- Generate personalized match scores based on actual skill alignment
- Consider both current capabilities and growth potential
- Provide actionable insights, not generic advice

## Output Format
Your Final Answer must be a valid JSON object with this structure:
{
  "careerAnalysis": {
    "currentStage": "...",
    "trajectory": "...",
    "goals": ["..."],
    "skillGaps": ["..."]
  },
  "recommendations": [
    {
      "jobId": "...",
      "title": "...",
      "company": "...",
      "location": "...",
      "matchScore": 85,
      "matchReasons": ["..."],
      "growthOpportunities": ["..."],
      "challenges": ["..."],
      "applyUrl": "..."
    }
  ],
  "careerAdvice": "..."
}`;
  }

  protected parseOutput(thought: string, _trace: ReActTrace): CareerPathOutput | null {
    try {
      // 尝试从思考中提取 JSON
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // 验证必要字段
        if (parsed.careerAnalysis && parsed.recommendations && Array.isArray(parsed.recommendations)) {
          return parsed as CareerPathOutput;
        }
      }
      
      // 如果无法解析，返回默认结构
      console.warn('[CareerPathMatchingAgent] Could not parse output, returning default');
      return null;
    } catch (error) {
      console.error('[CareerPathMatchingAgent] Parse error:', error);
      return null;
    }
  }
}

// ==================== 导出工厂函数 ====================

export function createCareerPathMatchingAgent(): CareerPathMatchingAgent {
  return new CareerPathMatchingAgent();
}
