/**
 * 超快速追问生成器
 * 
 * 目标：追问响应时间 ≤5秒
 * 
 * 策略：
 * 1. 规则快速匹配明确意图（~0秒）
 * 2. LLM 意图判断器处理隐含意图（~1秒）
 * 3. 流式生成追问（~3-4秒）
 */

import { invokeLLMStream, type StreamChunk } from '../../_core/llmStream';
import { invokeLLM, type Message } from '../../_core/llm';

// 意图类型定义
export type UserIntent = 
  | 'continue'        // 正常回答，继续追问
  | 'switch_topic'    // 换话题
  | 'end_interview'   // 结束面试
  | 'need_hint'       // 需要提示
  | 'want_easier'     // 想要更简单的题
  | 'want_harder'     // 想要更难的题
  | 'want_specific';  // 想要具体的面试题

interface UltraFastFollowupParams {
  userMessage: string;
  topicName: string;
  targetPosition: string;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * 生成超快速追问 Prompt
 * 极简设计，减少 token 数量
 */
function buildUltraFastPrompt(params: UltraFastFollowupParams): string {
  const { userMessage, topicName, targetPosition, recentMessages } = params;
  
  // 只取最近 2 轮对话作为上下文
  const context = recentMessages
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'U' : 'A'}: ${m.content.slice(0, 100)}`)
    .join('\n');
  
  return `Interview for ${targetPosition}, topic: ${topicName}

Context:
${context}

User just said: "${userMessage.slice(0, 300)}"

Ask a brief follow-up question (1-2 sentences) to get specific details like numbers, project names, or challenges. Be conversational.`;
}

/**
 * 超快速追问生成（流式）
 * 
 * @param params 参数
 * @param onChunk 流式回调
 * @returns 完整追问内容
 */
export async function generateUltraFastFollowup(
  params: UltraFastFollowupParams,
  onChunk: (chunk: StreamChunk) => void
): Promise<string> {
  const prompt = buildUltraFastPrompt(params);
  
  const messages: Message[] = [
    { role: 'user', content: prompt }
  ];
  
  try {
    // Use non-streaming API since Manus LLM Proxy doesn't support streaming
    const response = await invokeLLM({ messages });
    const fullContent = response.choices[0]?.message?.content || '';
    
    // Simulate streaming by sending content in chunks
    const chunkSize = 10; // characters per chunk
    for (let i = 0; i < fullContent.length; i += chunkSize) {
      const chunk = fullContent.slice(i, i + chunkSize);
      onChunk({ type: 'content', content: chunk });
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    
    onChunk({ type: 'done' });
    return fullContent;
  } catch (error) {
    onChunk({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * 快速规则匹配用户意图（~0秒）
 * 处理明确的关键词匹配
 */
export function quickIntentMatch(userMessage: string): {
  matched: boolean;
  intent?: UserIntent;
  confidence?: number;
} {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  // 结束面试关键词
  if (/^(end|stop|finish|done|quit|exit|结束|不想|够了|that'?s all)/i.test(lowerMessage) ||
      lowerMessage.includes('end interview') ||
      lowerMessage.includes('结束面试')) {
    return { matched: true, intent: 'end_interview', confidence: 0.95 };
  }
  
  // 切换话题关键词
  if (/^(next|switch|change|换话题|下一个话题)/i.test(lowerMessage) ||
      lowerMessage.includes('switch topic') ||
      lowerMessage.includes('next topic') ||
      lowerMessage.includes('换个话题') ||
      lowerMessage.includes('聊点别的')) {
    return { matched: true, intent: 'switch_topic', confidence: 0.95 };
  }
  
  // 需要提示关键词
  if (/^(hint|help|stuck|提示|帮助|不知道)/i.test(lowerMessage) ||
      lowerMessage.includes('give me a hint') ||
      lowerMessage.includes('给我提示') ||
      lowerMessage.includes('不知道怎么')) {
    return { matched: true, intent: 'need_hint', confidence: 0.9 };
  }
  
  // 想要更简单的题
  if (/^(easier|simpler|换简单|太难|简单点)/i.test(lowerMessage) ||
      lowerMessage.includes('too hard') ||
      lowerMessage.includes('too difficult') ||
      lowerMessage.includes('换简单的') ||
      lowerMessage.includes('换个简单') ||
      lowerMessage.includes('这个太难')) {
    return { matched: true, intent: 'want_easier', confidence: 0.9 };
  }
  
  // 想要更难的题
  if (/^(harder|more challenging|换难|太简单|难点)/i.test(lowerMessage) ||
      lowerMessage.includes('too easy') ||
      lowerMessage.includes('too simple') ||
      lowerMessage.includes('换难的') ||
      lowerMessage.includes('换个难') ||
      lowerMessage.includes('这个太简单')) {
    return { matched: true, intent: 'want_harder', confidence: 0.9 };
  }
  
  // 想要具体的面试题
  if (/^(具体|specific|real question|实际)/i.test(lowerMessage) ||
      lowerMessage.includes('具体题目') ||
      lowerMessage.includes('具体一点') ||
      lowerMessage.includes('给我一道题') ||
      lowerMessage.includes('实际的题') ||
      lowerMessage.includes('真正的面试题') ||
      lowerMessage.includes('specific question') ||
      lowerMessage.includes('real interview question') ||
      lowerMessage.includes('actual question')) {
    return { matched: true, intent: 'want_specific', confidence: 0.9 };
  }
  
  return { matched: false };
}

/**
 * 超快速 LLM 意图判断器（~1秒）
 * 处理规则未匹配的隐含意图
 */
export async function detectIntentWithLLM(userMessage: string): Promise<{
  isNormalResponse: boolean;
  intent: UserIntent;
  confidence: number;
}> {
  const prompt = `You are analyzing a user's message in a mock interview practice session. Determine their intent.

User said: "${userMessage.slice(0, 200)}"

Intent categories:
1. **continue** - User is answering the interview question OR asking clarifying questions about the question OR making casual remarks (like "what's your name", "how are you", etc.). This is the DEFAULT for most messages.

2. **switch_topic** - User EXPLICITLY wants to change the interview topic (e.g., "let's switch topics", "next topic", "talk about something else"). Must be very clear and direct.

3. **end_interview** - User wants to stop the interview completely (e.g., "end interview", "I'm done", "stop").

4. **need_hint** - User is stuck and explicitly asks for help (e.g., "give me a hint", "I don't know", "help me").

5. **want_easier** - User explicitly requests an easier question (e.g., "this is too hard", "give me an easier one").

6. **want_harder** - User explicitly requests a harder question (e.g., "this is too easy", "give me a harder one").

7. **want_specific** - User explicitly requests a concrete interview question instead of general discussion (e.g., "give me a real interview question", "ask me something specific").

IMPORTANT:
- Default to "continue" unless the intent is VERY CLEAR
- Casual questions, off-topic remarks, or unclear messages should be "continue"
- Only use special intents when the user EXPLICITLY requests them
- Confidence should be high (>0.8) only when intent is obvious

Return JSON only:
{"intent": "continue|switch_topic|end_interview|need_hint|want_easier|want_harder|want_specific", "confidence": 0.0-1.0}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'intent_detection',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              intent: { 
                type: 'string', 
                enum: ['continue', 'switch_topic', 'end_interview', 'need_hint', 'want_easier', 'want_harder', 'want_specific'] 
              },
              confidence: { type: 'number' }
            },
            required: ['intent', 'confidence'],
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
        isNormalResponse: parsed.intent === 'continue',
        intent: parsed.intent as UserIntent,
        confidence: parsed.confidence
      };
    }
  } catch (error) {
    console.error('[IntentDetector] Error:', error);
  }

  // 默认返回正常回答
  return {
    isNormalResponse: true,
    intent: 'continue',
    confidence: 0.5
  };
}

/**
 * 混合意图检测（规则 + LLM）
 * 
 * 流程：
 * 1. 先用规则快速匹配（~0秒）
 * 2. 未匹配则用 LLM 判断（~1秒）
 */
export async function detectIntent(userMessage: string): Promise<{
  intent: UserIntent;
  confidence: number;
  source: 'rule' | 'llm';
}> {
  // 1. 规则快速匹配
  const ruleMatch = quickIntentMatch(userMessage);
  if (ruleMatch.matched && ruleMatch.intent) {
    return {
      intent: ruleMatch.intent,
      confidence: ruleMatch.confidence || 0.9,
      source: 'rule'
    };
  }
  
  // 2. LLM 意图判断
  const llmResult = await detectIntentWithLLM(userMessage);
  return {
    intent: llmResult.intent,
    confidence: llmResult.confidence,
    source: 'llm'
  };
}
