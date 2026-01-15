/**
 * Feedback Generation Agent (ReAct)
 * 
 * 基于用户在话题练习中的表现，生成深度、个性化的反馈
 * 
 * 工具集：
 * 1. analyze_user_background - 分析用户背景和职能类型
 * 2. identify_key_moments - 从对话中识别关键信息点和亮点
 * 3. search_industry_standards - 搜索该职能的面试标准和最佳实践
 * 4. generate_specific_feedback - 基于具体回答生成针对性反馈
 */

import { BaseReActAgent } from './baseAgent';
import { Tool, ReActTrace, ReActConfig, ToolResult } from './types';
import { searchGlassdoor } from '../searchAgent';
import { invokeLLM } from '../../_core/llm';
import type { TopicContext, CollectedInfoPoint } from '../interviewModes/types';

/**
 * Agent 输入
 */
export interface FeedbackGenerationInput {
  /** 用户简历摘要（如果有） */
  resumeSummary?: string;
  /** 话题练习中收集的信息点 */
  collectedInfo: CollectedInfoPoint[];
  /** 完成的话题上下文 */
  completedTopics: TopicContext[];
  /** 用户目标职位 */
  targetPosition: string;
  /** 对话历史 */
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * 反馈维度
 */
export interface FeedbackDimension {
  /** 维度名称 */
  name: string;
  /** 评分 (1-10) */
  score: number;
  /** 具体反馈 */
  feedback: string;
  /** 用户回答中的具体引用 */
  userQuote?: string;
  /** 改进建议 */
  improvement: string;
}

/**
 * Agent 输出
 */
export interface FeedbackGenerationOutput {
  /** 用户职能类型 */
  jobFunction: string;
  /** 整体评价 */
  overallAssessment: string;
  /** 整体评分 (1-10) */
  overallScore: number;
  /** 各维度反馈 */
  dimensions: FeedbackDimension[];
  /** 核心优势 */
  strengths: string[];
  /** 需要改进的地方 */
  improvements: string[];
  /** 具体行动建议 */
  actionItems: string[];
}

/**
 * 创建用户背景分析工具
 */
function createAnalyzeUserBackgroundTool(): Tool {
  return {
    name: 'analyze_user_background',
    description: '分析用户的背景和职能类型，确定应该关注的面试评估维度。',
    parameters: {
      type: 'object',
      properties: {
        resumeSummary: {
          type: 'string',
          description: '用户简历摘要'
        },
        targetPosition: {
          type: 'string',
          description: '用户目标职位'
        },
        collectedSkills: {
          type: 'string',
          description: '用户在面试中展示的技能（逗号分隔）'
        }
      },
      required: ['targetPosition']
    },
    estimatedTimeMs: 5000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const prompt = `分析用户背景，确定职能类型和评估维度。

## 用户目标职位
${params.targetPosition}

## 用户简历摘要
${params.resumeSummary || '未提供'}

## 用户展示的技能
${params.collectedSkills || '未提供'}

请返回 JSON：
{
  "jobFunction": "职能类型（如 product_marketing, software_engineering, product_management 等）",
  "seniorityLevel": "级别（junior, mid, senior, lead）",
  "evaluationDimensions": [
    {
      "name": "维度名称",
      "description": "该维度在此职能中的重要性说明",
      "weight": 0.0-1.0
    }
  ],
  "industryContext": "行业背景说明"
}`;

        const response = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'user_background_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  jobFunction: { type: 'string' },
                  seniorityLevel: { type: 'string' },
                  evaluationDimensions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        weight: { type: 'number' }
                      },
                      required: ['name', 'description', 'weight'],
                      additionalProperties: false
                    }
                  },
                  industryContext: { type: 'string' }
                },
                required: ['jobFunction', 'seniorityLevel', 'evaluationDimensions', 'industryContext'],
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
          error: error instanceof Error ? error.message : 'Background analysis failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * 创建关键时刻识别工具
 */
function createIdentifyKeyMomentsTool(): Tool {
  return {
    name: 'identify_key_moments',
    description: '从对话历史中识别用户回答的关键时刻、亮点和可改进点。',
    parameters: {
      type: 'object',
      properties: {
        conversationHistory: {
          type: 'string',
          description: '对话历史（JSON 格式）'
        },
        evaluationDimensions: {
          type: 'string',
          description: '评估维度列表（逗号分隔）'
        }
      },
      required: ['conversationHistory']
    },
    estimatedTimeMs: 8000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const prompt = `从对话历史中识别用户回答的关键时刻。

## 对话历史
${params.conversationHistory}

## 评估维度
${params.evaluationDimensions || '通用面试维度'}

请识别：
1. 用户回答中的亮点（具体引用原文）
2. 用户回答中的不足（具体引用原文）
3. 用户展示的核心能力
4. 用户可能遗漏的重要信息

返回 JSON：
{
  "highlights": [
    {
      "quote": "用户原话引用",
      "analysis": "为什么这是亮点",
      "dimension": "对应的评估维度"
    }
  ],
  "weaknesses": [
    {
      "quote": "用户原话引用（或描述缺失的内容）",
      "analysis": "为什么这是不足",
      "dimension": "对应的评估维度",
      "suggestion": "改进建议"
    }
  ],
  "demonstratedSkills": ["技能1", "技能2"],
  "missingElements": ["遗漏的重要信息1", "遗漏的重要信息2"]
}`;

        const response = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'key_moments_analysis',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  highlights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        quote: { type: 'string' },
                        analysis: { type: 'string' },
                        dimension: { type: 'string' }
                      },
                      required: ['quote', 'analysis', 'dimension'],
                      additionalProperties: false
                    }
                  },
                  weaknesses: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        quote: { type: 'string' },
                        analysis: { type: 'string' },
                        dimension: { type: 'string' },
                        suggestion: { type: 'string' }
                      },
                      required: ['quote', 'analysis', 'dimension', 'suggestion'],
                      additionalProperties: false
                    }
                  },
                  demonstratedSkills: { type: 'array', items: { type: 'string' } },
                  missingElements: { type: 'array', items: { type: 'string' } }
                },
                required: ['highlights', 'weaknesses', 'demonstratedSkills', 'missingElements'],
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
          error: error instanceof Error ? error.message : 'Key moments identification failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * 创建行业标准搜索工具
 */
function createSearchIndustryStandardsTool(): Tool {
  return {
    name: 'search_industry_standards',
    description: '搜索该职能的面试标准和最佳实践，了解顶级公司的面试评估标准。',
    parameters: {
      type: 'object',
      properties: {
        jobFunction: {
          type: 'string',
          description: '职能类型，如 "Product Marketing Manager"、"Software Engineer"'
        },
        targetCompany: {
          type: 'string',
          description: '目标公司（可选）'
        },
        maxResults: {
          type: 'string',
          description: '最大返回结果数，默认 5'
        }
      },
      required: ['jobFunction']
    },
    estimatedTimeMs: 45000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const searchQuery = params.targetCompany 
          ? `${params.jobFunction} ${params.targetCompany}`
          : String(params.jobFunction);
        
        const results = await searchGlassdoor(
          searchQuery,
          Number(params.maxResults) || 5
        );
        
        // 提取面试标准和评估要点
        const standards = results.slice(0, 5).map(r => ({
          source: r.title,
          difficulty: r.metadata?.difficulty,
          keyQuestions: r.metadata?.questions,
          evaluationCriteria: r.content.slice(0, 500)
        }));
        
        return {
          success: true,
          data: { 
            jobFunction: params.jobFunction,
            interviewCount: results.length, 
            standards 
          },
          executionTimeMs: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Industry standards search failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * 创建具体反馈生成工具
 */
function createGenerateSpecificFeedbackTool(): Tool {
  return {
    name: 'generate_specific_feedback',
    description: '基于用户的具体回答和行业标准，生成针对性的反馈和改进建议。',
    parameters: {
      type: 'object',
      properties: {
        dimension: {
          type: 'string',
          description: '评估维度名称'
        },
        userPerformance: {
          type: 'string',
          description: '用户在该维度的表现描述（包含具体引用）'
        },
        industryStandard: {
          type: 'string',
          description: '该维度的行业标准或最佳实践'
        },
        jobFunction: {
          type: 'string',
          description: '用户的职能类型'
        }
      },
      required: ['dimension', 'userPerformance', 'jobFunction']
    },
    estimatedTimeMs: 5000,
    execute: async (params: Record<string, unknown>): Promise<ToolResult> => {
      const startTime = Date.now();
      try {
        const prompt = `为用户生成针对性的面试反馈。

## 评估维度
${params.dimension}

## 用户职能
${params.jobFunction}

## 用户表现
${params.userPerformance}

## 行业标准
${params.industryStandard || '未提供'}

请生成具体、可操作的反馈：
1. 评分要基于用户的实际表现
2. 反馈要引用用户的具体回答
3. 改进建议要具体、可执行

返回 JSON：
{
  "score": 1-10,
  "feedback": "具体反馈，引用用户原话",
  "strength": "该维度的优势（如果有）",
  "improvement": "具体改进建议",
  "example": "示例回答或框架（可选）"
}`;

        const response = await invokeLLM({
          messages: [{ role: 'user', content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'specific_feedback',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  feedback: { type: 'string' },
                  strength: { type: 'string' },
                  improvement: { type: 'string' },
                  example: { type: 'string' }
                },
                required: ['score', 'feedback', 'strength', 'improvement', 'example'],
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
          error: error instanceof Error ? error.message : 'Feedback generation failed',
          executionTimeMs: Date.now() - startTime
        };
      }
    }
  };
}

/**
 * Feedback Generation Agent
 */
export class FeedbackGenerationAgent extends BaseReActAgent<FeedbackGenerationInput, FeedbackGenerationOutput> {
  constructor() {
    const config: ReActConfig = {
      moduleName: 'feedback_generation',
      thinking: {
        maxSteps: 8,
        adaptiveDepth: true
      },
      timeBudget: {
        maxTimeMs: 90000,
        priority: 'quality',
        warningThresholdMs: 60000
      },
      quality: {
        minScore: 0.6,
        earlyStopOnQuality: true
      },
      tools: [
        createAnalyzeUserBackgroundTool(),
        createIdentifyKeyMomentsTool(),
        createSearchIndustryStandardsTool(),
        createGenerateSpecificFeedbackTool()
      ]
    };
    super(config);
  }

  /**
   * 构建系统 Prompt
   */
  protected buildSystemPrompt(input: FeedbackGenerationInput, _context: Record<string, unknown>): string {
    const conversationSummary = input.conversationHistory
      .map(msg => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content.slice(0, 200)}...`)
      .join('\n');

    const collectedInfoSummary = input.collectedInfo
      .map(info => `- ${info.type}: ${info.summary}`)
      .join('\n');

    return `你是 UHired 的面试反馈专家。基于用户在话题练习中的表现，生成深度、个性化的反馈。

## 用户信息

### 目标职位
${input.targetPosition}

### 用户简历摘要
${input.resumeSummary || '未提供'}

### 收集的信息点
${collectedInfoSummary || '无'}

### 对话历史摘要
${conversationSummary}

## 你的任务

1. 首先，使用 analyze_user_background 分析用户背景，确定职能类型和评估维度
2. 使用 identify_key_moments 从对话中识别用户回答的亮点和不足
3. 使用 search_industry_standards 搜索该职能的面试标准（可选，如果时间允许）
4. 对于每个重要维度，使用 generate_specific_feedback 生成具体反馈

## 重要原则

1. **引用用户原话**：反馈必须引用用户的具体回答，不能泛泛而谈
2. **职能特定**：反馈要针对用户的职能类型，PMM 和 SWE 的评估标准不同
3. **可操作**：改进建议必须具体、可执行
4. **平衡**：既要指出优势，也要指出不足

## 输出要求

最终答案必须是 JSON 格式：
{
  "jobFunction": "用户职能类型",
  "overallAssessment": "整体评价（2-3句话）",
  "overallScore": 1-10,
  "dimensions": [
    {
      "name": "维度名称",
      "score": 1-10,
      "feedback": "具体反馈，引用用户原话",
      "userQuote": "用户原话引用",
      "improvement": "改进建议"
    }
  ],
  "strengths": ["核心优势1", "核心优势2"],
  "improvements": ["需要改进1", "需要改进2"],
  "actionItems": ["具体行动建议1", "具体行动建议2"]
}`;
  }

  /**
   * 解析最终输出
   */
  protected parseOutput(thought: string, trace: ReActTrace): FeedbackGenerationOutput | null {
    // 尝试从 thought 中解析 JSON
    try {
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.jobFunction && parsed.dimensions) {
          return {
            jobFunction: parsed.jobFunction,
            overallAssessment: parsed.overallAssessment || '基于您在面试中的表现，我们为您生成了以下反馈。',
            overallScore: parsed.overallScore || 7,
            dimensions: parsed.dimensions || [],
            strengths: parsed.strengths || [],
            improvements: parsed.improvements || [],
            actionItems: parsed.actionItems || []
          };
        }
      }
    } catch (error) {
      console.error('[FeedbackGenerationAgent] Failed to parse output from thought:', error);
    }
    
    // 如果 thought 解析失败，尝试从 trace 中构建输出
    try {
      const dimensions: FeedbackDimension[] = [];
      let jobFunction = 'general';
      const strengths: string[] = [];
      const improvements: string[] = [];
      
      for (const step of trace.steps) {
        if (step.observation) {
          try {
            const obs = JSON.parse(step.observation);
            
            // 从背景分析中提取职能类型
            if (obs.jobFunction) {
              jobFunction = obs.jobFunction;
            }
            
            // 从关键时刻中提取亮点和不足
            if (obs.highlights && Array.isArray(obs.highlights)) {
              for (const h of obs.highlights) {
                strengths.push(h.analysis);
              }
            }
            if (obs.weaknesses && Array.isArray(obs.weaknesses)) {
              for (const w of obs.weaknesses) {
                improvements.push(w.suggestion);
              }
            }
            
            // 从具体反馈中构建维度
            if (obs.score && obs.feedback) {
              dimensions.push({
                name: obs.dimension || '综合表现',
                score: obs.score,
                feedback: obs.feedback,
                improvement: obs.improvement || ''
              });
            }
          } catch {
            // 忽略解析失败的 observation
          }
        }
      }
      
      if (dimensions.length > 0 || strengths.length > 0) {
        console.log(`[FeedbackGenerationAgent] Constructed feedback from trace`);
        return {
          jobFunction,
          overallAssessment: '基于您在面试中的表现，我们为您生成了以下反馈。',
          overallScore: dimensions.length > 0 
            ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
            : 7,
          dimensions,
          strengths: strengths.slice(0, 3),
          improvements: improvements.slice(0, 3),
          actionItems: improvements.slice(0, 3).map(i => `改进: ${i}`)
        };
      }
    } catch (error) {
      console.error('[FeedbackGenerationAgent] Failed to construct output from trace:', error);
    }
    
    return null;
  }

  /**
   * 获取初始上下文
   */
  protected async getInitialContext(input: FeedbackGenerationInput): Promise<Record<string, unknown>> {
    return {
      targetPosition: input.targetPosition,
      topicCount: input.completedTopics.length,
      infoPointCount: input.collectedInfo.length
    };
  }
}

/**
 * 快捷函数：生成反馈
 */
export async function generateFeedback(input: FeedbackGenerationInput): Promise<FeedbackGenerationOutput> {
  const agent = new FeedbackGenerationAgent();
  const result = await agent.execute(input);
  
  if (result.success && result.output) {
    return result.output;
  }
  
  console.error('[FeedbackGenerationAgent] Failed:', result.error);
  return {
    jobFunction: 'general',
    overallAssessment: '抱歉，暂时无法生成详细反馈。请稍后再试。',
    overallScore: 5,
    dimensions: [],
    strengths: [],
    improvements: [],
    actionItems: []
  };
}
