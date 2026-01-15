/**
 * 快速状态评估器
 * 
 * 优化追问响应时间：
 * 1. 快速状态评估（~2秒）- 只返回状态和信息点
 * 2. 追问生成单独处理（可流式输出）
 */

import { invokeLLM } from '../../_core/llm';
import type { TopicContext, TopicStatus, CollectedInfoPoint } from './types';

/**
 * 快速状态评估结果
 */
export interface QuickStatusResult {
  status: TopicStatus;
  newInfoPoints: CollectedInfoPoint[];
  topicComplete: boolean;
  userEngagement: 'high' | 'medium' | 'low';
  reasoning: string;
  // 用于生成追问的上下文
  followupContext: {
    keyPoints: string[];
    suggestedDirection: string;
  };
}

/**
 * 快速规则匹配用户意图
 */
function quickIntentMatch(userMessage: string): {
  matched: boolean;
  intent?: 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback';
} {
  const lowerMessage = userMessage.toLowerCase();
  
  const endKeywords = ['结束', '不想聊了', '够了', 'end', 'stop', 'finish', 'done', "that's all"];
  const switchKeywords = ['换个话题', '换一个', '下一个', 'next topic', 'change topic', 'switch'];
  const hintKeywords = ['提示', '不知道', '没思路', 'hint', 'help', 'stuck', "don't know"];
  const feedbackKeywords = ['反馈', '评价', '怎么样', 'feedback', 'how did i do'];
  
  for (const keyword of endKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'end_interview' };
    }
  }
  for (const keyword of switchKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'switch_topic' };
    }
  }
  for (const keyword of hintKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'need_hint' };
    }
  }
  for (const keyword of feedbackKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'view_feedback' };
    }
  }
  
  return { matched: false };
}

/**
 * 快速状态评估（~2秒）
 * 
 * 只评估状态和提取信息点，不生成追问
 */
export async function quickStatusEvaluate(
  userMessage: string,
  topicContext: TopicContext,
  targetPosition: string
): Promise<QuickStatusResult | { specialIntent: 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback' }> {
  // 1. 快速规则匹配
  const quickMatch = quickIntentMatch(userMessage);
  if (quickMatch.matched && quickMatch.intent) {
    return { specialIntent: quickMatch.intent };
  }
  
  // 2. 构建精简的 Prompt（只做状态评估，不生成追问）
  const collectedInfoSummary = topicContext.collectedInfo.length > 0
    ? topicContext.collectedInfo.map(info => `- ${info.type}: ${info.summary}`).join('\n')
    : '暂无';
  
  const recentMessages = topicContext.messages
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 200)}`)
    .join('\n');
  
  const userTurns = topicContext.messages.filter(m => m.role === 'user').length;
  
  const prompt = `Quickly evaluate the user's response in an interview context.

Topic: ${topicContext.name}
Target Position: ${targetPosition}
Turns: ${userTurns}

Collected Info:
${collectedInfoSummary}

Recent Conversation:
${recentMessages}

User's Latest Response:
${userMessage}

Evaluate:
1. Status: collecting (vague info), collected (specific details), or abandoned (can't/won't answer)
2. Extract new info points from the response
3. Identify key points for follow-up

Output JSON:`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'quick_status',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              status: { 
                type: 'string', 
                enum: ['collecting', 'collected', 'abandoned'] 
              },
              topicComplete: { type: 'boolean' },
              userEngagement: {
                type: 'string',
                enum: ['high', 'medium', 'low']
              },
              newInfoPoints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { 
                      type: 'string',
                      enum: ['skill_claim', 'project_experience', 'quantified_result', 'challenge_solution', 'learning', 'other']
                    },
                    summary: { type: 'string' },
                    depth: { type: 'number' },
                    needsFollowUp: { type: 'boolean' }
                  },
                  required: ['type', 'summary', 'depth', 'needsFollowUp'],
                  additionalProperties: false
                }
              },
              reasoning: { type: 'string' },
              keyPoints: {
                type: 'array',
                items: { type: 'string' }
              },
              suggestedDirection: { type: 'string' }
            },
            required: ['status', 'topicComplete', 'userEngagement', 'newInfoPoints', 'reasoning', 'keyPoints', 'suggestedDirection'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const parsed = JSON.parse(content);
      
      return {
        status: parsed.status as TopicStatus,
        newInfoPoints: parsed.newInfoPoints || [],
        topicComplete: parsed.topicComplete,
        userEngagement: parsed.userEngagement,
        reasoning: parsed.reasoning,
        followupContext: {
          keyPoints: parsed.keyPoints || [],
          suggestedDirection: parsed.suggestedDirection || ''
        }
      };
    }
  } catch (error) {
    console.error('[QuickStatusEvaluator] Error:', error);
  }
  
  // 回退：返回默认状态
  return {
    status: 'collecting',
    newInfoPoints: [],
    topicComplete: false,
    userEngagement: 'medium',
    reasoning: 'Fallback due to evaluation error',
    followupContext: {
      keyPoints: [],
      suggestedDirection: 'Ask for more details'
    }
  };
}

/**
 * 生成追问的 Prompt（用于流式输出）
 */
export function buildFollowupPrompt(
  topicContext: TopicContext,
  targetPosition: string,
  statusResult: QuickStatusResult,
  userMessage: string
): string {
  const keyPointsStr = statusResult.followupContext.keyPoints.length > 0
    ? statusResult.followupContext.keyPoints.join(', ')
    : 'general exploration';
  
  return `You are a professional interviewer for ${targetPosition} position.

The candidate just said: "${userMessage}"

Key points to explore: ${keyPointsStr}
Suggested direction: ${statusResult.followupContext.suggestedDirection}

Generate a natural, conversational follow-up question that:
1. Builds on what the candidate just mentioned
2. Guides them to provide specific details (project names, numbers, challenges)
3. Sounds friendly and encouraging, like a real interviewer

Keep it concise (1-2 sentences). Don't use bullet points or formal structure.`;
}
