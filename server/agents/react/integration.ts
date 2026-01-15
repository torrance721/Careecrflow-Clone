/**
 * ReAct Agent Integration
 * 
 * 将 ReAct Agent 集成到现有面试流程的适配器
 * 提供与原有接口兼容的函数
 */

import { 
  generateQuestionWithReAct, 
  generateQuestionsWithReAct,
  QuestionGenerationInput,
  GeneratedQuestion as ReActGeneratedQuestion,
} from './questionGenerationAgent';

import {
  generateHintWithReAct,
  HintInput,
  GeneratedHint,
} from './hintAgent';

import {
  decideNextQuestionWithReAct,
  NextQuestionInput,
  NextQuestionDecision,
} from './nextQuestionAgent';

import type { UserProfile, GeneratedQuestion, InterviewPlan } from '../interviewGenerator';
import type { HintRequest, HintResponse } from '../hintGenerator';
import type { NextQuestionContext, NextQuestionDecision as OriginalNextQuestionDecision } from '../nextQuestionGenerator';
import { getOrCreateKnowledgeBase } from '../knowledgeBaseService';

// ==================== 配置 ====================

interface IntegrationConfig {
  useReActForQuestions: boolean;
  useReActForHints: boolean;
  useReActForNextQuestion: boolean;
  fallbackToOriginal: boolean;
}

const defaultConfig: IntegrationConfig = {
  useReActForQuestions: true,
  useReActForHints: true,
  useReActForNextQuestion: true,
  fallbackToOriginal: true,
};

let currentConfig = { ...defaultConfig };

/**
 * 设置集成配置
 */
export function setIntegrationConfig(config: Partial<IntegrationConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 获取当前配置
 */
export function getIntegrationConfig(): IntegrationConfig {
  return { ...currentConfig };
}

// ==================== 问题生成集成 ====================

/**
 * 使用 ReAct Agent 生成面试计划（兼容原有接口）
 */
export async function generateInterviewPlanWithReAct(
  company: string,
  position: string,
  jobDescription: string,
  userProfile: UserProfile = {},
  options: {
    questionCount?: number;
    language?: 'en' | 'zh';
    focusAreas?: ('technical' | 'behavioral' | 'case')[];
    difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
    userId?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<InterviewPlan> {
  const {
    questionCount = 6,
    language = 'en',
    userId,
    forceRefresh = false,
  } = options;

  console.log(`[ReActIntegration] Generating interview plan for ${company} - ${position}`);

  // 获取知识库
  let knowledgeBaseId: number | undefined;
  let cacheHit = false;
  let interviewProcess;
  let companyTips: string[] = [];

  try {
    const result = await getOrCreateKnowledgeBase(company, position, {
      forceRefresh,
      userId,
      language,
    });
    
    knowledgeBaseId = result.knowledgeBase.id;
    cacheHit = result.cacheHit;
    interviewProcess = result.knowledgeBase.interviewProcess;
    companyTips = result.knowledgeBase.tips?.map(t => t.tip) || [];
  } catch (error) {
    console.error('[ReActIntegration] Error getting knowledge base:', error);
  }

  // 使用 ReAct Agent 生成问题
  const input: Omit<QuestionGenerationInput, 'questionNumber' | 'previousQuestions'> = {
    company,
    position,
    jobDescription,
    userProfile: {
      resumeSummary: userProfile.resumeSummary,
      skills: userProfile.skills,
      experience: userProfile.experience,
      yearsOfExperience: userProfile.experience ? extractYearsFromExperience(userProfile.experience) : undefined,
    },
    language,
  };

  const questions = await generateQuestionsWithReAct(input, questionCount);

  // 转换为原有格式
  const convertedQuestions: GeneratedQuestion[] = questions.map(q => ({
    question: q.question,
    type: q.type,
    category: q.category,
    difficulty: q.difficulty,
    source: q.source,
    hints: q.hints,
  }));

  return {
    company,
    position,
    totalQuestions: convertedQuestions.length,
    questions: convertedQuestions,
    interviewProcess: interviewProcess ? {
      rounds: interviewProcess.rounds,
      difficulty: interviewProcess.difficulty,
    } : undefined,
    companyTips,
    knowledgeBaseId,
    cacheHit,
  };
}

/**
 * 从经验描述中提取年数
 */
function extractYearsFromExperience(experience: string): number {
  const match = experience.match(/(\d+)\s*(年|years?)/i);
  return match ? parseInt(match[1], 10) : 0;
}

// ==================== Hint 生成集成 ====================

/**
 * 使用 ReAct Agent 生成提示（兼容原有接口）
 */
export async function generateHintWithReActAdapter(request: HintRequest): Promise<HintResponse> {
  const input: HintInput = {
    question: request.question,
    userResponse: request.userResponse,
    conversationHistory: request.conversationHistory.map(m => ({
      role: m.role,
      content: m.content,
    })),
    knowledgeBaseId: request.knowledgeBaseId,
    language: request.language,
    hintLevel: 1, // 默认方向提示
  };

  // 使用 HintAgent 获取完整结果（包含 trace）
  const { HintAgent } = await import('./hintAgent');
  const agent = new HintAgent();
  const agentResult = await agent.execute(input);

  if (!agentResult.success || !agentResult.output) {
    // 回退
    return {
      hint: request.language === 'zh'
        ? '试着用 STAR 方法来组织你的回答。'
        : 'Try using the STAR method to structure your answer.',
      reasoning: 'Fallback hint',
      hintType: 'structure',
    };
  }

  const result = agentResult.output;

  // 转换 hintType
  const hintTypeMap: Record<string, 'clarification' | 'structure' | 'example' | 'keyword' | 'approach'> = {
    direction: 'approach',
    framework: 'structure',
    specific: 'keyword',
    example: 'example',
  };

  return {
    hint: result.hint,
    reasoning: result.reasoning,
    hintType: hintTypeMap[result.hintType] || 'approach',
    trace: agentResult.trace, // 返回 ReAct 追踪
  };
}

// ==================== 下一题决策集成 ====================

/**
 * 使用 ReAct Agent 决定下一个问题（兼容原有接口）
 */
export async function generateNextQuestionWithReAct(
  context: NextQuestionContext
): Promise<OriginalNextQuestionDecision> {
  const input: NextQuestionInput = {
    job: {
      company: context.job.company,
      position: context.job.position,
      description: context.job.description,
    },
    conversationHistory: context.conversationHistory.map(m => ({
      role: m.role,
      content: m.content,
    })),
    currentQuestionNumber: context.currentQuestion,
    totalQuestions: context.totalQuestions,
    userResponse: context.userResponse,
    knowledgeBaseId: context.knowledgeBaseId,
    language: context.language,
  };

  const result = await decideNextQuestionWithReAct(input);

  if (!result) {
    // 回退
    return {
      questionType: 'new_topic',
      question: context.language === 'zh'
        ? '能告诉我一个你解决过的具有挑战性的问题吗？'
        : 'Can you tell me about a challenging problem you\'ve solved?',
      reasoning: 'Fallback question',
      topicsCovered: [],
      suggestedNextTopics: ['Problem solving', 'Technical skills'],
    };
  }

  return {
    questionType: result.questionType,
    question: result.question,
    reasoning: result.reasoning,
    topicsCovered: result.topicsCovered,
    suggestedNextTopics: result.suggestedNextTopics,
  };
}

// ==================== 统一入口 ====================

/**
 * 智能选择使用 ReAct 还是原有实现
 */
export async function generateInterviewPlanSmart(
  company: string,
  position: string,
  jobDescription: string,
  userProfile: UserProfile = {},
  options: {
    questionCount?: number;
    language?: 'en' | 'zh';
    focusAreas?: ('technical' | 'behavioral' | 'case')[];
    difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
    userId?: number;
    forceRefresh?: boolean;
    useReAct?: boolean;
  } = {}
): Promise<InterviewPlan> {
  const useReAct = options.useReAct ?? currentConfig.useReActForQuestions;

  if (useReAct) {
    try {
      return await generateInterviewPlanWithReAct(company, position, jobDescription, userProfile, options);
    } catch (error) {
      console.error('[ReActIntegration] ReAct failed, falling back:', error);
      if (!currentConfig.fallbackToOriginal) {
        throw error;
      }
    }
  }

  // 使用原有实现
  const { generateInterviewPlan } = await import('../interviewGenerator');
  return generateInterviewPlan(company, position, jobDescription, userProfile, options);
}

/**
 * 智能选择使用 ReAct 还是原有实现生成提示
 */
export async function generateHintSmart(
  request: HintRequest,
  useReAct?: boolean
): Promise<HintResponse> {
  const shouldUseReAct = useReAct ?? currentConfig.useReActForHints;

  if (shouldUseReAct) {
    try {
      return await generateHintWithReActAdapter(request);
    } catch (error) {
      console.error('[ReActIntegration] ReAct hint failed, falling back:', error);
      if (!currentConfig.fallbackToOriginal) {
        throw error;
      }
    }
  }

  // 使用原有实现
  const { generateHint } = await import('../hintGenerator');
  return generateHint(request);
}

/**
 * 智能选择使用 ReAct 还是原有实现决定下一题
 */
export async function generateNextQuestionSmart(
  context: NextQuestionContext,
  useReAct?: boolean
): Promise<OriginalNextQuestionDecision> {
  const shouldUseReAct = useReAct ?? currentConfig.useReActForNextQuestion;

  if (shouldUseReAct) {
    try {
      return await generateNextQuestionWithReAct(context);
    } catch (error) {
      console.error('[ReActIntegration] ReAct next question failed, falling back:', error);
      if (!currentConfig.fallbackToOriginal) {
        throw error;
      }
    }
  }

  // 使用原有实现
  const { generateNextQuestion } = await import('../nextQuestionGenerator');
  return generateNextQuestion(context);
}

// ==================== 导出 ====================

export {
  generateQuestionWithReAct,
  generateQuestionsWithReAct,
  generateHintWithReAct,
  decideNextQuestionWithReAct,
};
