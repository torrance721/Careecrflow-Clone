/**
 * 话题状态评估器
 * 
 * 设计原则：
 * 1. LLM 决策 + 软约束：1-5 轮 LLM 自行判断，超过 5 轮提示用户
 * 2. 硬约束：话题完整性判断 + 10 分钟时间限制
 * 3. 快速响应：使用 Prompt 方式，不用 ReAct
 * 
 * 状态说明：
 * - collecting: 继续收集信息
 * - collected: 信息足够，可以给反馈
 * - abandoned: 用户无法/不愿继续
 * - engaged: 聊得投机，超过 5 轮但用户意愿高（新增）
 */

import { invokeLLM } from '../../_core/llm';
import type { TopicContext, TopicStatus, CollectedInfoPoint } from './types';

/**
 * 话题评估结果
 */
export interface TopicEvaluationResult {
  status: TopicStatus;
  newInfoPoints: CollectedInfoPoint[];
  reasoning: string;
  suggestedFollowUp?: string;
  shouldShowEngagedPrompt?: boolean;  // 是否显示"聊得投机"提示
  forceEnd?: boolean;                  // 是否强制结束（时间到或话题完整）
  forceEndReason?: 'time_limit' | 'topic_complete';
}

/**
 * 计算话题已进行的轮数（用户消息数量）
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
 * 评估话题状态
 * 
 * 决策逻辑：
 * 1. 检查时间约束（10 分钟硬约束）
 * 2. 检查轮数（超过 5 轮进入 engaged 状态）
 * 3. LLM 判断信息充分性和话题完整性
 */
export async function evaluateTopicStatus(
  userAnswer: string,
  topicContext: TopicContext
): Promise<TopicEvaluationResult> {
  const userTurns = countUserTurns(topicContext.messages);
  const durationMinutes = calculateDurationMinutes(topicContext.startedAt);
  
  // 硬约束 1: 时间限制（10 分钟）
  if (durationMinutes >= 10) {
    return {
      status: 'collected',
      newInfoPoints: [],
      reasoning: '话题时间已达到 10 分钟限制',
      forceEnd: true,
      forceEndReason: 'time_limit'
    };
  }
  
  const collectedInfoSummary = topicContext.collectedInfo.length > 0
    ? topicContext.collectedInfo.map(info => `- ${info.type}: ${info.summary} (深度: ${info.depth}/5)`).join('\n')
    : '暂无';

  const conversationHistory = topicContext.messages
    .slice(-6)
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.slice(0, 200)}...`)
    .join('\n');

  // 根据轮数调整判断标准
  const turnContext = userTurns >= 5 
    ? `\n注意：对话已进行 ${userTurns} 轮，用户意愿较高。除非信息已经非常完整，否则可以继续深入。`
    : '';

  const prompt = `你是一个面试评估专家。请分析用户的最新回答，判断当前话题的状态。

## 当前话题
- 话题名称: ${topicContext.name}
- 考核能力: ${topicContext.targetSkills.join(', ')}
- 已进行轮数: ${userTurns}
- 已进行时间: ${durationMinutes.toFixed(1)} 分钟
${turnContext}

## 已收集的信息
${collectedInfoSummary}

## 最近对话
${conversationHistory}

## 用户最新回答
${userAnswer}

## 判断标准

1. **collecting** (继续收集): 
   - 用户只提供了模糊的信息，没有具体细节
   - 例如："我做过后端开发" "我有项目经验" → collecting

2. **collected** (收集完成):
   - 用户提供了具体的信息（项目名称、技术栈、数字指标、具体挑战/方案）
   - 只要有一个具体信息点就够了
   - 例如："我用 Kafka 做了消息队列，处理高并发" → collected

3. **abandoned** (放弃):
   - 用户明确表示不会/不能回答
   - 用户多次回避问题

4. **topic_complete** (话题完整):
   - 这个话题已经聊得很完整了，继续追问意义不大
   - 用户已经充分展示了相关能力
   - 设置为 true 时会强制结束话题

## 输出要求
请以 JSON 格式返回：
{
  "status": "collecting" | "collected" | "abandoned",
  "topic_complete": true/false,
  "user_engagement": "high" | "medium" | "low",
  "newInfoPoints": [
    {
      "type": "skill_claim" | "project_experience" | "quantified_result" | "challenge_solution" | "learning" | "other",
      "summary": "信息摘要",
      "depth": 1-5,
      "needsFollowUp": true/false,
      "followUpDirection": "追问方向（如果需要）"
    }
  ],
  "reasoning": "判断理由（简短）",
  "suggestedFollowUp": "建议的追问问题（如果 status 是 collecting）"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'topic_status_evaluation',
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
                    needsFollowUp: { type: 'boolean' },
                    followUpDirection: { type: 'string' }
                  },
                  required: ['type', 'summary', 'depth', 'needsFollowUp'],
                  additionalProperties: false
                }
              },
              reasoning: { type: 'string' },
              suggestedFollowUp: { type: 'string' }
            },
            required: ['status', 'topic_complete', 'user_engagement', 'newInfoPoints', 'reasoning'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const parsed = JSON.parse(content);
      
      // 硬约束 2: 话题完整性
      if (parsed.topic_complete) {
        return {
          status: 'collected',
          newInfoPoints: parsed.newInfoPoints || [],
          reasoning: parsed.reasoning,
          forceEnd: true,
          forceEndReason: 'topic_complete'
        };
      }
      
      // 软约束: 超过 5 轮且用户意愿高，进入 engaged 状态
      const shouldShowEngagedPrompt = userTurns >= 5 && 
        parsed.user_engagement === 'high' && 
        parsed.status === 'collecting';
      
      return {
        status: shouldShowEngagedPrompt ? 'engaged' : parsed.status,
        newInfoPoints: parsed.newInfoPoints || [],
        reasoning: parsed.reasoning,
        suggestedFollowUp: parsed.suggestedFollowUp,
        shouldShowEngagedPrompt
      };
    }
  } catch (error) {
    console.error('[TopicStatusEvaluator] Error:', error);
  }

  // 默认返回继续收集
  return {
    status: 'collecting',
    newInfoPoints: [],
    reasoning: '无法评估，默认继续收集',
    suggestedFollowUp: '能详细说说吗？'
  };
}

/**
 * 检测用户意图
 * 
 * 检测用户是否想：换话题、结束面试、需要提示、查看反馈
 */
export async function detectUserIntent(
  userMessage: string
): Promise<{
  intent: 'continue' | 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback';
  confidence: number;
  reasoning: string;
}> {
  // 快速规则匹配（避免不必要的 LLM 调用）
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
  
  // 查看反馈关键词（新增）
  const feedbackKeywords = [
    '看反馈', '查看反馈', '看看结果', '反馈',
    'view feedback', 'see feedback', 'show feedback', 'feedback'
  ];

  for (const keyword of endKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        intent: 'end_interview',
        confidence: 0.9,
        reasoning: `检测到结束关键词: "${keyword}"`
      };
    }
  }

  for (const keyword of switchKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        intent: 'switch_topic',
        confidence: 0.9,
        reasoning: `检测到换话题关键词: "${keyword}"`
      };
    }
  }

  for (const keyword of hintKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        intent: 'need_hint',
        confidence: 0.8,
        reasoning: `检测到需要提示关键词: "${keyword}"`
      };
    }
  }
  
  for (const keyword of feedbackKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        intent: 'view_feedback',
        confidence: 0.8,
        reasoning: `检测到查看反馈关键词: "${keyword}"`
      };
    }
  }

  // 默认继续
  return {
    intent: 'continue',
    confidence: 0.7,
    reasoning: '未检测到特殊意图，继续当前话题'
  };
}

/**
 * 生成"聊得投机"的提示消息
 */
export function generateEngagedPrompt(isZh: boolean = true): string {
  if (isZh) {
    return `我们聊得很投机！你可以随时查看反馈，但我们也可以继续深入了解你，给出更有价值的建议。想结束随时告诉我就好。`;
  }
  return `We're having a great conversation! You can view feedback anytime, but we can also continue to learn more about you for better insights. Just let me know when you want to stop.`;
}

/**
 * 生成时间限制结束的提示消息
 */
export function generateTimeLimitPrompt(isZh: boolean = true): string {
  if (isZh) {
    return `我们已经聊了 10 分钟了，这个话题聊得很充分。让我为你总结一下反馈...`;
  }
  return `We've been chatting for 10 minutes, and we've covered this topic thoroughly. Let me summarize the feedback for you...`;
}

/**
 * 生成话题完整结束的提示消息
 */
export function generateTopicCompletePrompt(isZh: boolean = true): string {
  if (isZh) {
    return `这个话题我们已经聊得很完整了！让我为你总结一下反馈...`;
  }
  return `We've covered this topic thoroughly! Let me summarize the feedback for you...`;
}

/**
 * 检测结束意图（作为工具可调用）
 */
export async function detectEndIntent(
  conversationHistory: Array<{ role: string; content: string }>,
  currentUserMessage: string
): Promise<{
  wantsToEnd: boolean;
  confidence: number;
  suggestedResponse?: string;
}> {
  // 先用快速规则检测
  const quickResult = await detectUserIntent(currentUserMessage);
  
  if (quickResult.intent === 'end_interview') {
    return {
      wantsToEnd: true,
      confidence: quickResult.confidence,
      suggestedResponse: '好的，我们可以在这里结束。让我为你总结一下这次面试的表现...'
    };
  }

  // 检查对话历史中是否有疲劳信号
  const recentMessages = conversationHistory.slice(-4);
  const shortResponses = recentMessages.filter(
    m => m.role === 'user' && m.content.length < 20
  ).length;

  if (shortResponses >= 3) {
    return {
      wantsToEnd: true,
      confidence: 0.6,
      suggestedResponse: '我注意到你的回答变短了，如果你想结束面试，随时可以告诉我。或者我们可以换个话题？'
    };
  }

  return {
    wantsToEnd: false,
    confidence: 0.8
  };
}

/**
 * 生成话题切换建议
 */
export async function suggestNextTopic(
  completedTopics: TopicContext[],
  targetPosition: string,
  userPreferences?: string[],
  topicHistory?: string[] // 新增：已出过的所有话题名称
): Promise<{
  suggestedTopic: string;
  reasoning: string;
  alternatives: string[];
}> {
  const completedTopicNames = completedTopics.map(t => t.name);
  // 合并已完成话题和历史话题，去重
  const allUsedTopics = Array.from(new Set([...completedTopicNames, ...(topicHistory || [])]));
  
  const prompt = `作为面试专家，请为 ${targetPosition} 职位推荐下一个面试话题。

## 已出过的话题（必须避免重复）
${allUsedTopics.length > 0 ? allUsedTopics.join(', ') : '暂无'}

## 用户偏好（如果有）
${userPreferences?.join(', ') || '无特殊偏好'}

## 要求
1. 推荐一个与上述话题完全不同的新话题
2. 话题应该与目标职位相关
3. 提供 2-3 个备选话题（也不能与已出过的重复）

返回 JSON：
{
  "suggestedTopic": "推荐话题名称",
  "reasoning": "推荐理由",
  "alternatives": ["备选话题1", "备选话题2"]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'next_topic_suggestion',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              suggestedTopic: { type: 'string' },
              reasoning: { type: 'string' },
              alternatives: { 
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['suggestedTopic', 'reasoning', 'alternatives'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[suggestNextTopic] Error:', error);
  }

  // 默认建议
  return {
    suggestedTopic: '项目经验',
    reasoning: '项目经验是面试中最常见的话题',
    alternatives: ['技术能力', '团队协作']
  };
}
