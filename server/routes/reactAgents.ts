/**
 * ReAct Agent 流式输出路由
 * 
 * 提供 SSE 端点用于实时推送 Agent 思考步骤
 */

import { Router, Request, Response } from 'express';
import { CareerPathMatchingAgent, CareerPathInput } from '../agents/careerPathMatchingAgent';
import { AdaptiveFeedbackAgent, AdaptiveFeedbackInput } from '../agents/adaptiveFeedbackAgent';
import { StreamEvent, StreamCallback } from '../agents/react/streamingTypes';

const router = Router();

// ==================== SSE 辅助函数 ====================

function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function sendSSEEvent(res: Response, eventType: string, data: unknown): void {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function createStreamCallback(res: Response): StreamCallback {
  return (event: StreamEvent) => {
    sendSSEEvent(res, event.type, event);
  };
}

// ==================== 职业路径匹配 Agent ====================

router.post('/agents/career-path-matching/stream', async (req: Request, res: Response) => {
  const input = req.body as CareerPathInput;
  
  if (!input || !input.userBackground) {
    res.status(400).json({ error: 'Invalid input: userBackground is required' });
    return;
  }
  
  // 设置 SSE 头
  setupSSEHeaders(res);
  
  // 创建流式回调
  const streamCallback = createStreamCallback(res);
  
  try {
    const agent = new CareerPathMatchingAgent();
    agent.setStreamCallback(streamCallback);
    
    const result = await agent.execute(input);
    
    // 发送最终结果
    sendSSEEvent(res, 'result', result);
    
  } catch (error) {
    console.error('[CareerPathMatchingAgent] Error:', error);
    sendSSEEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    res.end();
  }
});

// ==================== 自适应反馈 Agent ====================

router.post('/agents/adaptive-feedback/stream', async (req: Request, res: Response) => {
  const input = req.body as AdaptiveFeedbackInput;
  
  if (!input || !input.interviewData) {
    res.status(400).json({ error: 'Invalid input: interviewData is required' });
    return;
  }
  
  // 设置 SSE 头
  setupSSEHeaders(res);
  
  // 创建流式回调
  const streamCallback = createStreamCallback(res);
  
  try {
    const agent = new AdaptiveFeedbackAgent();
    agent.setStreamCallback(streamCallback);
    
    const result = await agent.execute(input);
    
    // 发送最终结果
    sendSSEEvent(res, 'result', result);
    
  } catch (error) {
    console.error('[AdaptiveFeedbackAgent] Error:', error);
    sendSSEEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    res.end();
  }
});

// ==================== 非流式端点（用于测试） ====================

router.post('/agents/career-path-matching', async (req: Request, res: Response) => {
  const input = req.body as CareerPathInput;
  
  if (!input || !input.userBackground) {
    res.status(400).json({ error: 'Invalid input: userBackground is required' });
    return;
  }
  
  try {
    const agent = new CareerPathMatchingAgent();
    const result = await agent.execute(input);
    res.json(result);
  } catch (error) {
    console.error('[CareerPathMatchingAgent] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/agents/adaptive-feedback', async (req: Request, res: Response) => {
  const input = req.body as AdaptiveFeedbackInput;
  
  if (!input || !input.interviewData) {
    res.status(400).json({ error: 'Invalid input: interviewData is required' });
    return;
  }
  
  try {
    const agent = new AdaptiveFeedbackAgent();
    const result = await agent.execute(input);
    res.json(result);
  } catch (error) {
    console.error('[AdaptiveFeedbackAgent] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
