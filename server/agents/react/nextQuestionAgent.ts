/**
 * Next Question Decision ReAct Agent
 * 
 * 使用 ReAct 模式决定下一个问题：
 * 1. 分析用户回答质量
 * 2. 检查话题覆盖情况
 * 3. 决定是追问、换话题还是深入
 * 
 * 时间约束：5秒内完成
 */

import { BaseReActAgent } from './baseAgent';
import { ReActConfig, ReActTrace, TIME_BUDGETS, Tool, ToolResult } from './types';
import { getKnowledgeBaseById } from '../knowledgeBaseService';

// ==================== 输入输出类型 ====================

export interface NextQuestionInput {
  job: {
    company: string;
    position: string;
    description?: string;
  };
  conversationHistory: Array<{ role: string; content: string }>;
  currentQuestionNumber: number;
  totalQuestions: number;
  userResponse: string;
  knowledgeBaseId?: number;
  language: 'en' | 'zh';
  topicsCovered?: string[];
}

export interface NextQuestionDecision {
  questionType: 'follow_up' | 'new_topic' | 'deep_dive' | 'closing';
  question: string;
  reasoning: string;
  topicsCovered: string[];
  suggestedNextTopics: string[];
}

// ==================== 工具 ====================

const analyzeResponseQualityTool: Tool = {
  name: 'analyze_response_quality',
  description: 'Analyze the quality of user\'s response to determine if follow-up is needed',
  parameters: {
    type: 'object',
    properties: {
      response: { type: 'string', description: 'User\'s response' },
      question: { type: 'string', description: 'The question that was asked' },
    },
    required: ['response', 'question'],
  },
  estimatedTimeMs: 500,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    const { response, question } = params as { response: string; question: string };
    
    const length = response.length;
    const hasNumbers = /\d+/.test(response);
    const hasExamples = /example|例如|比如|specifically|具体/.test(response.toLowerCase());
    const hasStructure = /first|second|then|finally|首先|其次|然后|最后/.test(response.toLowerCase());
    
    let quality: 'brief' | 'adequate' | 'comprehensive';
    let needsFollowUp = false;
    let followUpReason = '';
    
    if (length < 100) {
      quality = 'brief';
      needsFollowUp = true;
      followUpReason = 'Response is too brief, needs more details';
    } else if (length < 300 || (!hasExamples && !hasNumbers)) {
      quality = 'adequate';
      needsFollowUp = !hasExamples;
      followUpReason = hasExamples ? '' : 'Could use specific examples';
    } else {
      quality = 'comprehensive';
      needsFollowUp = false;
    }
    
    return {
      success: true,
      data: {
        quality,
        needsFollowUp,
        followUpReason,
        metrics: { length, hasNumbers, hasExamples, hasStructure },
      },
      executionTimeMs: Date.now() - startTime,
    };
  },
};

const getUncoveredTopicsTool: Tool = {
  name: 'get_uncovered_topics',
  description: 'Get topics that haven\'t been covered yet in the interview',
  parameters: {
    type: 'object',
    properties: {
      knowledgeBaseId: { type: 'string', description: 'Knowledge base ID' },
      coveredTopics: { type: 'string', description: 'JSON array of covered topics' },
    },
    required: ['coveredTopics'],
  },
  estimatedTimeMs: 800,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    const { knowledgeBaseId, coveredTopics } = params as { knowledgeBaseId?: string; coveredTopics: string };
    
    let covered: string[];
    try {
      covered = JSON.parse(coveredTopics);
    } catch {
      covered = [];
    }
    
    const coveredLower = covered.map(t => t.toLowerCase());
    
    // 默认话题列表
    const defaultTopics = [
      'Technical skills', 'Problem solving', 'Teamwork', 'Leadership',
      'Communication', 'Project management', 'Conflict resolution',
      'Career goals', 'Strengths and weaknesses', 'Past experiences',
    ];
    
    let allTopics = defaultTopics;
    
    // 如果有知识库，获取更具体的话题
    if (knowledgeBaseId) {
      try {
        const kb = await getKnowledgeBaseById(parseInt(knowledgeBaseId, 10));
        if (kb && kb.questions.length > 0) {
          const categorySet = new Set(kb.questions.map(q => q.category).filter(Boolean));
          const categories = Array.from(categorySet);
          if (categories.length > 0) {
            allTopics = categories as string[];
          }
        }
      } catch {
        // 使用默认话题
      }
    }
    
    const uncovered = allTopics.filter(t => 
      !coveredLower.some(c => t.toLowerCase().includes(c) || c.includes(t.toLowerCase()))
    );
    
    return {
      success: true,
      data: {
        uncoveredTopics: uncovered.slice(0, 5),
        totalTopics: allTopics.length,
        coveredCount: covered.length,
        coveragePercentage: Math.round((covered.length / allTopics.length) * 100),
      },
      executionTimeMs: Date.now() - startTime,
    };
  },
};

const nextQuestionTools: Tool[] = [analyzeResponseQualityTool, getUncoveredTopicsTool];

// ==================== Agent 配置 ====================

const nextQuestionConfig: ReActConfig = {
  moduleName: 'next_question',
  thinking: {
    maxSteps: 3,
    requiredThoughts: [
      'How good was the user\'s response?',
      'What topics have been covered?',
    ],
    adaptiveDepth: true,
  },
  tools: nextQuestionTools,
  timeBudget: TIME_BUDGETS.next_question,
  quality: {
    minScore: 0.7,
    earlyStopOnQuality: true,
  },
};

// ==================== Agent 实现 ====================

export class NextQuestionAgent extends BaseReActAgent<NextQuestionInput, NextQuestionDecision> {
  constructor() {
    super(nextQuestionConfig);
  }

  protected buildSystemPrompt(input: NextQuestionInput, _context: Record<string, unknown>): string {
    const isZh = input.language === 'zh';
    const isNearEnd = input.currentQuestionNumber >= input.totalQuestions - 1;
    
    const recentHistory = input.conversationHistory.slice(-6)
      .map(m => `${m.role}: ${m.content.slice(0, 150)}...`)
      .join('\n');

    const progressNote = isNearEnd
      ? (isZh ? '这是最后几个问题，考虑使用总结性问题。' : 'This is near the end. Consider a closing/summary question.')
      : '';

    return isZh
      ? `你是一位专业的面试官，正在为 ${input.job.position} @ ${input.job.company} 进行面试。

当前进度：第 ${input.currentQuestionNumber} 个问题，共 ${input.totalQuestions} 个
${progressNote}

最近对话：
${recentHistory}

用户最新回答：
${input.userResponse}

已覆盖话题：${input.topicsCovered?.join(', ') || '无'}

你的任务是决定下一步行动。请：
1. 使用 analyze_response_quality 分析用户回答质量
2. 使用 get_uncovered_topics 查看还有哪些话题未覆盖
3. 决定下一个问题类型和内容

问题类型：
- follow_up: 追问当前话题的更多细节
- new_topic: 转到新的面试话题
- deep_dive: 深入探讨用户提到的某个点
- closing: 结束性问题

你有 5 秒时间。

最终答案必须是 JSON 格式：
{
  "questionType": "follow_up" | "new_topic" | "deep_dive" | "closing",
  "question": "你的下一个问题",
  "reasoning": "为什么选择这个问题",
  "topicsCovered": ["已覆盖话题列表"],
  "suggestedNextTopics": ["建议下次探索的话题"]
}`
      : `You are a professional interviewer conducting an interview for ${input.job.position} at ${input.job.company}.

Progress: Question ${input.currentQuestionNumber} of ${input.totalQuestions}
${progressNote}

Recent conversation:
${recentHistory}

User's latest response:
${input.userResponse}

Topics covered: ${input.topicsCovered?.join(', ') || 'None'}

Your task is to decide the next action. Please:
1. Use analyze_response_quality to assess the response quality
2. Use get_uncovered_topics to see what topics haven't been covered
3. Decide the next question type and content

Question types:
- follow_up: Ask for more details on current topic
- new_topic: Move to a new interview topic
- deep_dive: Explore something the user mentioned in depth
- closing: Final/summary question

You have 5 seconds.

Your Final Answer MUST be in JSON format:
{
  "questionType": "follow_up" | "new_topic" | "deep_dive" | "closing",
  "question": "Your next question",
  "reasoning": "Why this question",
  "topicsCovered": ["List of covered topics"],
  "suggestedNextTopics": ["Topics to explore next"]
}`;
  }

  protected parseOutput(thought: string, _trace: ReActTrace): NextQuestionDecision | null {
    try {
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.questionType || !parsed.question) return null;

      const validTypes = ['follow_up', 'new_topic', 'deep_dive', 'closing'];
      if (!validTypes.includes(parsed.questionType)) {
        parsed.questionType = 'new_topic';
      }

      return {
        questionType: parsed.questionType,
        question: parsed.question,
        reasoning: parsed.reasoning || '',
        topicsCovered: parsed.topicsCovered || [],
        suggestedNextTopics: parsed.suggestedNextTopics || [],
      };
    } catch {
      return null;
    }
  }
}

// ==================== 便捷函数 ====================

/**
 * 使用 ReAct Agent 决定下一个问题
 */
export async function decideNextQuestionWithReAct(input: NextQuestionInput): Promise<NextQuestionDecision | null> {
  const agent = new NextQuestionAgent();
  const result = await agent.execute(input);

  if (result.success && result.output) {
    console.log(`[NextQuestionAgent] Decision made in ${result.trace.totalTimeMs}ms`);
    return result.output;
  }

  // 回退
  return {
    questionType: 'new_topic',
    question: input.language === 'zh'
      ? '能告诉我一个你解决过的具有挑战性的问题吗？'
      : 'Can you tell me about a challenging problem you\'ve solved?',
    reasoning: 'Fallback question',
    topicsCovered: input.topicsCovered || [],
    suggestedNextTopics: ['Problem solving', 'Technical skills'],
  };
}
