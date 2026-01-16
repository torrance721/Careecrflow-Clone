/**
 * 话题练习流式响应端点
 * 
 * 用于实时流式输出 AI 响应，提升用户体验
 */

import { Router, Request, Response } from 'express';
import { invokeLLMStream } from '../_core/llmStream';
import type { Message } from '../_core/llm';
import { quickStatusEvaluate, buildFollowupPrompt, type QuickStatusResult } from '../agents/interviewModes/quickStatusEvaluator';
import {
  generateUltraFastFollowup,
  quickIntentMatch,
  detectIntentWithLLM,
  type UserIntent
} from '../agents/interviewModes/ultraFastFollowup';
import { switchQuestion, generateTransitionMessage } from '../agents/interviewModes/questionSwitcher';
import type { TopicContext, CollectedInfoPoint } from '../agents/interviewModes/types';

const router = Router();

/**
 * SSE 流式响应端点
 * POST /api/topic-practice/stream-response
 * 
 * 接收消息历史，流式返回 AI 响应
 */
router.post('/stream-response', async (req: Request, res: Response) => {
  const { messages, systemPrompt } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 构建 LLM 消息
  const llmMessages: Message[] = [];
  
  if (systemPrompt) {
    llmMessages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  for (const msg of messages) {
    llmMessages.push({
      role: msg.role,
      content: msg.content
    });
  }

  try {
    let fullContent = '';

    await invokeLLMStream(
      { messages: llmMessages },
      (chunk) => {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'done') {
          res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
        }
      }
    );

    res.end();
  } catch (error) {
    console.error('[TopicPracticeStreamResponse] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    res.end();
  }
});

/**
 * 流式追问生成端点
 * POST /api/topic-practice/stream-followup
 * 
 * 专门用于生成追问，支持流式输出
 */
router.post('/stream-followup', async (req: Request, res: Response) => {
  const { 
    userMessage, 
    topicName, 
    targetPosition, 
    conversationHistory,
    collectedInfo 
  } = req.body as {
    userMessage: string;
    topicName: string;
    targetPosition: string;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    collectedInfo: Array<{ type: string; summary: string; depth: number }>;
  };

  if (!userMessage || !topicName || !targetPosition) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 构建合并的 Prompt
  const collectedInfoSummary = collectedInfo && collectedInfo.length > 0
    ? collectedInfo.map(info => `- ${info.type}: ${info.summary} (深度: ${info.depth}/5)`).join('\n')
    : '暂无';

  const historyText = conversationHistory && conversationHistory.length > 0
    ? conversationHistory.slice(-6).map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.slice(0, 300)}`).join('\n')
    : '';

  const systemPrompt = `你是一个专业的面试官，正在进行话题练习。

## 当前话题
- 话题名称: ${topicName}
- 目标职位: ${targetPosition}

## 已收集的信息
${collectedInfoSummary}

## 最近对话
${historyText}

## 任务
根据用户的最新回答，生成一个自然、有深度的追问。追问应该：
- 基于用户刚才提到的内容深入
- 引导用户提供具体细节（项目名称、技术栈、数字指标、具体挑战/方案）
- 语气友好自然，像真实面试官
- 不要重复已经问过的问题
- 直接输出追问内容，不要有任何前缀或解释`;

  const llmMessages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  try {
    let fullContent = '';

    await invokeLLMStream(
      { messages: llmMessages },
      (chunk) => {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'done') {
          res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
        }
      }
    );

    res.end();
  } catch (error) {
    console.error('[TopicPracticeStreamFollowup] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    res.end();
  }
});

/**
 * 超快速追问端点（目标 ≤5秒）
 * POST /api/topic-practice/optimized-followup
 * 
 * 策略（混合意图判断）：
 * 1. 快速规则匹配明确意图（~0秒）
 * 2. LLM 意图判断隐含意图（~1秒）
 * 3. 根据意图执行对应逻辑：
 *    - continue: 流式生成追问（~3-4秒）
 *    - switch_topic/end_interview/need_hint: 返回意图让前端处理
 *    - want_easier/want_harder/want_specific: 生成新问题
 */
router.post('/optimized-followup', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const { 
    userMessage, 
    topicContext,
    targetPosition,
    resumeText
  } = req.body as {
    userMessage: string;
    topicContext: TopicContext;
    targetPosition: string;
    resumeText?: string;
  };

  if (!userMessage || !topicContext || !targetPosition) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // ========== 第一步：快速规则匹配（~0秒）==========
    const ruleMatch = quickIntentMatch(userMessage);
    
    if (ruleMatch.matched && ruleMatch.intent) {
      const intent = ruleMatch.intent;
      console.log(`[OptimizedFollowup] Rule matched intent: ${intent} (${Date.now() - startTime}ms)`);
      
      // 处理换题意图
      if (intent === 'want_easier' || intent === 'want_harder' || intent === 'want_specific') {
        const switchType = intent === 'want_easier' ? 'easier' : 
                          intent === 'want_harder' ? 'harder' : 'specific';
        
        const result = await switchQuestion({
          currentTopic: topicContext,
          targetPosition,
          switchType,
          resumeText
        });
        
        const transition = generateTransitionMessage(switchType, true);
        const fullResponse = `${transition}\n\n${result.newQuestion}`;
        
        res.write(`data: ${JSON.stringify({ 
          type: 'status', 
          specialIntent: intent,
          evaluationTime: Date.now() - startTime
        })}\n\n`);
        
        // 流式输出新问题
        for (const char of fullResponse) {
          res.write(`data: ${JSON.stringify({ type: 'content', content: char })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 10)); // 模拟流式效果
        }
        
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          content: fullResponse,
          newQuestion: result.newQuestion,
          difficulty: result.difficulty,
          totalTime: Date.now() - startTime
        })}\n\n`);
        res.end();
        return;
      }
      
      // 其他特殊意图（switch_topic, end_interview, need_hint）让前端处理
      res.write(`data: ${JSON.stringify({ 
        type: 'status', 
        specialIntent: intent,
        evaluationTime: Date.now() - startTime
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;
    }
    
    // ========== 第二步：LLM 意图判断（~1秒）==========
    const llmIntent = await detectIntentWithLLM(userMessage);
    console.log(`[OptimizedFollowup] LLM intent: ${llmIntent.intent} (confidence: ${llmIntent.confidence}, ${Date.now() - startTime}ms)`);
    
    // 如果 LLM 判断不是正常回答，处理特殊意图
    if (!llmIntent.isNormalResponse && llmIntent.confidence > 0.7) {
      const intent = llmIntent.intent;
      
      // 处理换题意图
      if (intent === 'want_easier' || intent === 'want_harder' || intent === 'want_specific') {
        const switchType = intent === 'want_easier' ? 'easier' : 
                          intent === 'want_harder' ? 'harder' : 'specific';
        
        const result = await switchQuestion({
          currentTopic: topicContext,
          targetPosition,
          switchType,
          resumeText
        });
        
        const transition = generateTransitionMessage(switchType, true);
        const fullResponse = `${transition}\n\n${result.newQuestion}`;
        
        res.write(`data: ${JSON.stringify({ 
          type: 'status', 
          specialIntent: intent,
          evaluationTime: Date.now() - startTime
        })}\n\n`);
        
        // 流式输出新问题
        for (const char of fullResponse) {
          res.write(`data: ${JSON.stringify({ type: 'content', content: char })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          content: fullResponse,
          newQuestion: result.newQuestion,
          difficulty: result.difficulty,
          totalTime: Date.now() - startTime
        })}\n\n`);
        res.end();
        return;
      }
      
      // 其他特殊意图让前端处理
      res.write(`data: ${JSON.stringify({ 
        type: 'status', 
        specialIntent: intent,
        evaluationTime: Date.now() - startTime
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
      return;
    }
    
    // ========== 第三步：正常追问（~3-4秒）==========
    res.write(`data: ${JSON.stringify({ 
      type: 'status', 
      status: 'collecting',
      newInfoPoints: [],
      topicComplete: false,
      userEngagement: 'medium',
      evaluationTime: Date.now() - startTime
    })}\n\n`);
    
    const recentMessages = topicContext.messages
      .slice(-4)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    
    let fullContent = '';
    
    await generateUltraFastFollowup(
      {
        userMessage,
        topicName: topicContext.name,
        targetPosition,
        recentMessages
      },
      (chunk) => {
        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'done') {
          const totalTime = Date.now() - startTime;
          console.log(`[OptimizedFollowup] Total time: ${totalTime}ms`);
          res.write(`data: ${JSON.stringify({ type: 'done', content: fullContent, totalTime })}\n\n`);
        } else if (chunk.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
        }
      }
    );
    
    res.end();
  } catch (error) {
    console.error('[OptimizedFollowup] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    res.end();
  }
});

export default router;
