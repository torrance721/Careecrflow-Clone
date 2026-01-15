/**
 * ReAct Agent 流式输出端点
 * 
 * 提供 SSE (Server-Sent Events) 端点用于实时推送思考步骤
 */

import { Request, Response } from 'express';
import { StreamEvent, StreamCallback } from './streamingTypes';
import { CareerPathMatchingAgent, CareerPathInput } from '../careerPathMatchingAgent';
import { AdaptiveFeedbackAgent, AdaptiveFeedbackInput } from '../adaptiveFeedbackAgent';

// ==================== SSE 辅助函数 ====================

/**
 * 设置 SSE 响应头
 */
export function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // 禁用 nginx 缓冲
}

/**
 * 发送 SSE 事件
 */
export function sendSSEEvent(res: Response, event: StreamEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * 创建流式回调
 */
export function createStreamCallback(res: Response): StreamCallback {
  return (event: StreamEvent) => {
    sendSSEEvent(res, event);
  };
}

// ==================== Agent 执行器 ====================

export interface AgentExecutorOptions {
  agentType: 'career_path_matching' | 'adaptive_feedback';
  input: CareerPathInput | AdaptiveFeedbackInput;
}

/**
 * 执行 Agent 并流式输出结果
 */
export async function executeAgentWithStreaming(
  res: Response,
  options: AgentExecutorOptions
): Promise<void> {
  const { agentType, input } = options;
  
  // 设置 SSE 头
  setupSSEHeaders(res);
  
  // 创建流式回调
  const streamCallback = createStreamCallback(res);
  
  try {
    let result;
    
    switch (agentType) {
      case 'career_path_matching': {
        const agent = new CareerPathMatchingAgent();
        agent.setStreamCallback(streamCallback);
        result = await agent.execute(input as CareerPathInput);
        break;
      }
      case 'adaptive_feedback': {
        const agent = new AdaptiveFeedbackAgent();
        agent.setStreamCallback(streamCallback);
        result = await agent.execute(input as AdaptiveFeedbackInput);
        break;
      }
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
    
    // 发送最终结果
    res.write(`event: result\n`);
    res.write(`data: ${JSON.stringify(result)}\n\n`);
    
  } catch (error) {
    console.error(`[StreamingEndpoint] Error executing ${agentType}:`, error);
    
    // 发送错误事件
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    })}\n\n`);
  } finally {
    res.end();
  }
}

// ==================== Express 路由处理器 ====================

/**
 * 职业路径匹配 Agent SSE 端点
 */
export async function handleCareerPathMatchingSSE(req: Request, res: Response): Promise<void> {
  const input = req.body as CareerPathInput;
  
  if (!input || !input.userBackground) {
    res.status(400).json({ error: 'Invalid input: userBackground is required' });
    return;
  }
  
  await executeAgentWithStreaming(res, {
    agentType: 'career_path_matching',
    input,
  });
}

/**
 * 自适应反馈 Agent SSE 端点
 */
export async function handleAdaptiveFeedbackSSE(req: Request, res: Response): Promise<void> {
  const input = req.body as AdaptiveFeedbackInput;
  
  if (!input || !input.interviewData) {
    res.status(400).json({ error: 'Invalid input: interviewData is required' });
    return;
  }
  
  await executeAgentWithStreaming(res, {
    agentType: 'adaptive_feedback',
    input,
  });
}

// ==================== 导出路由配置 ====================

export const streamingRoutes = {
  careerPathMatching: '/api/agents/career-path-matching/stream',
  adaptiveFeedback: '/api/agents/adaptive-feedback/stream',
};
