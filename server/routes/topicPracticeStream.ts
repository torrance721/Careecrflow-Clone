/**
 * 话题练习 SSE 流式输出路由
 * 
 * 提供 SSE 端点用于实时推送 AI 思考步骤
 * 连接真实的 ReAct Agent 进行面试反馈生成
 */

import { Router } from 'express';
import { StreamEvent, StreamCallback } from '../agents/react/streamingTypes';
import { AdaptiveFeedbackAgent, AdaptiveFeedbackInput } from '../agents/adaptiveFeedbackAgent';
import { CareerPathMatchingAgent, CareerPathInput } from '../agents/careerPathMatchingAgent';

const router = Router();

// ==================== SSE 辅助函数 ====================

function setupSSEHeaders(res: any): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function sendSSEEvent(res: any, eventType: string, data: unknown): void {
  res.write(`event: ${eventType}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// 创建 SSE 回调
function createSSECallback(res: any): StreamCallback {
  return (event: StreamEvent) => {
    sendSSEEvent(res, event.type, event);
  };
}

// ==================== 模拟数据（用于开始和消息阶段） ====================

interface TopicPracticeStep {
  id: string;
  step: number;
  type: 'thought' | 'action' | 'observation';
  content: string;
  tool?: string;
  toolDisplayName?: string;
  params?: Record<string, unknown>;
  startTime: number;
  endTime?: number;
}

// 模拟 AI 思考步骤的生成器（用于开始和消息阶段）
async function* generateTopicPracticeSteps(
  phase: 'start' | 'message',
  context: Record<string, unknown>
): AsyncGenerator<TopicPracticeStep> {
  const steps: Array<{
    type: 'thought' | 'action' | 'observation';
    content: string;
    tool?: string;
    toolDisplayName?: string;
    duration: number;
  }> = phase === 'start' ? [
    {
      type: 'thought',
      content: '分析用户的目标职位，确定面试话题方向...',
      duration: 300,
    },
    {
      type: 'action',
      content: '选择最相关的面试话题',
      tool: 'select_topic',
      toolDisplayName: '选择面试话题',
      duration: 500,
    },
    {
      type: 'observation',
      content: `已选择话题: ${context.topic || '项目经验'}`,
      duration: 200,
    },
    {
      type: 'thought',
      content: '根据话题和职位要求生成开场问题...',
      duration: 300,
    },
    {
      type: 'action',
      content: '生成针对性的面试问题',
      tool: 'generate_question',
      toolDisplayName: '生成面试问题',
      duration: 600,
    },
  ] : [
    {
      type: 'thought',
      content: '理解用户的回答意图...',
      duration: 200,
    },
    {
      type: 'action',
      content: '检测用户意图',
      tool: 'detect_intent',
      toolDisplayName: '检测用户意图',
      duration: 300,
    },
    {
      type: 'observation',
      content: `用户意图: ${context.intent || '继续回答'}`,
      duration: 150,
    },
    {
      type: 'thought',
      content: '评估回答质量，识别关键信息点...',
      duration: 300,
    },
    {
      type: 'action',
      content: '评估回答质量',
      tool: 'evaluate_response',
      toolDisplayName: '评估回答质量',
      duration: 400,
    },
    {
      type: 'thought',
      content: '根据回答内容生成追问...',
      duration: 300,
    },
    {
      type: 'action',
      content: '生成追问',
      tool: 'generate_followup',
      toolDisplayName: '生成追问',
      duration: 500,
    },
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const startTime = Date.now();
    
    yield {
      id: `step-${startTime}-${i}`,
      step: i + 1,
      type: step.type,
      content: step.content,
      tool: step.tool,
      toolDisplayName: step.toolDisplayName,
      startTime,
    };
    
    // 模拟处理时间
    await new Promise(resolve => setTimeout(resolve, step.duration));
  }
}

// ==================== 话题练习流式端点 ====================

router.post('/topic-practice/stream/start', async (req: any, res: any) => {
  const { targetPosition } = req.body;
  
  if (!targetPosition) {
    res.status(400).json({ error: 'targetPosition is required' });
    return;
  }
  
  setupSSEHeaders(res);
  
  try {
    // 发送 Agent 开始事件
    sendSSEEvent(res, 'agent_start', {
      type: 'agent_start',
      timestamp: Date.now(),
      agentName: 'topic_practice',
      agentDisplayName: '话题练习',
    });
    
    // 流式发送思考步骤
    const stepGenerator = generateTopicPracticeSteps('start', { targetPosition });
    
    for await (const step of stepGenerator) {
      sendSSEEvent(res, 'step', {
        timestamp: Date.now(),
        agentName: 'topic_practice',
        stepType: step.type,
        ...step,
      });
    }
    
    // 发送完成事件
    sendSSEEvent(res, 'agent_complete', {
      type: 'agent_complete',
      timestamp: Date.now(),
      agentName: 'topic_practice',
    });
    
  } catch (error) {
    console.error('[TopicPracticeStream] Error:', error);
    sendSSEEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    res.end();
  }
});

router.post('/topic-practice/stream/message', async (req: any, res: any) => {
  const { sessionId, message } = req.body;
  
  if (!sessionId || !message) {
    res.status(400).json({ error: 'sessionId and message are required' });
    return;
  }
  
  setupSSEHeaders(res);
  
  try {
    sendSSEEvent(res, 'agent_start', {
      type: 'agent_start',
      timestamp: Date.now(),
      agentName: 'topic_practice',
      agentDisplayName: '话题练习',
    });
    
    const stepGenerator = generateTopicPracticeSteps('message', { message });
    
    for await (const step of stepGenerator) {
      sendSSEEvent(res, 'step', {
        timestamp: Date.now(),
        agentName: 'topic_practice',
        stepType: step.type,
        ...step,
      });
    }
    
    sendSSEEvent(res, 'agent_complete', {
      type: 'agent_complete',
      timestamp: Date.now(),
      agentName: 'topic_practice',
    });
    
  } catch (error) {
    console.error('[TopicPracticeStream] Error:', error);
    sendSSEEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    res.end();
  }
});

// ==================== 结束会话 - 使用真实 ReAct Agent ====================

router.post('/topic-practice/stream/end', async (req: any, res: any) => {
  const { sessionId, sessionData } = req.body;
  
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  
  setupSSEHeaders(res);
  
  try {
    // 如果有完整的会话数据，使用真实的 AdaptiveFeedbackAgent
    if (sessionData && sessionData.messages && sessionData.messages.length > 0) {
      console.log('[TopicPracticeStream] Using real AdaptiveFeedbackAgent');
      
      const agent = new AdaptiveFeedbackAgent();
      agent.setStreamCallback(createSSECallback(res));
      
      // 构建 Agent 输入
      const input: AdaptiveFeedbackInput = {
        userBackground: {
          targetRole: sessionData.targetPosition,
          skills: sessionData.userSkills || [],
          targetLevel: sessionData.targetLevel || 'mid',
        },
        interviewData: {
          topic: sessionData.topic || '综合面试',
          questions: sessionData.messages
            .filter((m: { role: string }) => m.role === 'assistant')
            .map((m: { content: string }, i: number) => ({
              question: m.content,
              answer: sessionData.messages[i * 2 + 1]?.content || '',
            })),
          duration: Math.round((Date.now() - (sessionData.startTime || Date.now())) / 60000),
          language: sessionData.language || 'zh',
        },
        targetPosition: {
          title: sessionData.targetPosition,
        },
      };
      
      // 执行 Agent
      const result = await agent.execute(input);
      
      // 发送最终结果
      sendSSEEvent(res, 'result', {
        type: 'result',
        timestamp: Date.now(),
        agentName: 'adaptive_feedback',
        success: result.success,
        data: result.output,
      });
      
    } else {
      // 没有会话数据，使用模拟步骤
      console.log('[TopicPracticeStream] Using simulated steps (no session data)');
      
      sendSSEEvent(res, 'agent_start', {
        type: 'agent_start',
        timestamp: Date.now(),
        agentName: 'adaptive_feedback',
        agentDisplayName: '自适应反馈',
      });
      
      // 模拟步骤
      const simulatedSteps = [
        { type: 'thought', content: '汇总所有话题的表现数据...', duration: 400 },
        { type: 'action', content: '分析整体表现', tool: 'analyze_performance', duration: 600 },
        { type: 'thought', content: '根据表现生成个性化反馈...', duration: 300 },
        { type: 'action', content: '生成反馈报告', tool: 'generate_feedback', duration: 800 },
      ];
      
      for (let i = 0; i < simulatedSteps.length; i++) {
        const step = simulatedSteps[i];
        sendSSEEvent(res, 'step', {
          timestamp: Date.now(),
          agentName: 'adaptive_feedback',
          stepType: step.type,
          id: `step-${Date.now()}-${i}`,
          step: i + 1,
          content: step.content,
          tool: step.tool,
        });
        await new Promise(resolve => setTimeout(resolve, step.duration));
      }
      
      sendSSEEvent(res, 'agent_complete', {
        type: 'agent_complete',
        timestamp: Date.now(),
        agentName: 'adaptive_feedback',
      });
    }
    
  } catch (error) {
    console.error('[TopicPracticeStream] Error:', error);
    sendSSEEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    res.end();
  }
});

// ==================== 职业路径匹配 - 使用真实 ReAct Agent ====================

router.post('/topic-practice/stream/career-match', async (req: any, res: any) => {
  const { userBackground, interviewPerformance, language } = req.body;
  
  if (!userBackground) {
    res.status(400).json({ error: 'userBackground is required' });
    return;
  }
  
  setupSSEHeaders(res);
  
  try {
    console.log('[TopicPracticeStream] Starting CareerPathMatchingAgent');
    
    const agent = new CareerPathMatchingAgent();
    agent.setStreamCallback(createSSECallback(res));
    
    // 构建 Agent 输入
    const input: CareerPathInput = {
      userBackground: {
        currentRole: userBackground.currentRole,
        yearsOfExperience: userBackground.yearsOfExperience,
        skills: userBackground.skills || [],
        education: userBackground.education,
        previousRoles: userBackground.previousRoles,
        targetRole: userBackground.targetRole,
        targetIndustry: userBackground.targetIndustry,
        preferredLocation: userBackground.preferredLocation,
        preferredWorkMode: userBackground.preferredWorkMode || 'any',
      },
      interviewPerformance: interviewPerformance || {
        strengths: [],
        weaknesses: [],
      },
      language: language || 'zh',
    };
    
    // 执行 Agent
    const result = await agent.execute(input);
    
    // 发送最终结果
    sendSSEEvent(res, 'result', {
      type: 'result',
      timestamp: Date.now(),
      agentName: 'career_path_matching',
      success: result.success,
      data: result.output,
    });
    
  } catch (error) {
    console.error('[TopicPracticeStream] CareerMatch Error:', error);
    sendSSEEvent(res, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    res.end();
  }
});

export default router;
