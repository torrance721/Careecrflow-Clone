/**
 * Question Generation ReAct Agent
 * 
 * 使用 ReAct 模式生成面试问题：
 * 1. 搜索知识库获取真实面试问题
 * 2. 分析用户背景确定难度
 * 3. 检查问题重复性
 * 4. 生成最合适的问题
 */

import { BaseReActAgent } from './baseAgent';
import { ReActConfig, ReActTrace, TIME_BUDGETS } from './types';
import { questionGenerationTools } from './tools/questionTools';

// ==================== 输入输出类型 ====================

export interface QuestionGenerationInput {
  company: string;
  position: string;
  jobDescription?: string;
  userProfile?: {
    resumeSummary?: string;
    skills?: string[];
    experience?: string;
    yearsOfExperience?: number;
  };
  conversationHistory?: Array<{ role: string; content: string }>;
  previousQuestions?: string[];
  language: 'en' | 'zh';
  questionNumber?: number;
  totalQuestions?: number;
}

export interface GeneratedQuestion {
  question: string;
  type: 'technical' | 'behavioral' | 'case';
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  source: 'knowledge_base' | 'generated';
  reasoning?: string;
  hints?: string[];
  knowledgeBaseId?: number;
}

// ==================== Agent 配置 ====================

const questionGenerationConfig: ReActConfig = {
  moduleName: 'question_generation',
  thinking: {
    maxSteps: 4,
    requiredThoughts: [
      'What is the user\'s experience level?',
      'What topics should I focus on?',
      'What difficulty is appropriate?',
    ],
    adaptiveDepth: true,
  },
  tools: questionGenerationTools,
  timeBudget: TIME_BUDGETS.question_generation,
  quality: {
    minScore: 0.7,
    earlyStopOnQuality: true,
  },
};

// ==================== Agent 实现 ====================

export class QuestionGenerationAgent extends BaseReActAgent<QuestionGenerationInput, GeneratedQuestion> {
  constructor() {
    super(questionGenerationConfig);
  }

  protected buildSystemPrompt(input: QuestionGenerationInput, context: Record<string, unknown>): string {
    const isZh = input.language === 'zh';
    
    const userProfileText = input.userProfile
      ? `
User Profile:
- Resume: ${input.userProfile.resumeSummary || 'Not provided'}
- Skills: ${input.userProfile.skills?.join(', ') || 'Not provided'}
- Experience: ${input.userProfile.experience || 'Not provided'}
- Years: ${input.userProfile.yearsOfExperience || 'Unknown'}`
      : 'User profile not provided.';

    const previousQuestionsText = input.previousQuestions?.length
      ? `\nPrevious questions asked (avoid duplicates):\n${input.previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : '';

    const progressText = input.questionNumber && input.totalQuestions
      ? `\nInterview Progress: Question ${input.questionNumber} of ${input.totalQuestions}`
      : '';

    return isZh
      ? `你是一位专业的面试官，正在为 ${input.company} 的 ${input.position} 职位准备面试问题。

职位描述：${input.jobDescription || '未提供'}
${userProfileText}
${previousQuestionsText}
${progressText}

你的任务是生成一个高质量的面试问题。请按以下步骤思考：

1. 首先，使用 search_knowledge_base 工具搜索该公司/职位的真实面试问题
2. 然后，使用 analyze_user_background 工具分析用户背景，确定合适的难度
3. 如果有之前的问题，使用 check_question_duplicate 工具确保不重复
4. 最后，生成一个合适的问题

最终答案必须是 JSON 格式：
{
  "question": "面试问题",
  "type": "technical" | "behavioral" | "case",
  "category": "问题分类",
  "difficulty": "Easy" | "Medium" | "Hard",
  "source": "knowledge_base" | "generated",
  "reasoning": "为什么选择这个问题",
  "hints": ["提示1", "提示2"]
}`
      : `You are a professional interviewer preparing questions for a ${input.position} position at ${input.company}.

Job Description: ${input.jobDescription || 'Not provided'}
${userProfileText}
${previousQuestionsText}
${progressText}

Your task is to generate a high-quality interview question. Follow these steps:

1. First, use search_knowledge_base tool to find real interview questions for this company/position
2. Then, use analyze_user_background tool to analyze the user's background and determine appropriate difficulty
3. If there are previous questions, use check_question_duplicate tool to ensure no duplicates
4. Finally, generate an appropriate question

Your Final Answer MUST be in JSON format:
{
  "question": "The interview question",
  "type": "technical" | "behavioral" | "case",
  "category": "Question category",
  "difficulty": "Easy" | "Medium" | "Hard",
  "source": "knowledge_base" | "generated",
  "reasoning": "Why this question was chosen",
  "hints": ["Hint 1", "Hint 2"]
}`;
  }

  protected async getInitialContext(input: QuestionGenerationInput): Promise<Record<string, unknown>> {
    return {
      company: input.company,
      position: input.position,
      language: input.language,
      previousQuestionsCount: input.previousQuestions?.length || 0,
      hasUserProfile: !!input.userProfile,
    };
  }

  protected parseOutput(thought: string, trace: ReActTrace): GeneratedQuestion | null {
    try {
      // 尝试从思考中提取 JSON
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[QuestionGenerationAgent] No JSON found in output');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证必需字段
      if (!parsed.question || !parsed.type || !parsed.difficulty) {
        console.error('[QuestionGenerationAgent] Missing required fields');
        return null;
      }

      // 从 trace 中提取 knowledgeBaseId
      let knowledgeBaseId: number | undefined;
      for (const step of trace.steps) {
        if (step.observation) {
          try {
            const obs = JSON.parse(step.observation);
            if (obs.knowledgeBaseId) {
              knowledgeBaseId = obs.knowledgeBaseId;
              break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      return {
        question: parsed.question,
        type: parsed.type,
        category: parsed.category || 'General',
        difficulty: parsed.difficulty,
        source: parsed.source || 'generated',
        reasoning: parsed.reasoning,
        hints: parsed.hints,
        knowledgeBaseId,
      };
    } catch (error) {
      console.error('[QuestionGenerationAgent] Failed to parse output:', error);
      return null;
    }
  }
}

// ==================== 便捷函数 ====================

/**
 * 使用 ReAct Agent 生成面试问题
 */
export async function generateQuestionWithReAct(
  input: QuestionGenerationInput
): Promise<GeneratedQuestion | null> {
  const agent = new QuestionGenerationAgent();
  const result = await agent.execute(input);

  if (result.success && result.output) {
    console.log(`[QuestionGenerationAgent] Generated question in ${result.trace.totalTimeMs}ms`);
    console.log(`[QuestionGenerationAgent] Steps: ${result.trace.steps.length}, Early stop: ${result.trace.earlyStop}`);
    if (result.grade) {
      console.log(`[QuestionGenerationAgent] Quality score: ${result.grade.overallScore.toFixed(2)}`);
    }
    return result.output;
  }

  console.error('[QuestionGenerationAgent] Failed to generate question:', result.error);
  return null;
}

/**
 * 批量生成面试问题
 */
export async function generateQuestionsWithReAct(
  input: Omit<QuestionGenerationInput, 'questionNumber' | 'previousQuestions'>,
  count: number = 5
): Promise<GeneratedQuestion[]> {
  const questions: GeneratedQuestion[] = [];
  const previousQuestions: string[] = [];

  for (let i = 0; i < count; i++) {
    const question = await generateQuestionWithReAct({
      ...input,
      questionNumber: i + 1,
      totalQuestions: count,
      previousQuestions,
    });

    if (question) {
      questions.push(question);
      previousQuestions.push(question.question);
    }
  }

  return questions;
}
