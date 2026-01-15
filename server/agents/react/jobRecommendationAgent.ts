/**
 * Job Recommendation Agent (ReAct)
 * 
 * 基于用户在话题练习中展示的能力，推荐真实的职位
 * 
 * 工具集：
 * 1. search_linkedin_jobs - 搜索 LinkedIn 真实职位
 * 2. search_glassdoor_company - 获取公司面试风格/文化
 * 3. analyze_skill_match - 分析用户技能与职位要求匹配度
 * 4. generate_recommendation_reason - 生成个性化推荐理由
 */

import { BaseReActAgent } from './baseAgent';
import { Tool, ReActTrace, ReActConfig, ToolResult } from './types';
import { scrapeLinkedInJobs } from '../../apify';
import { searchGlassdoor } from '../searchAgent';
import { invokeLLM } from '../../_core/llm';
import type { TopicContext, CollectedInfoPoint } from '../interviewModes/types';

/**
 * Agent 输入
 */
export interface JobRecommendationInput {
  /** 用户简历摘要（如果有） */
  resumeSummary?: string;
  /** 话题练习中收集的信息点 */
  collectedInfo: CollectedInfoPoint[];
  /** 完成的话题上下文 */
  completedTopics: TopicContext[];
  /** 用户目标职位 */
  targetPosition: string;
  /** 用户偏好的工作地点 */
  preferredLocation?: string;
  /** 用户偏好的工作类型 */
  preferredWorkType?: 'remote' | 'onsite' | 'hybrid';
}

/**
 * 推荐的职位
 */
export interface RecommendedJob {
  /** 职位 ID */
  jobId: string;
  /** 职位标题 */
  title: string;
  /** 公司名称 */
  company: string;
  /** 工作地点 */
  location: string;
  /** 职位描述摘要 */
  descriptionSummary: string;
  /** LinkedIn URL */
  linkedinUrl: string;
  /** 匹配度 (0-100) */
  matchScore: number;
  /** 个性化推荐理由 */
  recommendationReasons: string[];
  /** 用户展示的匹配技能 */
  matchedSkills: string[];
  /** 需要提升的技能 */
  skillGaps: string[];
  /** 公司面试风格（如果有） */
  interviewStyle?: string;
  /** 申请建议 */
  applicationTips: string[];
}

/**
 * Agent 输出
 */
export interface JobRecommendationOutput {
  /** 推荐的职位列表 */
  recommendations: RecommendedJob[];
  /** 整体分析 */
  overallAnalysis: string;
  /** 用户核心优势 */
  coreStrengths: string[];
  /** 建议提升的方向 */
  improvementAreas: string[];
}

/**
 * 创建 LinkedIn Jobs 搜索工具
 */
function createSearchLinkedInJobsTool(): Tool {
  return {
    name: 'search_linkedin_jobs',
    description: '搜索 LinkedIn 上的真实职位。使用此工具获取与用户目标职位相关的实际职位列表。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '职位标题关键词，如 "Software Engineer"、"Product Manager"'
        },
        location: {
          type: 'string',
          description: '工作地点，如 "San Francisco"、"Remote"、"United States"'
        },
        workType: {
          type: 'string',
          description: '工作类型：onsite（现场）、remote（远程）、hybrid（混合）'
        },
        maxResults: {
          type: 'string',
          description: '最大返回结果数，默认 10'
        }
      },
      required: ['title', 'location']
    },
    estimatedTimeMs: 30000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const jobs = await scrapeLinkedInJobs({
          title: String(params.title),
          location: String(params.location || 'United States'),
          workType: params.workType as 'onsite' | 'remote' | 'hybrid' | undefined,
          rows: Number(params.maxResults) || 10
        });
        
        // 如果没有结果，返回成功但带有空数组（不是失败）
        if (!jobs || jobs.length === 0) {
          console.log('[search_linkedin_jobs] No jobs found, returning empty result');
          return {
            success: true,
            data: { totalFound: 0, jobs: [], message: 'No jobs found for this search criteria. Try different keywords.' },
            executionTimeMs: Date.now() - startTime
          };
        }
        
        const simplifiedJobs = jobs.slice(0, 10).map(job => ({
          jobId: job.jobId,
          title: job.title,
          company: job.company,
          location: job.location,
          description: (job.description || '').slice(0, 500) + '...',
          linkedinUrl: job.linkedinUrl,
          salary: job.salary,
          workType: job.workType,
          experienceLevel: job.experienceLevel
        }));
        
        return {
          success: true,
          data: { totalFound: jobs.length, jobs: simplifiedJobs },
          executionTimeMs: Date.now() - startTime
        };
      } catch (error) {
        // 网络错误时返回成功但带有空结果，而不是失败
        // 这样可以让 Agent 继续使用其他工具或回退策略
        console.error('[search_linkedin_jobs] Error (returning empty result):', error instanceof Error ? error.message : error);
        return {
          success: true,
          data: { totalFound: 0, jobs: [], message: 'LinkedIn search temporarily unavailable. Please try again later.' },
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * 创建 Glassdoor 公司搜索工具
 */
function createSearchGlassdoorTool(): Tool {
  return {
    name: 'search_glassdoor_company',
    description: '搜索 Glassdoor 上的公司面试信息，了解公司的面试风格和文化。',
    parameters: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: '公司名称，如 "Google"、"Meta"、"Amazon"'
        },
        maxResults: {
          type: 'string',
          description: '最大返回结果数，默认 5'
        }
      },
      required: ['company']
    },
    estimatedTimeMs: 45000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const results = await searchGlassdoor(
          String(params.company),
          Number(params.maxResults) || 5
        );
        
        const summary = results.slice(0, 5).map(r => ({
          title: r.title,
          difficulty: r.metadata?.difficulty,
          experience: r.metadata?.experience,
          outcome: r.metadata?.outcome,
          questions: r.metadata?.questions,
          content: r.content.slice(0, 300) + '...'
        }));
        
        return {
          success: true,
          data: { company: params.company, interviewCount: results.length, interviews: summary },
          executionTimeMs: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Glassdoor search failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * 创建技能匹配分析工具
 */
function createAnalyzeSkillMatchTool(): Tool {
  return {
    name: 'analyze_skill_match',
    description: '分析用户展示的技能与职位要求的匹配度。输入用户技能和职位描述，返回匹配分析。',
    parameters: {
      type: 'object',
      properties: {
        userSkills: {
          type: 'string',
          description: '用户展示的技能列表（逗号分隔）'
        },
        userExperiences: {
          type: 'string',
          description: '用户的项目经验摘要（分号分隔）'
        },
        jobDescription: {
          type: 'string',
          description: '职位描述'
        },
        jobTitle: {
          type: 'string',
          description: '职位标题'
        }
      },
      required: ['userSkills', 'jobDescription', 'jobTitle']
    },
    estimatedTimeMs: 5000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const prompt = `分析用户技能与职位要求的匹配度。

## 用户技能
${params.userSkills}

## 用户经验
${params.userExperiences || '未提供'}

## 职位: ${params.jobTitle}
${params.jobDescription}

请返回 JSON：
{
  "matchScore": 0-100,
  "matchedSkills": ["匹配的技能"],
  "skillGaps": ["缺少的技能"],
  "analysis": "匹配分析"
}`;

        const response = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'skill_match_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  matchScore: { type: 'number' },
                  matchedSkills: { type: 'array', items: { type: 'string' } },
                  skillGaps: { type: 'array', items: { type: 'string' } },
                  analysis: { type: 'string' }
                },
                required: ['matchScore', 'matchedSkills', 'skillGaps', 'analysis'],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices[0]?.message?.content;
        if (content && typeof content === 'string') {
          return {
            success: true,
            data: JSON.parse(content),
            executionTimeMs: Date.now() - startTime
          };
        }
        
        return { success: false, error: 'Failed to parse LLM response', executionTimeMs: Date.now() - startTime };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Skill match analysis failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * 创建推荐理由生成工具
 */
function createGenerateRecommendationReasonTool(): Tool {
  return {
    name: 'generate_recommendation_reason',
    description: '基于用户在面试中展示的具体经历，生成个性化的职位推荐理由。',
    parameters: {
      type: 'object',
      properties: {
        userHighlights: {
          type: 'string',
          description: '用户在面试中展示的亮点（具体项目、成就、技能），逗号分隔'
        },
        jobTitle: {
          type: 'string',
          description: '职位标题'
        },
        company: {
          type: 'string',
          description: '公司名称'
        },
        jobHighlights: {
          type: 'string',
          description: '职位的关键要求或亮点，逗号分隔'
        }
      },
      required: ['userHighlights', 'jobTitle', 'company']
    },
    estimatedTimeMs: 3000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const prompt = `为用户生成个性化的职位推荐理由。

## 用户亮点
${params.userHighlights}

## 推荐职位
${params.company} - ${params.jobTitle}

## 职位亮点
${params.jobHighlights || '未提供'}

请生成 2-3 条个性化推荐理由，要具体引用用户的经历。

返回 JSON：
{
  "reasons": ["推荐理由1", "推荐理由2"],
  "applicationTips": ["申请建议1", "申请建议2"]
}`;

        const response = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'recommendation_reasons',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  reasons: { type: 'array', items: { type: 'string' } },
                  applicationTips: { type: 'array', items: { type: 'string' } }
                },
                required: ['reasons', 'applicationTips'],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices[0]?.message?.content;
        if (content && typeof content === 'string') {
          return {
            success: true,
            data: JSON.parse(content),
            executionTimeMs: Date.now() - startTime
          };
        }
        
        return { success: false, error: 'Failed to parse LLM response', executionTimeMs: Date.now() - startTime };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Recommendation reason generation failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * Job Recommendation Agent
 */
export class JobRecommendationAgent extends BaseReActAgent<JobRecommendationInput, JobRecommendationOutput> {
  constructor() {
    const config: ReActConfig = {
      moduleName: 'JobRecommendationAgent',
      thinking: {
        maxSteps: 10,
        adaptiveDepth: true
      },
      timeBudget: {
        maxTimeMs: 120000,
        priority: 'quality',
        warningThresholdMs: 90000
      },
      quality: {
        minScore: 0.6,
        earlyStopOnQuality: true
      },
      tools: [
        createSearchLinkedInJobsTool(),
        createSearchGlassdoorTool(),
        createAnalyzeSkillMatchTool(),
        createGenerateRecommendationReasonTool()
      ]
    };
    super(config);
  }

  /**
   * 从用户目标职位和简历中提取搜索关键词
   */
  private extractSearchKeywords(input: JobRecommendationInput): {
    primaryTitle: string;
    alternativeTitles: string[];
    coreSkills: string[];
    jobFunction: string;
  } {
    console.log('[JobRecommendationAgent] Extracting search keywords from:', input.targetPosition);
    
    // 从目标职位提取主要职位名称
    const targetPosition = input.targetPosition.toLowerCase();
    
    // 识别职能类型
    let jobFunction = 'general';
    const functionPatterns: Record<string, string[]> = {
      'product_marketing': ['product marketing', 'pmm', 'gtm', 'go-to-market', '产品市场', '产品营销'],
      'product_management': ['product manager', 'pm', '产品经理', 'apm', 'associate product'],
      'software_engineering': ['software engineer', 'swe', 'developer', 'backend', 'frontend', 'full-stack', '开发', '工程师', '后端', '前端'],
      'data_science': ['data scientist', 'data analyst', 'machine learning', 'ml engineer', '数据分析', '数据科学'],
      'design': ['designer', 'ux', 'ui', '设计师', 'product design'],
      'marketing': ['marketing', '市场', 'growth', 'brand', 'content'],
      'sales': ['sales', 'account', 'business development', 'bd', '销售'],
      'operations': ['operations', 'ops', '运营', 'strategy']
    };
    
    for (const [func, patterns] of Object.entries(functionPatterns)) {
      if (patterns.some(p => targetPosition.includes(p))) {
        jobFunction = func;
        break;
      }
    }
    
    // 从简历中提取核心技能
    const coreSkills: string[] = [];
    if (input.resumeSummary) {
      // 提取简历中的技能关键词
      const skillPatterns = [
        /(?:skills?|expertise|proficient in|experienced in)[:\s]*([^.\n]+)/gi,
        /(?:GTM|SaaS|SQL|Python|Java|JavaScript|React|Node|AWS|GCP|Figma|Tableau|Excel)/gi
      ];
      for (const pattern of skillPatterns) {
        const matches = input.resumeSummary.match(pattern);
        if (matches) {
          coreSkills.push(...matches.slice(0, 5));
        }
      }
    }
    
    // 从收集的信息点中提取技能
    const skillClaims = input.collectedInfo
      .filter(info => info.type === 'skill_claim')
      .map(info => info.summary);
    coreSkills.push(...skillClaims);
    
    // 生成替代职位名称
    const alternativeTitles: string[] = [];
    const titleVariants: Record<string, string[]> = {
      'product_marketing': ['Product Marketing Manager', 'PMM', 'GTM Manager', 'Marketing Manager'],
      'product_management': ['Product Manager', 'Associate Product Manager', 'Senior PM', 'Technical PM'],
      'software_engineering': ['Software Engineer', 'Backend Engineer', 'Frontend Engineer', 'Full-Stack Developer'],
      'data_science': ['Data Scientist', 'Data Analyst', 'ML Engineer', 'Analytics Manager'],
      'design': ['Product Designer', 'UX Designer', 'UI Designer', 'Design Lead'],
      'marketing': ['Marketing Manager', 'Growth Manager', 'Brand Manager', 'Content Strategist'],
      'sales': ['Account Executive', 'Sales Manager', 'Business Development', 'Sales Representative'],
      'operations': ['Operations Manager', 'Strategy Manager', 'Business Operations', 'Program Manager']
    };
    
    if (titleVariants[jobFunction]) {
      alternativeTitles.push(...titleVariants[jobFunction]);
    }
    
    // 主要搜索标题：优先使用用户目标职位中的职位名称
    let primaryTitle = input.targetPosition;
    // 移除公司名称，只保留职位
    const atIndex = primaryTitle.toLowerCase().indexOf(' at ');
    if (atIndex > 0) {
      primaryTitle = primaryTitle.substring(0, atIndex).trim();
    }
    
    const result = {
      primaryTitle,
      alternativeTitles: Array.from(new Set(alternativeTitles)).slice(0, 3),
      coreSkills: Array.from(new Set(coreSkills)).slice(0, 5),
      jobFunction
    };
    
    console.log('[JobRecommendationAgent] Extracted keywords:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * 构建系统 Prompt
   */
  protected buildSystemPrompt(input: JobRecommendationInput, _context: Record<string, unknown>): string {
    const skillsSummary = input.collectedInfo
      .filter(info => info.type === 'skill_claim')
      .map(info => info.summary)
      .join(', ');

    const experiencesSummary = input.collectedInfo
      .filter(info => info.type === 'project_experience' || info.type === 'challenge_solution')
      .map(info => info.summary)
      .join('; ');

    const quantifiedResults = input.collectedInfo
      .filter(info => info.type === 'quantified_result')
      .map(info => info.summary)
      .join('; ');

    // 提取搜索关键词
    const searchKeywords = this.extractSearchKeywords(input);

    return `你是 UHired 的职位推荐专家。基于用户在面试练习中展示的能力，推荐真实的、匹配的职位。

## 用户信息

### 目标职位
${input.targetPosition}

### 职能类型
${searchKeywords.jobFunction}

### 推荐搜索关键词
- 主要职位: ${searchKeywords.primaryTitle}
- 替代职位: ${searchKeywords.alternativeTitles.join(', ') || '无'}
- 核心技能: ${searchKeywords.coreSkills.join(', ') || '待分析'}

### 偏好
- 工作地点: ${input.preferredLocation || '未指定'}
- 工作类型: ${input.preferredWorkType || '未指定'}

### 用户简历摘要
${input.resumeSummary || '未提供'}

### 面试中展示的技能
${skillsSummary || '待分析'}

### 面试中展示的项目经验
${experiencesSummary || '待分析'}

### 量化成果
${quantifiedResults || '待分析'}

## 重要约束

**必须搜索与用户职能类型匹配的职位！**
- 用户的职能类型是: ${searchKeywords.jobFunction}
- 搜索时必须使用: "${searchKeywords.primaryTitle}" 或相关替代职位
- 绝对不要搜索不相关的职能（如 PMM 用户不要搜索 Software Engineer）

## 你的任务

1. 首先，使用 search_linkedin_jobs 搜索与用户目标职位相关的真实职位
   - **必须使用 "${searchKeywords.primaryTitle}" 作为搜索关键词**
   - 如果结果不足，可以尝试替代职位: ${searchKeywords.alternativeTitles.join(', ') || searchKeywords.primaryTitle}
2. 对于找到的职位，使用 analyze_skill_match 分析用户技能与职位的匹配度
3. 对于匹配度高的职位（>60%），使用 search_glassdoor_company 了解公司面试风格
4. 使用 generate_recommendation_reason 为每个推荐职位生成个性化理由
5. 最终输出 3-5 个推荐职位，按匹配度排序

## 输出要求

最终答案必须是 JSON 格式：
{
  "recommendations": [
    {
      "jobId": "职位ID",
      "title": "职位标题",
      "company": "公司名称",
      "location": "工作地点",
      "descriptionSummary": "职位描述摘要",
      "linkedinUrl": "LinkedIn链接",
      "matchScore": 85,
      "recommendationReasons": ["个性化推荐理由1", "理由2"],
      "matchedSkills": ["匹配的技能"],
      "skillGaps": ["需要提升的技能"],
      "interviewStyle": "公司面试风格（如果有）",
      "applicationTips": ["申请建议"]
    }
  ],
  "overallAnalysis": "整体分析",
  "coreStrengths": ["用户核心优势"],
  "improvementAreas": ["建议提升方向"]
}`;
  }

  /**
   * 解析最终输出
   */
  protected parseOutput(thought: string, trace: ReActTrace): JobRecommendationOutput | null {
    // 尝试从 thought 中解析 JSON
    try {
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          return {
            recommendations: parsed.recommendations,
            overallAnalysis: parsed.overallAnalysis || '基于您在面试中展示的能力，我们为您推荐了以上职位。',
            coreStrengths: parsed.coreStrengths || [],
            improvementAreas: parsed.improvementAreas || []
          };
        }
      }
    } catch (error) {
      console.error('[JobRecommendationAgent] Failed to parse output from thought:', error);
    }
    
    // 如果 thought 解析失败，尝试从 trace 中提取工具结果构建输出
    try {
      const rawJobs: Array<{
        jobId?: string;
        id?: string;
        title: string;
        company: string;
        location?: string;
        description?: string;
        descriptionSummary?: string;
        linkedinUrl?: string;
        url?: string;
      }> = [];
      
      for (const step of trace.steps) {
        if (step.observation) {
          try {
            const obs = JSON.parse(step.observation);
            // 从 LinkedIn 搜索结果中提取职位
            if (obs.jobs && Array.isArray(obs.jobs)) {
              for (const job of obs.jobs) {
                if (job.title && job.company) {
                  rawJobs.push(job);
                }
              }
            }
            // 也检查 data.jobs 结构（工具返回的格式）
            if (obs.data?.jobs && Array.isArray(obs.data.jobs)) {
              for (const job of obs.data.jobs) {
                if (job.title && job.company) {
                  rawJobs.push(job);
                }
              }
            }
          } catch {
            // 忽略解析失败的 observation
          }
        }
      }
      
      if (rawJobs.length > 0) {
        console.log(`[JobRecommendationAgent] Found ${rawJobs.length} raw jobs from trace, will enhance with LLM`);
        // 标记需要 LLM 增强，返回带有 _needsEnhancement 标记的结果
        const recommendations: RecommendedJob[] = rawJobs.slice(0, 5).map(job => ({
          jobId: job.jobId || job.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: job.title,
          company: job.company,
          location: job.location || 'United States',
          descriptionSummary: job.description || job.descriptionSummary || '',
          linkedinUrl: job.linkedinUrl || job.url || '',
          matchScore: 75,
          recommendationReasons: ['_NEEDS_ENHANCEMENT_'],
          matchedSkills: [],
          skillGaps: [],
          applicationTips: []
        }));
        
        return {
          recommendations,
          overallAnalysis: '_NEEDS_ENHANCEMENT_',
          coreStrengths: [],
          improvementAreas: []
        };
      }
    } catch (error) {
      console.error('[JobRecommendationAgent] Failed to construct output from trace:', error);
    }
    
    return null;
  }

  /**
   * 获取初始上下文
   */
  protected async getInitialContext(input: JobRecommendationInput): Promise<Record<string, unknown>> {
    const skills = input.collectedInfo
      .filter(info => info.type === 'skill_claim')
      .map(info => info.summary);

    const experiences = input.collectedInfo
      .filter(info => info.type === 'project_experience')
      .map(info => info.summary);

    return {
      userSkills: skills,
      userExperiences: experiences,
      targetPosition: input.targetPosition
    };
  }
}

/**
 * 使用强制 JSON 格式的 LLM 调用增强职位推荐
 */
async function enhanceRecommendationsWithLLM(
  rawOutput: JobRecommendationOutput,
  input: JobRecommendationInput
): Promise<JobRecommendationOutput> {
  // 检查是否需要增强
  const needsEnhancement = rawOutput.overallAnalysis === '_NEEDS_ENHANCEMENT_' ||
    rawOutput.recommendations.some(r => r.recommendationReasons.includes('_NEEDS_ENHANCEMENT_'));
  
  if (!needsEnhancement) {
    return rawOutput;
  }
  
  console.log('[JobRecommendationAgent] Enhancing recommendations with structured LLM output');
  
  // 构建用户上下文
  const skillsSummary = input.collectedInfo
    .filter(info => info.type === 'skill_claim')
    .map(info => info.summary)
    .join(', ');
  
  const experiencesSummary = input.collectedInfo
    .filter(info => info.type === 'project_experience' || info.type === 'challenge_solution')
    .map(info => info.summary)
    .join('; ');
  
  const quantifiedResults = input.collectedInfo
    .filter(info => info.type === 'quantified_result')
    .map(info => info.summary)
    .join('; ');
  
  // 构建职位列表
  const jobsList = rawOutput.recommendations.map((job, i) => 
    `${i + 1}. ${job.title} at ${job.company} (${job.location})\n   描述: ${job.descriptionSummary?.slice(0, 200) || '无'}`
  ).join('\n');
  
  const prompt = `基于用户在面试中展示的能力，为以下职位生成个性化的推荐理由和分析。

## 用户目标职位
${input.targetPosition}

## 用户展示的技能
${skillsSummary || '未提供'}

## 用户的项目经验
${experiencesSummary || '未提供'}

## 用户的量化成果
${quantifiedResults || '未提供'}

## 用户简历摘要
${input.resumeSummary?.slice(0, 500) || '未提供'}

## 待分析的职位
${jobsList}

请为每个职位生成：
1. 匹配度分数 (60-95)
2. 2-3 条个性化推荐理由（基于用户具体经历）
3. 匹配的技能列表
4. 需要提升的技能
5. 申请建议

同时提供整体分析、用户核心优势和建议提升方向。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'enhanced_recommendations',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'number', description: '职位序号 (1-5)' },
                    matchScore: { type: 'number', description: '匹配度分数 (60-95)' },
                    recommendationReasons: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '个性化推荐理由 (2-3条)'
                    },
                    matchedSkills: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '匹配的技能'
                    },
                    skillGaps: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '需要提升的技能'
                    },
                    applicationTips: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: '申请建议'
                    }
                  },
                  required: ['index', 'matchScore', 'recommendationReasons', 'matchedSkills', 'skillGaps', 'applicationTips'],
                  additionalProperties: false
                }
              },
              overallAnalysis: { type: 'string', description: '整体分析' },
              coreStrengths: { 
                type: 'array', 
                items: { type: 'string' },
                description: '用户核心优势'
              },
              improvementAreas: { 
                type: 'array', 
                items: { type: 'string' },
                description: '建议提升方向'
              }
            },
            required: ['recommendations', 'overallAnalysis', 'coreStrengths', 'improvementAreas'],
            additionalProperties: false
          }
        }
      }
    });
    
    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const enhanced = JSON.parse(content);
      
      // 合并增强结果到原始推荐
      const enhancedRecommendations = rawOutput.recommendations.map((job, i) => {
        const enhancement = enhanced.recommendations.find((e: { index: number }) => e.index === i + 1);
        if (enhancement) {
          return {
            ...job,
            matchScore: enhancement.matchScore,
            recommendationReasons: enhancement.recommendationReasons,
            matchedSkills: enhancement.matchedSkills,
            skillGaps: enhancement.skillGaps,
            applicationTips: enhancement.applicationTips
          };
        }
        return job;
      });
      
      console.log('[JobRecommendationAgent] Successfully enhanced recommendations with LLM');
      
      return {
        recommendations: enhancedRecommendations,
        overallAnalysis: enhanced.overallAnalysis,
        coreStrengths: enhanced.coreStrengths,
        improvementAreas: enhanced.improvementAreas
      };
    }
  } catch (error) {
    console.error('[JobRecommendationAgent] Failed to enhance with LLM:', error);
  }
  
  // 如果 LLM 增强失败，返回基本的推荐（清除标记）
  return {
    ...rawOutput,
    overallAnalysis: '基于您的目标职位，我们为您找到了以上相关职位。',
    recommendations: rawOutput.recommendations.map(r => ({
      ...r,
      recommendationReasons: r.recommendationReasons.filter(reason => reason !== '_NEEDS_ENHANCEMENT_')
    }))
  };
}

/**
 * 快捷函数：执行职位推荐
 */
export async function recommendJobs(input: JobRecommendationInput): Promise<JobRecommendationOutput> {
  try {
    const agent = new JobRecommendationAgent();
    const result = await agent.execute(input);
    
    if (result.success && result.output) {
      // 检查是否需要 LLM 增强
      const enhancedOutput = await enhanceRecommendationsWithLLM(result.output, input);
      return enhancedOutput;
    }
    
    console.error('[JobRecommendationAgent] Failed:', result.error);
    return {
      recommendations: [],
      overallAnalysis: '抱歉，暂时无法生成职位推荐。请稍后再试。',
      coreStrengths: [],
      improvementAreas: []
    };
  } catch (error) {
    // 捕获所有未处理的异常，确保不会导致进程崩溃
    console.error('[JobRecommendationAgent] Uncaught error:', error instanceof Error ? error.message : error);
    return {
      recommendations: [],
      overallAnalysis: '抱歉，职位推荐服务暂时不可用。请稍后再试。',
      coreStrengths: [],
      improvementAreas: []
    };
  }
}
