/**
 * 话题练习模式 - 后端路由
 * 
 * 核心设计：
 * 1. 信息点驱动而非轮次驱动
 * 2. 非阻塞设计：用户随时可换话题或结束
 * 3. 专业反馈：展示 UHired 专业能力
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { invokeLLM } from '../../_core/llm';
import { suggestNextTopic, generateEngagedPrompt, generateTimeLimitPrompt, generateTopicCompletePrompt } from './topicStatusEvaluator';
import { processTopicMessage } from './topicMessageProcessor';
import { generateTopicFeedback, generateCompanyMatches, generateEncouragementFeedback } from './topicFeedbackGenerator';
import type { TopicContext, CollectedInfoPoint, TopicFeedback, CompanyMatch } from './types';

// 内存存储（生产环境应使用数据库）
const topicSessions = new Map<string, TopicPracticeSession>();

interface TopicPracticeSession {
  id: string;
  userId: number;
  targetPosition: string;
  resumeText?: string; // 用户简历内容
  currentTopic: TopicContext | null;
  completedTopics: TopicContext[];
  topicHistory: string[]; // 已出过的话题名称，用于避免重复
  feedbacks: TopicFeedback[];
  companyMatches: CompanyMatch[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `tp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 开始话题练习会话
 */
export async function startTopicPractice(
  userId: number,
  targetPosition: string,
  resumeText?: string
): Promise<{
  sessionId: string;
  topic: TopicContext;
  openingMessage: string;
}> {
  const sessionId = generateId();
  
  // 生成第一个话题（传入简历上下文）
  const topic = await generateInitialTopic(targetPosition, resumeText);
  
  // 生成开场消息（传入简历上下文）
  const openingMessage = await generateOpeningMessage(targetPosition, topic, resumeText);
  
  // 添加 AI 消息到话题历史
  topic.messages.push({
    role: 'assistant',
    content: openingMessage,
    timestamp: new Date().toISOString()
  });
  
  // 创建会话（存储简历内容）
  const session: TopicPracticeSession = {
    id: sessionId,
    userId,
    targetPosition,
    resumeText,
    currentTopic: topic,
    completedTopics: [],
    topicHistory: [topic.name], // 记录第一个话题
    feedbacks: [],
    companyMatches: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  topicSessions.set(sessionId, session);
  
  return {
    sessionId,
    topic,
    openingMessage
  };
}

/**
 * 发送消息并获取 AI 回复
 */
export async function sendTopicMessage(
  sessionId: string,
  userId: number,
  userMessage: string
): Promise<{
  aiResponse: string;
  topicStatus: 'collecting' | 'collected' | 'abandoned' | 'engaged';
  userIntent: 'continue' | 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback';
  feedback?: TopicFeedback;
  hint?: string;
  suggestedNextTopic?: string;
  engagedPrompt?: string;
  collectedInfo?: CollectedInfoPoint[];
}> {
  const session = topicSessions.get(sessionId);
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
  }
  if (session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  }
  if (!session.currentTopic) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active topic' });
  }
  
  const topic = session.currentTopic;
  
  // 使用合并的处理器（一次 LLM 调用完成意图检测 + 状态评估 + 追问生成）
  const processResult = await processTopicMessage(userMessage, topic, session.targetPosition);
  
  // 处理特殊意图（由规则匹配得到）
  if (processResult.intent === 'end_interview') {
    const feedback = topic.collectedInfo.length > 0
      ? await generateTopicFeedback(topic, session.targetPosition)
      : generateEncouragementFeedback(topic, session.targetPosition);
    
    session.feedbacks.push(feedback);
    session.completedTopics.push(topic);
    session.currentTopic = null;
    session.updatedAt = new Date().toISOString();
    
    session.companyMatches = await generateCompanyMatches(
      session.completedTopics,
      session.targetPosition
    );
    
    return {
      aiResponse: '好的，我们可以在这里结束。让我为你总结一下这次面试的表现...',
      topicStatus: 'collected',
      userIntent: 'end_interview',
      feedback
    };
  }
  
  if (processResult.intent === 'switch_topic') {
    const feedback = topic.collectedInfo.length > 0
      ? await generateTopicFeedback(topic, session.targetPosition)
      : generateEncouragementFeedback(topic, session.targetPosition);
    
    session.feedbacks.push(feedback);
    session.completedTopics.push(topic);
    
    const nextTopicSuggestion = await suggestNextTopic(
      session.completedTopics,
      session.targetPosition,
      undefined,
      session.topicHistory
    );
    
    const newTopic = await generateTopicFromName(
      nextTopicSuggestion.suggestedTopic,
      session.targetPosition
    );
    session.currentTopic = newTopic;
    session.topicHistory.push(newTopic.name); // 记录新话题到历史
    session.updatedAt = new Date().toISOString();
    
    const openingMessage = await generateOpeningMessage(session.targetPosition, newTopic);
    newTopic.messages.push({
      role: 'assistant',
      content: openingMessage,
      timestamp: new Date().toISOString()
    });
    
    return {
      aiResponse: `好的，我们换个话题。${openingMessage}`,
      topicStatus: 'collecting',
      userIntent: 'switch_topic',
      feedback,
      suggestedNextTopic: nextTopicSuggestion.suggestedTopic
    };
  }
  
  if (processResult.intent === 'need_hint') {
    const hint = await generateHint(topic, session.targetPosition);
    
    return {
      aiResponse: hint,
      topicStatus: 'collecting',
      userIntent: 'need_hint',
      hint
    };
  }
  
  // 正常对话流程：添加用户消息
  topic.messages.push({
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  });
  
  // 更新收集到的信息
  if (processResult.newInfoPoints.length > 0) {
    topic.collectedInfo.push(...processResult.newInfoPoints);
  }
  
  // 根据状态生成回复
  let aiResponse: string;
  let feedback: TopicFeedback | undefined;
  let engagedPrompt: string | undefined;
  
  // 硬约束：强制结束
  if (processResult.forceEnd) {
    feedback = await generateTopicFeedback(topic, session.targetPosition);
    session.feedbacks.push(feedback);
    session.completedTopics.push(topic);
    
    if (processResult.forceEndReason === 'time_limit') {
      aiResponse = generateTimeLimitPrompt(true);
    } else {
      aiResponse = generateTopicCompletePrompt(true);
    }
    
    const nextTopicSuggestion = await suggestNextTopic(
      session.completedTopics,
      session.targetPosition,
      undefined,
      session.topicHistory
    );
    
    aiResponse += `\n\n如果你准备好了，我们可以继续聊聊“${nextTopicSuggestion.suggestedTopic}”。`;
    
    const newTopic = await generateTopicFromName(
      nextTopicSuggestion.suggestedTopic,
      session.targetPosition
    );
    session.currentTopic = newTopic;
    
  } else if (processResult.status === 'collected') {
    feedback = await generateTopicFeedback(topic, session.targetPosition);
    session.feedbacks.push(feedback);
    session.completedTopics.push(topic);
    
    const nextTopicSuggestion = await suggestNextTopic(
      session.completedTopics,
      session.targetPosition,
      undefined,
      session.topicHistory
    );
    
    aiResponse = `很好！关于这个话题，我已经了解了你的情况。

我有一些反馈想分享给你。

如果你准备好了，我们可以继续聊聊“${nextTopicSuggestion.suggestedTopic}”。
或者你也可以说“换个话题”选择其他方向，或者“结束面试”获取完整评估。`;
    
    const newTopic = await generateTopicFromName(
      nextTopicSuggestion.suggestedTopic,
      session.targetPosition
    );
    session.currentTopic = newTopic;
    
  } else if (processResult.status === 'abandoned') {
    feedback = generateEncouragementFeedback(topic, session.targetPosition);
    session.feedbacks.push(feedback);
    session.completedTopics.push(topic);
    
    const nextTopicSuggestion = await suggestNextTopic(
      session.completedTopics,
      session.targetPosition,
      undefined,
      session.topicHistory
    );
    
    aiResponse = `没关系，这个话题我们可以先放一放。

如果你想的话，我们可以聊聊“${nextTopicSuggestion.suggestedTopic}”？
或者你也可以说“换个话题”选择其他方向。`;
    
    const newTopic = await generateTopicFromName(
      nextTopicSuggestion.suggestedTopic,
      session.targetPosition
    );
    session.currentTopic = newTopic;
    
  } else if (processResult.status === 'engaged') {
    engagedPrompt = generateEngagedPrompt(true);
    aiResponse = processResult.aiResponse;
    aiResponse += `\n\n💡 ${engagedPrompt}`;
    
  } else {
    // 继续收集信息 - 直接使用合并处理器生成的追问
    aiResponse = processResult.aiResponse;
  }
  
  // 添加 AI 回复到历史
  topic.messages.push({
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString()
  });
  
  topic.status = processResult.status;
  session.updatedAt = new Date().toISOString();
  
  return {
    aiResponse,
    topicStatus: processResult.status,
    userIntent: processResult.intent,
    feedback,
    engagedPrompt,
    // 返回当前话题的信息收集点，用于前端深度指示器
    collectedInfo: topic.collectedInfo || []
  };
}

/**
 * 结束话题练习并获取完整评估
 * 
 * 优化策略（目标：≤20秒）：
 * 1. 所有操作并行执行
 * 2. 公司推荐使用 8 秒超时（快速回退到 LLM 方案）
 * 3. 反馈生成使用快速模式
 */
export async function endTopicPractice(
  sessionId: string,
  userId: number
): Promise<{
  feedbacks: TopicFeedback[];
  companyMatches: CompanyMatch[];
  overallSummary: string;
}> {
  const startTime = Date.now();
  console.log('[endTopicPractice] Starting report generation...');
  
  const session = topicSessions.get(sessionId);
  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
  }
  if (session.userId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
  }
  
  // 并行执行所有操作
  const promises: Promise<any>[] = [];
  
  // 1. 如果当前话题有内容，并行生成反馈
  let currentTopicFeedbackPromise: Promise<TopicFeedback | null> = Promise.resolve(null);
  if (session.currentTopic && session.currentTopic.collectedInfo.length > 0) {
    currentTopicFeedbackPromise = generateTopicFeedbackFast(session.currentTopic, session.targetPosition);
    session.completedTopics.push(session.currentTopic);
  }
  
  // 2. 公司推荐（8秒超时，快速回退）
  const companyMatchesPromise = session.companyMatches.length === 0 
    ? generateCompanyMatchesWithTimeout(session.completedTopics, session.targetPosition, 8000)
    : Promise.resolve(session.companyMatches);
  
  // 3. 整体总结
  const overallSummaryPromise = generateOverallSummary(session);
  
  // 并行等待所有结果
  const [currentTopicFeedback, companyMatches, overallSummary] = await Promise.all([
    currentTopicFeedbackPromise,
    companyMatchesPromise,
    overallSummaryPromise
  ]);
  
  // 合并反馈
  if (currentTopicFeedback) {
    session.feedbacks.push(currentTopicFeedback);
  }
  
  session.companyMatches = companyMatches;
  
  // 清理会话
  session.currentTopic = null;
  session.updatedAt = new Date().toISOString();
  
  const totalTime = Date.now() - startTime;
  console.log(`[endTopicPractice] Report generation completed in ${totalTime}ms`);
  
  return {
    feedbacks: session.feedbacks,
    companyMatches: session.companyMatches,
    overallSummary
  };
}

/**
 * 快速生成话题反馈（不使用 ReAct Agent，直接 LLM）
 */
async function generateTopicFeedbackFast(
  topicContext: TopicContext,
  targetPosition: string
): Promise<TopicFeedback> {
  const collectedInfoSummary = topicContext.collectedInfo
    .map(info => `- ${info.summary}`)
    .join('\n');

  const conversationSummary = topicContext.messages
    .slice(-6) // Only take last 6 messages
    .map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content.slice(0, 200)}`)
    .join('\n');

  const prompt = `Quickly evaluate the candidate's performance on the "${topicContext.name}" topic.

Target Position: ${targetPosition}
Collected Information:
${collectedInfoSummary || 'Limited'}

Conversation Summary:
${conversationSummary}

Return JSON in English:
{
  "score": 7,
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1"],
  "suggestion": "one sentence suggestion"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'quick_feedback',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              strengths: { type: 'array', items: { type: 'string' } },
              gaps: { type: 'array', items: { type: 'string' } },
              suggestion: { type: 'string' }
            },
            required: ['score', 'strengths', 'gaps', 'suggestion'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      // Clean markdown code blocks if present
      const cleanedContent = content.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanedContent);
      return {
        topicId: topicContext.id,
        questionSource: {
          description: 'Common interview questions',
          frequency: 'medium'
        },
        targetAbility: {
          primary: topicContext.targetSkills[0] || 'General ability',
          secondary: topicContext.targetSkills.slice(1),
          rationale: 'Evaluate candidate related abilities'
        },
        performanceAnalysis: {
          strengths: parsed.strengths,
          gaps: parsed.gaps,
          details: parsed.suggestion
        },
        improvementSuggestions: {
          immediate: [parsed.suggestion],
          longTerm: ['Continue accumulating project experience']
        },
        score: parsed.score
      };
    }
  } catch (error) {
    console.error('[generateTopicFeedbackFast] Error:', error);
  }

  // Default feedback
  return {
    topicId: topicContext.id,
    questionSource: { description: 'Common interview questions', frequency: 'medium' },
    targetAbility: {
      primary: topicContext.targetSkills[0] || 'General ability',
      secondary: [],
      rationale: 'Evaluate candidate ability'
    },
    performanceAnalysis: {
      strengths: ['Active participation'],
      gaps: ['Could provide more details'],
      details: 'Recommend using STAR structure'
    },
    improvementSuggestions: {
      immediate: ['Use STAR structure'],
      longTerm: ['Accumulate experience']
    },
    score: 6
  };
}

/**
 * 带超时的公司推荐生成
 */
async function generateCompanyMatchesWithTimeout(
  completedTopics: TopicContext[],
  targetPosition: string,
  timeoutMs: number
): Promise<CompanyMatch[]> {
  try {
    const result = await Promise.race([
      generateCompanyMatches(completedTopics, targetPosition),
      new Promise<CompanyMatch[]>((_, reject) => 
        setTimeout(() => reject(new Error('Company matches timeout')), timeoutMs)
      )
    ]);
    return result;
  } catch (error) {
    console.log('[endTopicPractice] Company matches timed out, using fallback');
    // 超时时使用简单的回退方案
    return generateQuickCompanyMatches(completedTopics, targetPosition);
  }
}

/**
 * 快速生成公司推荐（不使用 LinkedIn 搜索）
 */
async function generateQuickCompanyMatches(
  completedTopics: TopicContext[],
  targetPosition: string
): Promise<CompanyMatch[]> {
  const allCollectedInfo = completedTopics.flatMap(t => t.collectedInfo);
  
  const skillsSummary = allCollectedInfo
    .filter(info => info.type === 'skill_claim')
    .map(info => info.summary)
    .join(', ');

  const prompt = `As a career advisor, please recommend matching companies based on the candidate's demonstrated abilities.

## Candidate Information
- Target Position: ${targetPosition}
- Demonstrated Skills: ${skillsSummary || 'To be evaluated'}

## Requirements
1. Recommend 3 matching companies
2. Explain matching reasons
3. Describe key skills valued by each company
4. Provide preparation tips

Return JSON array in English:
[
  {
    "company": "Company Name",
    "matchScore": 85,
    "reasons": ["reason1", "reason2"],
    "keySkills": ["skill1", "skill2"],
    "preparationTips": ["tip1", "tip2"]
  }
]`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'company_matches',
          strict: true,
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                matchScore: { type: 'number' },
                reasons: { type: 'array', items: { type: 'string' } },
                keySkills: { type: 'array', items: { type: 'string' } },
                preparationTips: { type: 'array', items: { type: 'string' } }
              },
              required: ['company', 'matchScore', 'reasons', 'keySkills', 'preparationTips'],
              additionalProperties: false
            }
          }
        }
      }
    });
    
    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[generateQuickCompanyMatches] Error:', error);
  }
  
  // Default recommendations
  return [
    {
      company: 'Tech Company',
      matchScore: 70,
      reasons: ['Position match'],
      keySkills: ['Technical ability', 'Communication skills'],
      preparationTips: ['Learn about company products', 'Prepare technical questions']
    }
  ];
}

/**
 * 获取会话状态
 */
export function getTopicPracticeSession(
  sessionId: string,
  userId: number
): TopicPracticeSession | null {
  const session = topicSessions.get(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }
  return session;
}

// ==================== 辅助函数 ====================

/**
 * 检测是否为技术岗位
 */
function isTechnicalPosition(position: string): boolean {
  const technicalKeywords = [
    'engineer', 'developer', 'programmer', 'swe', 'sde', 'software',
    'backend', 'frontend', 'fullstack', 'full-stack', 'full stack',
    'devops', 'data scientist', 'machine learning', 'ml', 'ai',
    '工程师', '开发', '程序员', '后端', '前端', '全栈', '架构师',
    'architect', 'tech lead', 'technical', 'platform', 'infrastructure'
  ];
  const lowerPosition = position.toLowerCase();
  return technicalKeywords.some(keyword => lowerPosition.includes(keyword));
}

/**
 * 生成初始话题
 */
async function generateInitialTopic(targetPosition: string, resumeText?: string): Promise<TopicContext> {
  const isTechnical = isTechnicalPosition(targetPosition);
  
  // Resume context section
  const resumeContext = resumeText ? `

Candidate's Resume Summary:
${resumeText.slice(0, 2000)}

Important: Generate more targeted topics based on the candidate's resume:
- If specific projects are mentioned, focus on technical details of those projects
- If specific tech stacks are mentioned, ask in-depth questions about them
- If there are experience gaps, probe those areas
` : '';
  
  // Technical positions use more specific technical topics
  const technicalPrompt = `Generate a **specific technical topic** for the ${targetPosition} position interview.${resumeContext}

Important requirements:
1. Must be a specific technical question, not generic "project experience" or "self-introduction"
2. Question should have technical depth to assess actual programming/system design abilities
3. Suitable as an opening for technical interviews, but not too simple
${resumeText ? '4. If relevant project experience is in the resume, prioritize questions about those projects' : ''}

Good topic examples:
- "Design a distributed caching system"
- "Implement an LRU cache"
- "Optimize a slow database query"
- "Design a message queue system"
- "Handle high-concurrency requests"

Bad topic examples (too general):
- "Introduce yourself"
- "Tell me about your project experience"
- "Your proudest project"

Return JSON:
{
  "name": "Specific technical topic name",
  "targetSkills": ["Technical skill 1 to assess", "Technical skill 2 to assess"],
  "source": "Question source (e.g., Google system design interview high-frequency question)",
  "difficulty": "Difficulty level (easy/medium/hard) - based on question complexity"
}`;

  // Non-technical positions use general topics
  const generalPrompt = `Generate a suitable opening topic for the ${targetPosition} position interview.

Requirements:
1. Topic should be common in interviews and easy to answer
2. Suitable as a warm-up topic for the interview
3. Allows candidates to showcase relevant experience

Return JSON:
{
  "name": "Topic name",
  "targetSkills": ["Skill 1 to assess", "Skill 2 to assess"],
  "source": "Question source description (e.g., Google behavioral interview high-frequency question)",
  "difficulty": "Difficulty level (easy/medium/hard)"
}`;

  const prompt = isTechnical ? technicalPrompt : generalPrompt;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'initial_topic',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              targetSkills: { type: 'array', items: { type: 'string' } },
              source: { type: 'string' },
              difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
            },
            required: ['name', 'targetSkills', 'source', 'difficulty'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      // Clean markdown code blocks if present
      const cleanedContent = content.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanedContent);
      return {
        id: generateId(),
        name: parsed.name,
        status: 'collecting',
        startedAt: new Date().toISOString(),
        messages: [],
        collectedInfo: [],
        source: parsed.source,
        targetSkills: parsed.targetSkills,
        difficulty: parsed.difficulty as 'easy' | 'medium' | 'hard'
      };
    }
  } catch (error) {
    console.error('[generateInitialTopic] Error:', error);
  }

  // Default topic
  return {
    id: generateId(),
    name: 'Project Experience',
    status: 'collecting',
    startedAt: new Date().toISOString(),
    messages: [],
    collectedInfo: [],
    source: 'Common interview questions',
    targetSkills: ['Project Management', 'Technical Skills', 'Problem Solving'],
    difficulty: 'medium'
  };
}

/**
 * 从话题名称生成话题上下文
 */
async function generateTopicFromName(topicName: string, targetPosition: string): Promise<TopicContext> {
  const prompt = `为 ${targetPosition} 职位面试的"${topicName}"话题生成详细信息。

返回 JSON：
{
  "targetSkills": ["考核能力1", "考核能力2"],
  "source": "问题来源描述",
  "difficulty": "难度级别（easy/medium/hard）"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'topic_details',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              targetSkills: { type: 'array', items: { type: 'string' } },
              source: { type: 'string' },
              difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }
            },
            required: ['targetSkills', 'source', 'difficulty'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      // Clean markdown code blocks if present
      const cleanedContent = content.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleanedContent);
      return {
        id: generateId(),
        name: topicName,
        status: 'collecting',
        startedAt: new Date().toISOString(),
        messages: [],
        collectedInfo: [],
        source: parsed.source,
        targetSkills: parsed.targetSkills,
        difficulty: parsed.difficulty as 'easy' | 'medium' | 'hard'
      };
    }
  } catch (error) {
    console.error('[generateTopicFromName] Error:', error);
  }

  return {
    id: generateId(),
    name: topicName,
    status: 'collecting',
    startedAt: new Date().toISOString(),
    messages: [],
    collectedInfo: [],
    source: '面试常见话题',
    targetSkills: ['相关能力'],
    difficulty: 'medium'
  };
}

/**
 * 生成开场消息
 */
async function generateOpeningMessage(targetPosition: string, topic: TopicContext, resumeText?: string): Promise<string> {
  const isTechnical = isTechnicalPosition(targetPosition);
  
  // Resume context
  const resumeContext = resumeText ? `

Candidate's Resume Summary:
${resumeText.slice(0, 1500)}

Important: Generate more targeted questions based on the candidate's resume:
- If specific projects are mentioned, ask about technical details of those projects
- If specific tech stacks are mentioned, ask in-depth questions about them
- Questions should be relevant to the candidate's experience to let them showcase their strengths
` : '';
  
  const technicalPrompt = `You are UHired's technical interviewer conducting a technical interview for the ${targetPosition} position.

Current Topic: ${topic.name}
Target Skills: ${topic.targetSkills.join(', ')}${resumeContext}

Please provide a **specific technical question** directly. Requirements:
1. Ask the question directly without any opening remarks
2. The question must be specific and have technical depth, not too general
3. Can be about system design, algorithms, technical solutions, etc.
4. Professional but friendly tone
5. Don't remind users they can switch topics or end the interview
${resumeText ? '6. If relevant projects are mentioned in the resume, prioritize asking about those to let the candidate showcase their actual experience' : ''}

Good question examples:
- "Design a URL shortening service that supports millions of QPS. Walk me through your overall architecture."
- "How would you implement a thread-safe LRU cache? Please explain your data structure choices."
- "Suppose you need to optimize a database query that takes over 5 seconds to execute. What approaches would you take?"
${resumeText ? '- "I see you mentioned the XXX project in your resume. Can you tell me more about your technical contributions?"' : ''}

Bad question examples (too general):
- "Describe a project you've worked on"
- "Tell me about your technical background"

Return the question directly, no JSON.`;

  const generalPrompt = `You are UHired's interview assistant conducting topic practice for the ${targetPosition} position.

Current Topic: ${topic.name}
Target Skills: ${topic.targetSkills.join(', ')}

Please provide the first interview question directly. Requirements:
1. Ask the question directly without any opening remarks or lead-ins (like "let's begin", "feel free to start", etc.)
2. The question should be specific, not too general
3. Make it easy for the candidate to start answering
4. Friendly but professional tone
5. Don't remind users they can switch topics or end - these prompts are shown in the UI

Return the question directly, no JSON, no prefix or suffix.`;

  const prompt = isTechnical ? technicalPrompt : generalPrompt;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateOpeningMessage] Error:', error);
  }

  return `Let's talk about ${topic.name}. Can you tell me about your experience in this area?

(Tip: You can say "switch topic" or "end interview" at any time)`;
}

/**
 * 生成追问问题
 * 
 * 简化为 Prompt 方式（不用 ReAct），带上用户 context 和问题生成 context
 */
async function generateFollowUpQuestion(
  topic: TopicContext, 
  targetPosition: string,
  userContext?: {
    resumeSummary?: string;
    previousTopics?: string[];
    userStrengths?: string[];
  }
): Promise<string> {
  // 收集的信息点
  const collectedSummary = topic.collectedInfo
    .map(info => `- ${info.type}: ${info.summary} (深度: ${info.depth}/5)`)
    .join('\n');

  // 最近对话
  const recentMessages = topic.messages.slice(-6)
    .map(m => `${m.role === 'user' ? '候选人' : '面试官'}: ${m.content}`)
    .join('\n');

  // 当前轮次
  const currentRound = Math.floor(topic.messages.filter(m => m.role === 'user').length);

  // 用户上下文
  const userContextSection = userContext ? `
## 用户背景
${userContext.resumeSummary ? `简历摘要: ${userContext.resumeSummary}` : ''}
${userContext.previousTopics?.length ? `已讨论话题: ${userContext.previousTopics.join(', ')}` : ''}
${userContext.userStrengths?.length ? `展示的优势: ${userContext.userStrengths.join(', ')}` : ''}
` : '';

  const prompt = `你是一位资深面试官，正在进行 ${targetPosition} 职位的“${topic.name}”话题面试。
${userContextSection}
## 当前话题信息
- 话题: ${topic.name}
- 考核能力: ${topic.targetSkills.join('、')}
- 当前轮次: ${currentRound}

## 已收集的信息点
${collectedSummary || '暂无'}

## 最近对话
${recentMessages}

## 任务
请生成下一个问题。决策标准：

1. **追问** - 如果候选人的回答缺少具体细节（数字、方法、结果），追问深入
2. **换角度** - 如果当前角度已经深入，从其他角度探索同一话题
3. **总结过渡** - 如果信息已足够，给出简短反馈并过渡到下一个方面

要求：
- 直接返回问题，不要 JSON
- 语气友好但专业
- 不要重复已经问过的问题
- 不要提醒用户可以换话题或结束（界面上已有按钮）`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateFollowUpQuestion] Error:', error);
  }

  return '能详细说说吗？比如具体是怎么做的，结果如何？';
}

/**
 * 生成提示（使用 ReAct Agent，详细+允许剧透）
 */
async function generateHint(topic: TopicContext, targetPosition: string): Promise<string> {
  // 尝试使用 ReAct Agent 生成详细提示
  try {
    const { generateHintWithReAct } = await import('../react/hintAgent');
    
    const recentMessages = topic.messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    const lastUserMessage = topic.messages
      .filter(m => m.role === 'user')
      .pop()?.content || '';
    
    const result = await generateHintWithReAct({
      question: topic.messages[0]?.content || topic.name,
      userResponse: lastUserMessage,
      conversationHistory: recentMessages,
      language: 'en',
      hintLevel: 3, // 详细提示
      targetPosition,
      topicName: topic.name
    });
    
    if (result && result.hint) {
      return result.hint;
    }
  } catch (error) {
    console.error('[generateHint] ReAct Agent error:', error);
  }
  
  // 回退到原来的 LLM 方式（但也要详细）
  const prompt = `候选人在回答 ${targetPosition} 职位面试的“${topic.name}”话题时遇到困难，需要详细的提示。

考核能力：${topic.targetSkills.join('、')}

请提供一个**尽可能详细**的提示，包括：

1. **问题解读**：这个问题在考察什么能力？面试官想听到什么？
2. **回答框架**：推荐的回答结构（如 STAR 方法）
3. **具体要点**：应该提到的 3-5 个关键点
4. **示例片段**：一个简短的示例回答开头
5. **避免的坑**：常见错误和应该避免的内容

语气要鼓励和支持。直接返回提示文本。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateHint] LLM error:', error);
  }

  return `好的，让我帮你分析一下这个问题。

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
- 不要忘记说结果`;
}

/**
 * 生成整体总结
 */
async function generateOverallSummary(session: TopicPracticeSession): Promise<string> {
  const topicsSummary = session.completedTopics
    .map(t => `- ${t.name}: ${t.collectedInfo.length} information points`)
    .join('\n');

  const feedbacksSummary = session.feedbacks
    .map(f => `- ${f.targetAbility.primary}: ${f.score}/10`)
    .join('\n');

  const prompt = `Generate an overall summary for the candidate's interview practice.

Target Position: ${session.targetPosition}

Completed Topics:
${topicsSummary || 'None'}

Topic Scores:
${feedbacksSummary || 'None'}

Please generate an encouraging summary that includes:
1. Overall performance overview
2. Main strengths
3. Areas for improvement
4. Next steps recommendations

Tone should be positive and constructive. Return the summary text directly in English.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateOverallSummary] Error:', error);
  }

  return `Thank you for completing this interview practice!

You demonstrated some excellent qualities - keep it up! There are also areas where you can improve. I recommend more practice and accumulating more specific examples.

Good luck with your interviews!`;
}

// 导出类型
export type { TopicPracticeSession };
