/**
 * 话题练习 SSE 流式 Hook
 * 
 * 连接后端 SSE 端点，实时获取 AI 思考步骤
 */

import { useState, useCallback, useRef } from 'react';
import type { StreamingStep, AgentInfo } from '../components/ReActViewer';

interface TopicPracticeStreamState {
  isStreaming: boolean;
  steps: StreamingStep[];
  agent: AgentInfo | null;
  error: string | null;
}

interface UseTopicPracticeStreamReturn extends TopicPracticeStreamState {
  startStream: (phase: 'start' | 'message' | 'end', params: Record<string, unknown>) => void;
  stopStream: () => void;
  clearSteps: () => void;
}

export function useTopicPracticeStream(): UseTopicPracticeStreamReturn {
  const [state, setState] = useState<TopicPracticeStreamState>({
    isStreaming: false,
    steps: [],
    agent: null,
    error: null,
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);
  
  const clearSteps = useCallback(() => {
    setState(prev => ({ ...prev, steps: [], error: null }));
  }, []);
  
  const startStream = useCallback((
    phase: 'start' | 'message' | 'end',
    params: Record<string, unknown>
  ) => {
    // 停止之前的流
    stopStream();
    
    // 清空之前的步骤
    setState(prev => ({
      ...prev,
      isStreaming: true,
      steps: [],
      error: null,
    }));
    
    // 创建 AbortController
    abortControllerRef.current = new AbortController();
    
    // 使用 fetch + ReadableStream 处理 SSE
    const endpoint = `/api/topic-practice/stream/${phase}`;
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: abortControllerRef.current.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }
        
        const decoder = new TextDecoder();
        let buffer = '';
        
        const processChunk = async (): Promise<void> => {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              setState(prev => ({ ...prev, isStreaming: false }));
              return;
            }
            
            buffer += decoder.decode(value, { stream: true });
            
            // 解析 SSE 事件
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            let currentEventType = '';
            let currentData = '';
            
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEventType = line.slice(7);
              } else if (line.startsWith('data: ')) {
                currentData = line.slice(6);
                
                if (currentEventType && currentData) {
                  try {
                    const data = JSON.parse(currentData);
                    handleSSEEvent(currentEventType, data);
                  } catch (e) {
                    console.error('Failed to parse SSE data:', e);
                  }
                  currentEventType = '';
                  currentData = '';
                }
              }
            }
            
            // 继续读取
            await processChunk();
          } catch (error) {
            if ((error as Error).name !== 'AbortError') {
              console.error('Stream error:', error);
              setState(prev => ({
                ...prev,
                isStreaming: false,
                error: (error as Error).message,
              }));
            }
          }
        };
        
        processChunk();
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Fetch error:', error);
          setState(prev => ({
            ...prev,
            isStreaming: false,
            error: error.message,
          }));
        }
      });
  }, [stopStream]);
  
  const handleSSEEvent = useCallback((eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case 'agent_start':
        setState(prev => ({
          ...prev,
          agent: {
            name: data.agentName as string,
            displayName: data.agentDisplayName as string,
            description: '',
          },
        }));
        break;
        
      case 'step':
        const step: StreamingStep = {
          id: data.id as string,
          step: data.step as number,
          thought: data.stepType === 'thought' ? data.content as string : undefined,
          action: data.stepType === 'action' ? {
            tool: data.tool as string,
            toolDisplayName: data.toolDisplayName as string,
            params: data.params as Record<string, unknown>,
          } : undefined,
          observation: data.stepType === 'observation' ? data.content as string : undefined,
          status: 'completed',
          startTime: data.startTime as number,
          endTime: Date.now(),
        };
        
        setState(prev => ({
          ...prev,
          steps: [...prev.steps, step],
        }));
        break;
        
      case 'agent_complete':
        setState(prev => ({ ...prev, isStreaming: false }));
        break;
        
      case 'error':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: data.error as string,
        }));
        break;
    }
  }, []);
  
  return {
    ...state,
    startStream,
    stopStream,
    clearSteps,
  };
}

export default useTopicPracticeStream;
