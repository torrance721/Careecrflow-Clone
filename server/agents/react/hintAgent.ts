/**
 * Hint System ReAct Agent
 * 
 * 使用 ReAct 模式生成面试提示：
 * 1. 分析用户当前困境
 * 2. 搜索知识库获取相关信息
 * 3. 生成详细提示（允许剧透，尽可能帮助用户）
 * 
 * 策略调整：尽可能详细，允许剧透
 * - 不再限制"不给答案"
 * - 提供具体的回答思路和示例
 * - 帮助用户理解问题的考察点
 */

import { BaseReActAgent } from './baseAgent';
import { ReActConfig, ReActTrace, TIME_BUDGETS, Tool, ToolResult } from './types';
import { getKnowledgeBaseById } from '../knowledgeBaseService';
import { searchGlassdoor } from '../searchAgent';

// ==================== 输入输出类型 ====================

export interface HintInput {
  question: string;
  userResponse?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  knowledgeBaseId?: number;
  language: 'en' | 'zh';
  hintLevel?: number; // 1 = 方向提示, 2 = 框架提示, 3 = 详细提示（含示例）
  targetPosition?: string; // 目标职位
  topicName?: string; // 当前话题名称
}

export interface GeneratedHint {
  hint: string;
  hintType: 'direction' | 'framework' | 'specific' | 'example' | 'detailed';
  reasoning: string;
  nextHintAvailable: boolean;
  samplePoints?: string[]; // 可以提到的要点
  exampleAnswer?: string; // 示例回答（如果允许剧透）
}

// ==================== Hint 工具 ====================

const analyzeUserStruggleTool: Tool = {
  name: 'analyze_user_struggle',
  description: '分析用户为什么在这个问题上遇到困难，以及需要什么类型的帮助',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '面试问题' },
      userResponse: { type: 'string', description: '用户的尝试回答' },
      topicName: { type: 'string', description: '话题名称' },
    },
    required: ['question'],
  },
  estimatedTimeMs: 500,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    const { question, userResponse, topicName } = params as { question: string; userResponse?: string; topicName?: string };
    
    const responseLength = userResponse?.length || 0;
    const hasSpecificDetails = userResponse?.includes('example') || 
                               userResponse?.includes('例如') ||
                               userResponse?.includes('specifically') ||
                               userResponse?.includes('具体');
    const hasNumbers = /\d+/.test(userResponse || '');
    const hasSTAR = userResponse?.toLowerCase().includes('situation') ||
                    userResponse?.includes('情境') ||
                    userResponse?.includes('背景');
    
    let struggleType: string;
    let recommendation: string;
    let detailLevel: 'basic' | 'intermediate' | 'advanced';
    
    if (responseLength === 0) {
      struggleType = 'no_start';
      recommendation = '用户完全不知道如何开始，需要提供完整的回答思路和示例';
      detailLevel = 'advanced';
    } else if (responseLength < 50) {
      struggleType = 'too_brief';
      recommendation = '用户回答太简短，需要提供具体的展开方向和要点';
      detailLevel = 'advanced';
    } else if (!hasSpecificDetails && !hasNumbers) {
      struggleType = 'lacks_specifics';
      recommendation = '用户缺少具体细节，需要提示可以加入的具体内容类型';
      detailLevel = 'intermediate';
    } else if (!hasSTAR) {
      struggleType = 'needs_structure';
      recommendation = '用户需要更好的结构，可以提供 STAR 框架和示例';
      detailLevel = 'intermediate';
    } else {
      struggleType = 'needs_polish';
      recommendation = '用户回答已有基础，需要润色和强化亮点';
      detailLevel = 'basic';
    }
    
    return {
      success: true,
      data: { 
        struggleType, 
        recommendation, 
        responseLength, 
        hasSpecificDetails,
        hasNumbers,
        hasSTAR,
        detailLevel,
        topicName
      },
      executionTimeMs: Date.now() - startTime,
    };
  },
};

const getRelatedKnowledgeTool: Tool = {
  name: 'get_related_knowledge',
  description: '从知识库获取与当前问题相关的信息，包括示例答案和技巧',
  parameters: {
    type: 'object',
    properties: {
      knowledgeBaseId: { type: 'string', description: '知识库 ID' },
      question: { type: 'string', description: '当前问题' },
    },
    required: ['question'],
  },
  estimatedTimeMs: 1000,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    const { knowledgeBaseId, question } = params as { knowledgeBaseId?: string; question: string };
    
    if (!knowledgeBaseId) {
      return {
        success: true,
        data: { tips: [], sampleAnswers: [], keyPoints: [] },
        executionTimeMs: Date.now() - startTime,
      };
    }
    
    try {
      const kb = await getKnowledgeBaseById(parseInt(knowledgeBaseId, 10));
      if (!kb) {
        return {
          success: true,
          data: { tips: [], sampleAnswers: [], keyPoints: [] },
          executionTimeMs: Date.now() - startTime,
        };
      }
      
      // 查找相关问题
      const questionLower = question.toLowerCase();
      const relatedQuestions = kb.questions.filter(q => {
        const qLower = q.question.toLowerCase();
        return qLower.includes(questionLower.slice(0, 30)) ||
               questionLower.includes(qLower.slice(0, 30));
      }).slice(0, 3);
      
      const sampleAnswers = relatedQuestions
        .filter(q => q.sampleAnswer)
        .map(q => q.sampleAnswer);
      
      // 提取关键要点（从示例答案中提取）
      const keyPoints = sampleAnswers
        .flatMap(answer => {
          // 从示例答案中提取要点
          const points: string[] = [];
          if (answer && answer.length > 50) {
            points.push(answer.slice(0, 100) + '...');
          }
          return points;
        })
        .slice(0, 5);
      
      return {
        success: true,
        data: {
          tips: kb.tips?.slice(0, 3).map(t => t.tip) || [],
          sampleAnswers,
          keyPoints,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get knowledge',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

const searchInterviewExamplesTool: Tool = {
  name: 'search_interview_examples',
  description: '搜索 Glassdoor 上的真实面试经验，获取其他人是如何回答类似问题的',
  parameters: {
    type: 'object',
    properties: {
      company: { type: 'string', description: '公司名称（可选）' },
      question: { type: 'string', description: '面试问题关键词' },
    },
    required: ['question'],
  },
  estimatedTimeMs: 3000,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    const { company, question } = params as { company?: string; question: string };
    
    try {
      const searchQuery = company ? `${company} interview ${question}` : `interview ${question}`;
      const results = await searchGlassdoor(searchQuery, 3);
      
      const examples = results.slice(0, 3).map(r => ({
        title: r.title,
        content: r.content.slice(0, 500),
        difficulty: r.metadata?.difficulty,
        experience: r.metadata?.experience,
      }));
      
      return {
        success: true,
        data: { examples },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

const hintTools: Tool[] = [
  analyzeUserStruggleTool, 
  getRelatedKnowledgeTool,
  searchInterviewExamplesTool
];

// ==================== Agent 配置 ====================

const hintConfig: ReActConfig = {
  moduleName: 'hint_system',
  thinking: {
    maxSteps: 4, // 增加步数以获取更详细的信息
    requiredThoughts: ['Why is the user struggling?', 'What specific help do they need?'],
    adaptiveDepth: true,
  },
  tools: hintTools,
  timeBudget: {
    maxTimeMs: 8000, // 增加时间预算以获取更好的提示
    priority: 'quality',
    warningThresholdMs: 6000,
  },
  quality: {
    minScore: 0.7,
    earlyStopOnQuality: true,
  },
};

// ==================== Agent 实现 ====================

export class HintAgent extends BaseReActAgent<HintInput, GeneratedHint> {
  constructor() {
    super(hintConfig);
  }

  protected buildSystemPrompt(input: HintInput, _context: Record<string, unknown>): string {
    const isZh = input.language === 'zh';
    const hintLevel = input.hintLevel || 3; // 默认给详细提示

    const recentHistory = input.conversationHistory.slice(-4)
      .map(m => `${m.role}: ${m.content.slice(0, 150)}...`)
      .join('\n');

    return isZh
      ? `你是一位经验丰富的面试教练。用户正在练习面试，遇到了困难，需要你的帮助。

## 当前情况
- 问题：${input.question}
- 话题：${input.topicName || '未指定'}
- 目标职位：${input.targetPosition || '未指定'}
- 用户的尝试：${input.userResponse || '还没有开始回答'}

## 最近对话
${recentHistory}

## 你的任务
提供**尽可能详细和有帮助**的提示。不需要担心"剧透"——用户来这里就是为了学习如何回答。

你应该：
1. 首先分析用户为什么卡住（使用 analyze_user_struggle 工具）
2. 如果有知识库，获取相关信息（使用 get_related_knowledge 工具）
3. 搜索真实面试经验作为参考（使用 search_interview_examples 工具）
4. 基于收集的信息，生成详细的提示

## 提示应包含
1. **问题解读**：这个问题在考察什么能力？面试官想听到什么？
2. **回答框架**：推荐的回答结构（如 STAR 方法）
3. **具体要点**：应该提到的 3-5 个关键点
4. **示例片段**：一个简短的示例回答开头，帮助用户启动
5. **避免的坑**：常见错误和应该避免的内容

## 输出格式
最终答案必须是 JSON 格式：
{
  "hint": "完整的提示内容（包含上述所有部分）",
  "hintType": "detailed",
  "reasoning": "为什么给这个提示",
  "nextHintAvailable": true/false,
  "samplePoints": ["要点1", "要点2", "要点3"],
  "exampleAnswer": "示例回答开头..."
}`
      : `You are an experienced interview coach. The user is practicing for interviews and needs your help.

## Current Situation
- Question: ${input.question}
- Topic: ${input.topicName || 'Not specified'}
- Target Position: ${input.targetPosition || 'Not specified'}
- User's Attempt: ${input.userResponse || 'Has not started yet'}

## Recent Conversation
${recentHistory}

## Your Task
Provide **as detailed and helpful** hints as possible. Don't worry about "spoilers" - the user is here to learn how to answer.

You should:
1. First analyze why the user is stuck (use analyze_user_struggle tool)
2. If there's a knowledge base, get related info (use get_related_knowledge tool)
3. Search for real interview experiences as reference (use search_interview_examples tool)
4. Based on collected info, generate detailed hints

## Hints Should Include
1. **Question Analysis**: What skills is this testing? What does the interviewer want to hear?
2. **Answer Framework**: Recommended structure (e.g., STAR method)
3. **Key Points**: 3-5 specific points to mention
4. **Example Snippet**: A brief example answer opening to help user start
5. **Pitfalls to Avoid**: Common mistakes and what to avoid

## Output Format
Final answer MUST be in JSON format:
{
  "hint": "Complete hint content (including all above sections)",
  "hintType": "detailed",
  "reasoning": "Why this hint",
  "nextHintAvailable": true/false,
  "samplePoints": ["point1", "point2", "point3"],
  "exampleAnswer": "Example answer opening..."
}`;
  }

  protected parseOutput(thought: string, _trace: ReActTrace): GeneratedHint | null {
    try {
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.hint || !parsed.hintType) return null;

      return {
        hint: parsed.hint,
        hintType: parsed.hintType,
        reasoning: parsed.reasoning || '',
        nextHintAvailable: parsed.nextHintAvailable ?? true,
        samplePoints: parsed.samplePoints || [],
        exampleAnswer: parsed.exampleAnswer || '',
      };
    } catch {
      return null;
    }
  }
}

// ==================== 便捷函数 ====================

/**
 * 使用 ReAct Agent 生成详细提示
 */
export async function generateHintWithReAct(input: HintInput): Promise<GeneratedHint | null> {
  const agent = new HintAgent();
  const result = await agent.execute(input);

  if (result.success && result.output) {
    console.log(`[HintAgent] Generated detailed hint in ${result.trace.totalTimeMs}ms`);
    return result.output;
  }

  // 详细的回退提示
  const isZh = input.language === 'zh';
  return {
    hint: isZh
      ? `好的，让我帮你分析一下这个问题。

**问题解读**
这个问题主要考察你的实际经验和解决问题的能力。面试官想了解你如何处理真实的工作场景。

**推荐框架：STAR 方法**
- **S**ituation（情境）：描述背景和挑战
- **T**ask（任务）：你需要完成什么
- **A**ction（行动）：你具体做了什么
- **R**esult（结果）：最终效果如何

**可以提到的要点**
1. 具体的项目或任务背景
2. 你面临的主要挑战
3. 你采取的具体行动步骤
4. 可量化的结果（数字、百分比）
5. 你学到的经验

**示例开头**
"在我上一份工作中，我们团队面临了一个紧急的性能优化问题..."

**避免的坑**
- 不要只说"我们做了..."，要强调"我"的贡献
- 避免太笼统，要有具体细节
- 不要忘记说结果`
      : `Let me help you analyze this question.

**Question Analysis**
This question mainly tests your practical experience and problem-solving ability. The interviewer wants to understand how you handle real work scenarios.

**Recommended Framework: STAR Method**
- **S**ituation: Describe the background and challenges
- **T**ask: What you needed to accomplish
- **A**ction: What you specifically did
- **R**esult: What was the outcome

**Key Points to Mention**
1. Specific project or task background
2. Main challenges you faced
3. Specific action steps you took
4. Quantifiable results (numbers, percentages)
5. Lessons learned

**Example Opening**
"In my previous role, our team faced an urgent performance optimization issue..."

**Pitfalls to Avoid**
- Don't just say "we did...", emphasize YOUR contribution
- Avoid being too general, include specific details
- Don't forget to mention the results`,
    hintType: 'detailed',
    reasoning: 'Fallback detailed hint',
    nextHintAvailable: true,
    samplePoints: isZh 
      ? ['具体背景', '面临的挑战', '采取的行动', '量化结果', '学到的经验']
      : ['Specific background', 'Challenges faced', 'Actions taken', 'Quantified results', 'Lessons learned'],
    exampleAnswer: isZh
      ? '在我上一份工作中，我们团队面临了一个紧急的性能优化问题...'
      : 'In my previous role, our team faced an urgent performance optimization issue...',
  };
}
