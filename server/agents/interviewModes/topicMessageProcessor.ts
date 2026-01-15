/**
 * 话题消息处理器 - 合并版本
 * 
 * 将意图检测、状态评估、追问生成合并为一个 LLM 调用
 * 优化响应时间：从 3 次 LLM 调用（~15秒）减少到 1 次（~5秒）
 */

import { invokeLLM } from '../../_core/llm';
import type { TopicContext, TopicStatus, CollectedInfoPoint } from './types';

/**
 * 合并处理结果
 */
export interface TopicMessageProcessResult {
  // 用户意图
  intent: 'continue' | 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback';
  intentConfidence: number;
  
  // 话题状态
  status: TopicStatus;
  newInfoPoints: CollectedInfoPoint[];
  
  // AI 响应
  aiResponse: string;
  
  // 额外信息
  reasoning: string;
  shouldShowEngagedPrompt?: boolean;
  forceEnd?: boolean;
  forceEndReason?: 'time_limit' | 'topic_complete';
}

/**
 * 计算话题已进行的轮数
 */
function countUserTurns(messages: Array<{ role: string; content: string }>): number {
  return messages.filter(m => m.role === 'user').length;
}

/**
 * 计算话题已进行的时间（分钟）
 */
function calculateDurationMinutes(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  return (now - start) / (1000 * 60);
}

/**
 * 快速规则匹配用户意图（避免不必要的 LLM 调用）
 */
function quickIntentMatch(userMessage: string): {
  matched: boolean;
  intent?: 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback';
  confidence?: number;
} {
  const lowerMessage = userMessage.toLowerCase();
  
  // 结束意图关键词
  const endKeywords = [
    '结束', '不想继续', '停止', '算了', '就这样吧', '可以了',
    'end', 'stop', 'quit', 'done', 'finish', "that's enough", "i'm done"
  ];
  
  // 换话题关键词
  const switchKeywords = [
    '换个话题', '换一个', '下一个问题', '其他问题', '不想回答这个',
    'switch', 'next topic', 'different question', 'skip this', 'move on'
  ];
  
  // 需要提示关键词
  const hintKeywords = [
    '不太会', '不知道怎么回答', '能给个提示', '帮帮我', '不确定', '给我提示',
    "don't know", 'help', 'hint', 'not sure', 'stuck', 'give me a hint'
  ];
  
  // 查看反馈关键词
  const feedbackKeywords = [
    '看反馈', '查看反馈', '看看结果', '反馈',
    'view feedback', 'see feedback', 'show feedback', 'feedback'
  ];

  for (const keyword of endKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'end_interview', confidence: 0.9 };
    }
  }

  for (const keyword of switchKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'switch_topic', confidence: 0.9 };
    }
  }

  for (const keyword of hintKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'need_hint', confidence: 0.8 };
    }
  }
  
  for (const keyword of feedbackKeywords) {
    if (lowerMessage.includes(keyword)) {
      return { matched: true, intent: 'view_feedback', confidence: 0.8 };
    }
  }

  return { matched: false };
}

/**
 * 合并处理话题消息
 * 
 * 一次 LLM 调用完成：
 * 1. 意图检测（如果规则未匹配）
 * 2. 状态评估
 * 3. 信息提取
 * 4. 追问生成
 */
export async function processTopicMessage(
  userMessage: string,
  topicContext: TopicContext,
  targetPosition: string
): Promise<TopicMessageProcessResult> {
  // 1. 快速规则匹配意图
  const quickMatch = quickIntentMatch(userMessage);
  if (quickMatch.matched && quickMatch.intent) {
    // 特殊意图直接返回，不需要 LLM
    return {
      intent: quickMatch.intent,
      intentConfidence: quickMatch.confidence || 0.9,
      status: 'collecting',
      newInfoPoints: [],
      aiResponse: '', // 由调用方处理
      reasoning: `规则匹配到意图: ${quickMatch.intent}`
    };
  }

  // 2. 检查硬约束
  const userTurns = countUserTurns(topicContext.messages);
  const durationMinutes = calculateDurationMinutes(topicContext.startedAt);
  
  // 时间限制（10 分钟）
  if (durationMinutes >= 10) {
    return {
      intent: 'continue',
      intentConfidence: 1.0,
      status: 'collected',
      newInfoPoints: [],
      aiResponse: '我们已经聊了 10 分钟了，这个话题聊得很充分。让我为你总结一下反馈...',
      reasoning: '话题时间已达到 10 分钟限制',
      forceEnd: true,
      forceEndReason: 'time_limit'
    };
  }

  // 3. 构建合并的 Prompt
  const collectedInfoSummary = topicContext.collectedInfo.length > 0
    ? topicContext.collectedInfo.map(info => `- ${info.type}: ${info.summary} (深度: ${info.depth}/5)`).join('\n')
    : '暂无';

  const conversationHistory = topicContext.messages
    .slice(-6)
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.slice(0, 300)}`)
    .join('\n');

  const turnContext = userTurns >= 5 
    ? `\n⚠️ 对话已进行 ${userTurns} 轮，用户意愿较高。除非信息已经非常完整，否则可以继续深入。`
    : '';

  const prompt = `你是一个专业的面试官。请分析用户的最新回答，完成以下任务：

## 当前话题
- 话题名称: ${topicContext.name}
- 考核能力: ${topicContext.targetSkills.join(', ')}
- 目标职位: ${targetPosition}
- 已进行轮数: ${userTurns}
- 已进行时间: ${durationMinutes.toFixed(1)} 分钟
${turnContext}

## 已收集的信息
${collectedInfoSummary}

## 最近对话
${conversationHistory}

## 用户最新回答
${userMessage}

## 任务

### 1. 状态评估
判断当前话题状态：
- **collecting**: 用户只提供了模糊信息，需要继续追问
- **collected**: 用户提供了具体信息（项目名称、技术栈、数字指标、具体挑战/方案）
- **abandoned**: 用户明确表示不会/不能回答

### 2. 信息提取
从用户回答中提取有价值的信息点。

### 3. 生成追问
如果状态是 collecting，生成一个自然、有深度的追问。追问应该：
- 基于用户刚才提到的内容深入
- 引导用户提供具体细节
- 语气友好自然，像真实面试官

## 输出格式（JSON）
{
  "status": "collecting" | "collected" | "abandoned",
  "topic_complete": true/false,
  "user_engagement": "high" | "medium" | "low",
  "newInfoPoints": [
    {
      "type": "skill_claim" | "project_experience" | "quantified_result" | "challenge_solution" | "learning" | "other",
      "summary": "信息摘要",
      "depth": 1-5,
      "needsFollowUp": true/false
    }
  ],
  "reasoning": "判断理由（简短）",
  "aiResponse": "追问或回应（如果 status 是 collecting，这里是追问；如果是 collected，这里是确认收到的回应）"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'topic_message_process',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              status: { 
                type: 'string', 
                enum: ['collecting', 'collected', 'abandoned'] 
              },
              topic_complete: { type: 'boolean' },
              user_engagement: {
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
              aiResponse: { type: 'string' }
            },
            required: ['status', 'topic_complete', 'user_engagement', 'newInfoPoints', 'reasoning', 'aiResponse'],
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
      
      // 话题完整性硬约束
      if (parsed.topic_complete) {
        return {
          intent: 'continue',
          intentConfidence: 1.0,
          status: 'collected',
          newInfoPoints: parsed.newInfoPoints || [],
          aiResponse: parsed.aiResponse || '这个话题我们已经聊得很完整了！让我为你总结一下反馈...',
          reasoning: parsed.reasoning,
          forceEnd: true,
          forceEndReason: 'topic_complete'
        };
      }
      
      // 超过 5 轮且用户意愿高，进入 engaged 状态
      const shouldShowEngagedPrompt = userTurns >= 5 && 
        parsed.user_engagement === 'high' && 
        parsed.status === 'collecting';
      
      return {
        intent: 'continue',
        intentConfidence: 0.9,
        status: shouldShowEngagedPrompt ? 'engaged' : parsed.status,
        newInfoPoints: parsed.newInfoPoints || [],
        aiResponse: parsed.aiResponse,
        reasoning: parsed.reasoning,
        shouldShowEngagedPrompt
      };
    }
  } catch (error) {
    console.error('[TopicMessageProcessor] Error:', error);
  }

  // 默认返回
  return {
    intent: 'continue',
    intentConfidence: 0.5,
    status: 'collecting',
    newInfoPoints: [],
    aiResponse: '能详细说说吗？比如具体是什么项目，用了什么技术？',
    reasoning: '无法评估，默认继续收集'
  };
}
