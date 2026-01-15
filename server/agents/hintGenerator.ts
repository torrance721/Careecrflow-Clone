/**
 * Hint Generator Agent
 * 
 * Generates helpful hints for interview questions based on:
 * 1. The current question being asked
 * 2. The user's previous responses (context)
 * 3. Knowledge base data (if available)
 * 4. The user's apparent struggle or confusion
 */

import { invokeLLM } from '../_core/llm';
import { getKnowledgeBaseById } from './knowledgeBaseService';

export interface HintRequest {
  question: string;
  userResponse?: string;  // User's partial or attempted response
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  knowledgeBaseId?: number;
  language: 'en' | 'zh';
}

export interface HintResponse {
  hint: string;
  reasoning: string;  // Why this hint is being provided
  hintType: 'clarification' | 'structure' | 'example' | 'keyword' | 'approach';
  relatedQuestion?: string;  // If from knowledge base
  trace?: {
    steps: Array<{
      step: number;
      thought: string;
      action?: { tool: string; params: Record<string, unknown> };
      observation?: string;
      timeSpentMs: number;
    }>;
    totalTimeMs: number;
    finalAnswer?: unknown;
    earlyStop: boolean;
    earlyStopReason?: string;
  };  // ReAct thinking trace for visualization
}

/**
 * Generate a hint for the current interview question
 */
export async function generateHint(request: HintRequest): Promise<HintResponse> {
  const { question, userResponse, conversationHistory, knowledgeBaseId, language } = request;
  const isZh = language === 'zh';
  
  // Get knowledge base context if available
  let knowledgeContext = '';
  let relatedQuestion: string | undefined;
  
  if (knowledgeBaseId) {
    try {
      const kb = await getKnowledgeBaseById(knowledgeBaseId);
      if (kb) {
        // Find similar questions in knowledge base
        const similarQuestions = kb.questions
          .filter(q => {
            const questionLower = question.toLowerCase();
            const qLower = q.question.toLowerCase();
            // Simple similarity check - could be improved with embeddings
            return qLower.includes(questionLower.slice(0, 20)) ||
                   questionLower.includes(qLower.slice(0, 20)) ||
                   (q.category && questionLower.includes(q.category.toLowerCase()));
          })
          .slice(0, 3);
        
        if (similarQuestions.length > 0) {
          knowledgeContext = isZh
            ? `\n\n相关面试问题参考：\n${similarQuestions.map(q => `- ${q.question}${q.sampleAnswer ? `\n  参考答案：${q.sampleAnswer}` : ''}`).join('\n')}`
            : `\n\nRelated interview questions for reference:\n${similarQuestions.map(q => `- ${q.question}${q.sampleAnswer ? `\n  Sample answer: ${q.sampleAnswer}` : ''}`).join('\n')}`;
          
          relatedQuestion = similarQuestions[0]?.question;
        }
        
        // Add company tips if available
        if (kb.tips && kb.tips.length > 0) {
          const relevantTips = kb.tips.slice(0, 2);
          knowledgeContext += isZh
            ? `\n\n面试技巧：\n${relevantTips.map(t => `- ${t.tip}`).join('\n')}`
            : `\n\nInterview tips:\n${relevantTips.map(t => `- ${t.tip}`).join('\n')}`;
        }
      }
    } catch (error) {
      console.error('[HintGenerator] Error getting knowledge base:', error);
    }
  }
  
  // Build conversation context
  const recentHistory = conversationHistory.slice(-6);  // Last 3 exchanges
  const historyText = recentHistory
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? (isZh ? '用户' : 'User') : (isZh ? '面试官' : 'Interviewer')}: ${m.content}`)
    .join('\n');
  
  const systemPrompt = isZh
    ? `你是一位友好的面试教练。用户正在进行模拟面试，需要一些提示来帮助回答当前问题。

当前问题：${question}

${userResponse ? `用户的尝试回答：${userResponse}` : '用户还没有开始回答。'}

最近对话：
${historyText}
${knowledgeContext}

请生成一个有帮助的提示。要求：
1. 不要直接给出答案，而是引导用户思考
2. 提示应该具体且可操作
3. 解释为什么给出这个提示
4. 保持鼓励和支持的语气

返回 JSON 格式：
{
  "hint": "提示内容",
  "reasoning": "为什么给出这个提示",
  "hintType": "clarification|structure|example|keyword|approach"
}

hintType 说明：
- clarification: 帮助理解问题
- structure: 建议回答结构（如 STAR 方法）
- example: 建议举例说明
- keyword: 提供关键词或概念
- approach: 建议思考方向`
    : `You are a friendly interview coach. The user is in a mock interview and needs some hints to help answer the current question.

Current question: ${question}

${userResponse ? `User's attempted response: ${userResponse}` : 'User has not started answering yet.'}

Recent conversation:
${historyText}
${knowledgeContext}

Generate a helpful hint. Requirements:
1. Don't give the answer directly, guide the user to think
2. The hint should be specific and actionable
3. Explain why you're giving this hint
4. Maintain an encouraging and supportive tone

Return JSON format:
{
  "hint": "The hint content",
  "reasoning": "Why this hint is being provided",
  "hintType": "clarification|structure|example|keyword|approach"
}

hintType explanation:
- clarification: Help understand the question
- structure: Suggest answer structure (e.g., STAR method)
- example: Suggest giving examples
- keyword: Provide keywords or concepts
- approach: Suggest thinking direction`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isZh ? '请给我一个提示' : 'Please give me a hint' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'hint_response',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              hint: { type: 'string', description: 'The hint content' },
              reasoning: { type: 'string', description: 'Why this hint is being provided' },
              hintType: { 
                type: 'string', 
                enum: ['clarification', 'structure', 'example', 'keyword', 'approach'],
                description: 'Type of hint'
              },
            },
            required: ['hint', 'reasoning', 'hintType'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid LLM response');
    }

    const parsed = JSON.parse(content);
    
    return {
      hint: parsed.hint,
      reasoning: parsed.reasoning,
      hintType: parsed.hintType,
      relatedQuestion,
    };
  } catch (error) {
    console.error('[HintGenerator] Error generating hint:', error);
    
    // Fallback hint
    return {
      hint: isZh 
        ? '试着用 STAR 方法来组织你的回答：情境(Situation)、任务(Task)、行动(Action)、结果(Result)。'
        : 'Try using the STAR method to structure your answer: Situation, Task, Action, Result.',
      reasoning: isZh
        ? '结构化的回答更容易让面试官理解你的经历和能力。'
        : 'A structured answer makes it easier for the interviewer to understand your experience and abilities.',
      hintType: 'structure',
    };
  }
}

/**
 * Detect if user might need a hint based on their behavior
 */
export function shouldOfferHint(
  lastUserMessage: string,
  timeSinceLastMessage: number,  // in seconds
  hintCount: number  // hints already given in this session
): boolean {
  // Don't offer too many hints
  if (hintCount >= 3) return false;
  
  // User's message is very short (might be struggling)
  if (lastUserMessage.length < 20) return true;
  
  // User explicitly asks for help
  const helpKeywords = ['help', 'hint', 'stuck', 'don\'t know', '不知道', '帮助', '提示', '卡住'];
  if (helpKeywords.some(kw => lastUserMessage.toLowerCase().includes(kw))) return true;
  
  // Long time since last message (might be thinking hard)
  if (timeSinceLastMessage > 60) return true;
  
  return false;
}
