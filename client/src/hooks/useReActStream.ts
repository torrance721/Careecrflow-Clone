/**
 * useReActStream - ReAct Agent 流式输出 Hook
 * 
 * 连接 SSE 端点，实时接收思考步骤
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { StreamingStep, AgentInfo } from '@/components/ReActViewer';
import { getApiUrl } from '@/const';

// ==================== 类型定义 ====================

export interface StreamEvent {
  type: string;
  timestamp: number;
  agentName: string;
  agentDisplayName: string;
  [key: string]: unknown;
}

export interface UseReActStreamOptions {
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
}

export interface UseReActStreamReturn<TInput, TOutput> {
  steps: StreamingStep[];
  isRunning: boolean;
  result: TOutput | null;
  error: string | null;
  agent: AgentInfo | null;
  execute: (input: TInput) => Promise<void>;
  reset: () => void;
}

// ==================== Hook 实现 ====================

export function useReActStream<TInput, TOutput>(
  endpoint: string,
  options: UseReActStreamOptions = {}
): UseReActStreamReturn<TInput, TOutput> {
  const [steps, setSteps] = useState<StreamingStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<TOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 清理函数
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  
  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // 重置状态
  const reset = useCallback(() => {
    cleanup();
    setSteps([]);
    setIsRunning(false);
    setResult(null);
    setError(null);
    setAgent(null);
  }, [cleanup]);
  
  // 执行 Agent
  const execute = useCallback(async (input: TInput) => {
    // 重置状态
    reset();
    setIsRunning(true);
    
    try {
      // 使用 fetch + ReadableStream 处理 SSE
      // 因为 EventSource 不支持 POST 请求
      // 使用 getApiUrl() 确保请求发送到 Render 后端，避免 Vercel 60秒超时限制
      abortControllerRef.current = new AbortController();

      const fullUrl = `${getApiUrl()}${endpoint}`;
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(input),
        signal: abortControllerRef.current.signal,
        credentials: 'include', // 跨域请求携带 Cookie
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // 解析 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // 保留不完整的行
        
        let currentEvent = '';
        let currentData = '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
            
            // 解析并处理事件
            if (currentEvent && currentData) {
              try {
                const eventData = JSON.parse(currentData) as StreamEvent;
                handleEvent(currentEvent, eventData);
              } catch (e) {
                console.error('Failed to parse event data:', e);
              }
              currentEvent = '';
              currentData = '';
            }
          }
        }
      }
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户取消，不处理
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      options.onError?.(errorMessage);
    } finally {
      setIsRunning(false);
    }
  }, [endpoint, reset, options]);
  
  // 处理 SSE 事件
  const handleEvent = useCallback((eventType: string, data: StreamEvent) => {
    switch (eventType) {
      case 'agent_start':
        setAgent({
          name: data.agentName,
          displayName: data.agentDisplayName,
          description: (data as { description?: string }).description || '',
        });
        break;
        
      case 'step_start': {
        const stepData = data as unknown as {
          stepId: string;
          stepNumber: number;
          timestamp: number;
        };
        setSteps(prev => [...prev, {
          id: stepData.stepId,
          step: stepData.stepNumber,
          status: 'running',
          startTime: stepData.timestamp,
        }]);
        break;
      }
      
      case 'thought': {
        const thoughtData = data as unknown as {
          stepId: string;
          thought: string;
        };
        setSteps(prev => prev.map(step => 
          step.id === thoughtData.stepId
            ? { ...step, thought: thoughtData.thought }
            : step
        ));
        break;
      }
      
      case 'action_start': {
        const actionData = data as unknown as {
          stepId: string;
          tool: string;
          toolDisplayName: string;
          params: Record<string, unknown>;
        };
        setSteps(prev => prev.map(step => 
          step.id === actionData.stepId
            ? { 
                ...step, 
                action: {
                  tool: actionData.tool,
                  toolDisplayName: actionData.toolDisplayName,
                  params: actionData.params,
                }
              }
            : step
        ));
        break;
      }
      
      case 'action_complete': {
        const completeData = data as unknown as {
          stepId: string;
          result?: unknown;
          error?: string;
          durationMs: number;
        };
        setSteps(prev => prev.map(step => 
          step.id === completeData.stepId
            ? { 
                ...step, 
                observation: completeData.result 
                  ? JSON.stringify(completeData.result, null, 2)
                  : completeData.error,
                error: completeData.error,
              }
            : step
        ));
        break;
      }
      
      case 'step_complete': {
        const stepCompleteData = data as unknown as {
          stepId: string;
          durationMs: number;
          timestamp: number;
        };
        setSteps(prev => prev.map(step => 
          step.id === stepCompleteData.stepId
            ? { 
                ...step, 
                status: 'completed',
                endTime: stepCompleteData.timestamp,
                durationMs: stepCompleteData.durationMs,
              }
            : step
        ));
        break;
      }
      
      case 'agent_complete': {
        const agentCompleteData = data as unknown as {
          success: boolean;
          result?: unknown;
          error?: string;
        };
        if (agentCompleteData.success && agentCompleteData.result) {
          setResult(agentCompleteData.result as TOutput);
          options.onComplete?.(agentCompleteData.result);
        } else if (agentCompleteData.error) {
          setError(agentCompleteData.error);
          options.onError?.(agentCompleteData.error);
        }
        break;
      }
      
      case 'error': {
        const errorData = data as unknown as {
          stepId?: string;
          error: string;
        };
        if (errorData.stepId) {
          setSteps(prev => prev.map(step => 
            step.id === errorData.stepId
              ? { ...step, status: 'error', error: errorData.error }
              : step
          ));
        }
        setError(errorData.error);
        options.onError?.(errorData.error);
        break;
      }
      
      case 'result': {
        // 最终结果事件
        setResult(data as unknown as TOutput);
        options.onComplete?.(data);
        break;
      }
    }
  }, [options]);
  
  return {
    steps,
    isRunning,
    result,
    error,
    agent,
    execute,
    reset,
  };
}

// ==================== 预配置的 Hooks ====================

export function useCareerPathMatching(options: UseReActStreamOptions = {}) {
  return useReActStream<
    {
      userBackground: {
        currentRole?: string;
        yearsOfExperience?: number;
        skills: string[];
        education?: string;
        previousRoles?: string[];
        targetRole?: string;
        targetIndustry?: string;
        preferredLocation?: string;
        preferredWorkMode?: 'remote' | 'hybrid' | 'onsite' | 'any';
      };
      interviewPerformance: {
        strengths: string[];
        weaknesses: string[];
        overallScore?: number;
        topicScores?: Record<string, number>;
      };
      language: 'en' | 'zh';
    },
    {
      careerAnalysis: {
        currentStage: string;
        trajectory: string;
        goals: string[];
        skillGaps: string[];
      };
      recommendations: Array<{
        jobId: string;
        title: string;
        company: string;
        location: string;
        matchScore: number;
        matchReasons: string[];
        growthOpportunities: string[];
        challenges: string[];
        applyUrl?: string;
      }>;
      careerAdvice: string;
    }
  >('/api/agents/career-path-matching/stream', options);
}

export function useAdaptiveFeedback(options: UseReActStreamOptions = {}) {
  return useReActStream<
    {
      userBackground: {
        currentRole?: string;
        yearsOfExperience?: number;
        skills: string[];
        education?: string;
        targetRole?: string;
        targetLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
      };
      interviewData: {
        topic: string;
        questions: Array<{
          question: string;
          answer: string;
          followUps?: string[];
        }>;
        duration: number;
        language: 'en' | 'zh';
      };
      targetPosition?: {
        title: string;
        company?: string;
        level?: string;
        requirements?: string[];
      };
    },
    {
      positionAnalysis: {
        level: string;
        levelDescription: string;
        keyCompetencies: string[];
      };
      dimensions: Array<{
        name: string;
        nameZh: string;
        score: number;
        evidence: string[];
        strengths: string[];
        improvements: string[];
        priority: 'high' | 'medium' | 'low';
      }>;
      overallScore: number;
      summary: string;
      actionItems: Array<{
        action: string;
        priority: 'high' | 'medium' | 'low';
        timeframe: string;
      }>;
      encouragement: string;
    }
  >('/api/agents/adaptive-feedback/stream', options);
}

export default useReActStream;
