/**
 * Interview Generator Agent
 * 
 * This agent generates personalized interview questions based on:
 * 1. Company/position-specific knowledge from the knowledge base
 * 2. User's resume and background
 * 3. Real interview questions from Glassdoor, LeetCode, etc.
 */

import { invokeLLM } from '../_core/llm';
import { 
  getOrCreateKnowledgeBase, 
  type KnowledgeBaseWithQuestions 
} from './knowledgeBaseService';
import type { InterviewQuestion } from '../../drizzle/schema';

// Types
export interface UserProfile {
  resumeSummary?: string;
  skills?: string[];
  experience?: string;
  education?: string;
  situation?: string; // What they're looking for
}

export interface GeneratedQuestion {
  question: string;
  type: 'technical' | 'behavioral' | 'case';
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  source: 'knowledge_base' | 'generated';
  originalQuestionId?: number;
  hints?: string[];
}

export interface InterviewPlan {
  company: string;
  position: string;
  totalQuestions: number;
  questions: GeneratedQuestion[];
  interviewProcess?: {
    rounds: Array<{
      order: number;
      name: string;
      duration?: string;
      format?: string;
      focus: string[];
    }>;
    difficulty: string;
  };
  companyTips?: string[];
  knowledgeBaseId?: number;
  cacheHit: boolean;
}

export interface GenerateInterviewOptions {
  questionCount?: number;
  language?: 'en' | 'zh';
  focusAreas?: ('technical' | 'behavioral' | 'case')[];
  difficulty?: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  includeKnowledgeBaseQuestions?: boolean;
  forceRefresh?: boolean;
  userId?: number;
}

const DEFAULT_OPTIONS: GenerateInterviewOptions = {
  questionCount: 6,
  language: 'en',
  focusAreas: ['technical', 'behavioral'],
  difficulty: 'Mixed',
  includeKnowledgeBaseQuestions: true,
  forceRefresh: false,
};

/**
 * Select questions from knowledge base based on criteria
 */
function selectQuestionsFromKnowledgeBase(
  knowledgeBase: KnowledgeBaseWithQuestions,
  options: GenerateInterviewOptions
): InterviewQuestion[] {
  const { focusAreas = ['technical', 'behavioral'], difficulty, questionCount = 6 } = options;
  
  // Filter questions by type
  let filtered = knowledgeBase.questions.filter(q => 
    focusAreas.includes(q.type as 'technical' | 'behavioral' | 'case')
  );
  
  // Filter by difficulty if specified
  if (difficulty && difficulty !== 'Mixed') {
    filtered = filtered.filter(q => q.difficulty === difficulty);
  }
  
  // Sort by frequency (higher frequency = more common in real interviews)
  filtered.sort((a, b) => (b.frequency || 1) - (a.frequency || 1));
  
  // Take top questions, ensuring variety
  const selected: InterviewQuestion[] = [];
  const typeCount: Record<string, number> = {};
  
  for (const q of filtered) {
    if (selected.length >= Math.ceil(questionCount * 0.7)) break; // Use 70% from KB
    
    const type = q.type;
    typeCount[type] = (typeCount[type] || 0) + 1;
    
    // Ensure variety - don't take too many of one type
    if (typeCount[type] <= Math.ceil(questionCount / focusAreas.length)) {
      selected.push(q);
    }
  }
  
  return selected;
}

/**
 * Generate additional questions using LLM
 */
async function generateAdditionalQuestions(
  company: string,
  position: string,
  jobDescription: string,
  userProfile: UserProfile,
  existingQuestions: GeneratedQuestion[],
  count: number,
  language: 'en' | 'zh'
): Promise<GeneratedQuestion[]> {
  if (count <= 0) return [];
  
  const existingQuestionsText = existingQuestions
    .map(q => `- ${q.question}`)
    .join('\n');
  
  const systemPrompt = language === 'zh'
    ? `你是一位专业的面试官，正在为 ${company} 的 ${position} 职位准备面试问题。

职位描述：${jobDescription}

候选人背景：
${userProfile.resumeSummary || '未提供'}
技能：${userProfile.skills?.join(', ') || '未提供'}
经验：${userProfile.experience || '未提供'}

已有问题（避免重复）：
${existingQuestionsText || '无'}

请生成 ${count} 个新的面试问题。要求：
1. 问题要针对候选人的背景和职位要求
2. 包含技术问题和行为问题
3. 难度适中，循序渐进
4. 模拟 ${company} 的面试风格

返回 JSON 格式：
{
  "questions": [
    {
      "question": "问题内容",
      "type": "technical" | "behavioral" | "case",
      "category": "分类",
      "difficulty": "Easy" | "Medium" | "Hard",
      "hints": ["提示1", "提示2"]
    }
  ]
}`
    : `You are a professional interviewer preparing questions for a ${position} position at ${company}.

Job Description: ${jobDescription}

Candidate Background:
${userProfile.resumeSummary || 'Not provided'}
Skills: ${userProfile.skills?.join(', ') || 'Not provided'}
Experience: ${userProfile.experience || 'Not provided'}

Existing Questions (avoid duplicates):
${existingQuestionsText || 'None'}

Generate ${count} new interview questions. Requirements:
1. Questions should be tailored to the candidate's background and job requirements
2. Include both technical and behavioral questions
3. Progressive difficulty
4. Simulate ${company}'s interview style

Return JSON format:
{
  "questions": [
    {
      "question": "Question content",
      "type": "technical" | "behavioral" | "case",
      "category": "Category",
      "difficulty": "Easy" | "Medium" | "Hard",
      "hints": ["Hint 1", "Hint 2"]
    }
  ]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${count} interview questions.` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'interview_questions',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    question: { type: 'string' },
                    type: { type: 'string', enum: ['technical', 'behavioral', 'case'] },
                    category: { type: 'string' },
                    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
                    hints: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['question', 'type', 'category', 'difficulty'],
                  additionalProperties: false,
                },
              },
            },
            required: ['questions'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return [];
    }

    const parsed = JSON.parse(content);
    return (parsed.questions || []).map((q: {
      question: string;
      type: 'technical' | 'behavioral' | 'case';
      category: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      hints?: string[];
    }) => ({
      question: q.question,
      type: q.type,
      category: q.category,
      difficulty: q.difficulty,
      source: 'generated' as const,
      hints: q.hints,
    }));
  } catch (error) {
    console.error('[InterviewGenerator] Error generating questions:', error);
    return [];
  }
}

/**
 * Generate a personalized interview plan
 */
export async function generateInterviewPlan(
  company: string,
  position: string,
  jobDescription: string,
  userProfile: UserProfile = {},
  options: GenerateInterviewOptions = {}
): Promise<InterviewPlan> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { questionCount = 6, language = 'en', includeKnowledgeBaseQuestions = true } = opts;
  
  console.log(`[InterviewGenerator] Generating interview plan for ${company} - ${position}`);
  
  const questions: GeneratedQuestion[] = [];
  let knowledgeBase: KnowledgeBaseWithQuestions | null = null;
  let cacheHit = false;
  
  // Step 1: Try to get knowledge base
  if (includeKnowledgeBaseQuestions) {
    try {
      const result = await getOrCreateKnowledgeBase(company, position, {
        forceRefresh: opts.forceRefresh,
        userId: opts.userId,
        language,
      });
      
      knowledgeBase = result.knowledgeBase;
      cacheHit = result.cacheHit;
      
      // Select questions from knowledge base
      const kbQuestions = selectQuestionsFromKnowledgeBase(knowledgeBase, opts);
      
      for (const q of kbQuestions) {
        questions.push({
          question: q.question,
          type: q.type as 'technical' | 'behavioral' | 'case',
          category: q.category || 'General',
          difficulty: (q.difficulty as 'Easy' | 'Medium' | 'Hard') || 'Medium',
          source: 'knowledge_base',
          originalQuestionId: q.id,
          hints: q.sampleAnswer ? [q.sampleAnswer] : undefined,
        });
      }
      
      console.log(`[InterviewGenerator] Selected ${questions.length} questions from knowledge base`);
    } catch (error) {
      console.error('[InterviewGenerator] Error getting knowledge base:', error);
    }
  }
  
  // Step 2: Generate additional questions if needed
  const remainingCount = questionCount - questions.length;
  if (remainingCount > 0) {
    const additionalQuestions = await generateAdditionalQuestions(
      company,
      position,
      jobDescription,
      userProfile,
      questions,
      remainingCount,
      language
    );
    
    questions.push(...additionalQuestions);
    console.log(`[InterviewGenerator] Generated ${additionalQuestions.length} additional questions`);
  }
  
  // Step 3: Build interview plan
  const plan: InterviewPlan = {
    company,
    position,
    totalQuestions: questions.length,
    questions,
    cacheHit,
  };
  
  // Add knowledge base info if available
  if (knowledgeBase) {
    plan.knowledgeBaseId = knowledgeBase.id;
    
    if (knowledgeBase.interviewProcess) {
      plan.interviewProcess = {
        rounds: knowledgeBase.interviewProcess.rounds,
        difficulty: knowledgeBase.interviewProcess.difficulty,
      };
    }
    
    if (knowledgeBase.tips && knowledgeBase.tips.length > 0) {
      plan.companyTips = knowledgeBase.tips.map(t => t.tip);
    }
  }
  
  console.log(`[InterviewGenerator] Interview plan generated with ${plan.totalQuestions} questions`);
  
  return plan;
}

/**
 * Generate interview system prompt with knowledge base context
 */
export async function generateInterviewSystemPrompt(
  company: string,
  position: string,
  jobDescription: string,
  language: 'en' | 'zh' = 'en',
  userId?: number
): Promise<{
  systemPrompt: string;
  knowledgeBaseId?: number;
  interviewTips?: string[];
}> {
  // Try to get knowledge base for context
  let knowledgeBase: KnowledgeBaseWithQuestions | null = null;
  
  try {
    const result = await getOrCreateKnowledgeBase(company, position, {
      userId,
      language,
    });
    knowledgeBase = result.knowledgeBase;
  } catch (error) {
    console.error('[InterviewGenerator] Error getting knowledge base for prompt:', error);
  }
  
  // Build context from knowledge base
  let interviewContext = '';
  let interviewTips: string[] = [];
  
  if (knowledgeBase) {
    // Add interview process info
    if (knowledgeBase.interviewProcess) {
      const process = knowledgeBase.interviewProcess;
      interviewContext += language === 'zh'
        ? `\n\n面试流程信息：
- 难度：${process.difficulty}
- 轮次：${process.rounds.map(r => `${r.name} (${r.duration || '未知时长'})`).join(', ')}`
        : `\n\nInterview Process Information:
- Difficulty: ${process.difficulty}
- Rounds: ${process.rounds.map(r => `${r.name} (${r.duration || 'unknown duration'})`).join(', ')}`;
    }
    
    // Add company culture info
    if (knowledgeBase.companyInfo) {
      const info = knowledgeBase.companyInfo;
      if (info.interviewStyle) {
        interviewContext += language === 'zh'
          ? `\n- 面试风格：${info.interviewStyle}`
          : `\n- Interview Style: ${info.interviewStyle}`;
      }
      if (info.values.length > 0) {
        interviewContext += language === 'zh'
          ? `\n- 公司价值观：${info.values.slice(0, 3).join(', ')}`
          : `\n- Company Values: ${info.values.slice(0, 3).join(', ')}`;
      }
    }
    
    // Get sample questions
    const sampleQuestions = knowledgeBase.questions
      .filter(q => (q.frequency || 1) >= 3)
      .slice(0, 5)
      .map(q => q.question);
    
    if (sampleQuestions.length > 0) {
      interviewContext += language === 'zh'
        ? `\n\n常见面试问题（参考）：
${sampleQuestions.map(q => `- ${q}`).join('\n')}`
        : `\n\nCommon Interview Questions (Reference):
${sampleQuestions.map(q => `- ${q}`).join('\n')}`;
    }
    
    // Extract tips
    if (knowledgeBase.tips) {
      interviewTips = knowledgeBase.tips.map(t => t.tip);
    }
  }
  
  // Build system prompt
  const systemPrompt = language === 'zh'
    ? `你是 UHired 的面试助手。你的目标是通过友好的对话帮助用户了解自己与特定职位的匹配度。

职位：${position} @ ${company}
职位描述：${jobDescription}
${interviewContext}

重要指南：
1. 这不是考试 - 这是一次信息收集对话
2. 要友好、支持和鼓励
3. 提出帮助用户表达经验的问题
4. 用户可以粘贴链接、分享作品集或详细描述项目
5. 专注于了解他们的实际能力，而不是测试面试技巧
6. 基于上述常见面试问题生成相关问题
7. 模拟 ${company} 的面试风格和文化

请用中文回复。以热情的问候开始，然后提出第一个关于他们相关经验的问题。`
    : `You are UHired's interview assistant. Your goal is to help users understand their fit for a specific job position through a friendly conversation.

Job Position: ${position} at ${company}
Job Description: ${jobDescription}
${interviewContext}

IMPORTANT GUIDELINES:
1. This is NOT an exam - it's an information gathering conversation
2. Be friendly, supportive, and encouraging
3. Ask questions that help the user articulate their experience
4. Users can paste links, share portfolio items, or describe projects in detail
5. Focus on understanding their actual capabilities, not testing their interview skills
6. Generate questions based on the common interview questions above
7. Simulate ${company}'s interview style and culture

Start with a warm greeting and your first question about their relevant experience.`;

  return {
    systemPrompt,
    knowledgeBaseId: knowledgeBase?.id,
    interviewTips,
  };
}

/**
 * Class wrapper for the interview generator
 */
export class InterviewGenerator {
  private language: 'en' | 'zh';
  private userId?: number;
  
  constructor(language: 'en' | 'zh' = 'en', userId?: number) {
    this.language = language;
    this.userId = userId;
  }
  
  async generatePlan(
    company: string,
    position: string,
    jobDescription: string,
    userProfile: UserProfile = {},
    options: Omit<GenerateInterviewOptions, 'language' | 'userId'> = {}
  ): Promise<InterviewPlan> {
    return generateInterviewPlan(company, position, jobDescription, userProfile, {
      ...options,
      language: this.language,
      userId: this.userId,
    });
  }
  
  async generateSystemPrompt(
    company: string,
    position: string,
    jobDescription: string
  ): Promise<{
    systemPrompt: string;
    knowledgeBaseId?: number;
    interviewTips?: string[];
  }> {
    return generateInterviewSystemPrompt(
      company,
      position,
      jobDescription,
      this.language,
      this.userId
    );
  }
}
