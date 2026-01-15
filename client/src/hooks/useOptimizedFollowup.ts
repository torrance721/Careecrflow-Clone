/**
 * 优化的追问 Hook
 * 
 * 支持混合意图判断：
 * - 正常追问（continue）
 * - 换话题（switch_topic）
 * - 结束面试（end_interview）
 * - 需要提示（need_hint）
 * - 换简单题（want_easier）
 * - 换难题（want_harder）
 * - 换具体题（want_specific）
 */

import { useState, useCallback, useRef } from 'react';

interface CollectedInfoPoint {
  type: string;
  summary: string;
  depth: number;
  needsFollowUp: boolean;
}

interface TopicContext {
  id: string;
  name: string;
  status: string;
  startedAt: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  collectedInfo: CollectedInfoPoint[];
  targetSkills: string[];
}

interface StatusResult {
  status: 'collecting' | 'collected' | 'abandoned';
  newInfoPoints: CollectedInfoPoint[];
  topicComplete: boolean;
  userEngagement: 'high' | 'medium' | 'low';
  evaluationTime: number;
}

// 用户意图类型
export type UserIntent = 
  | 'continue'        // 正常回答，继续追问
  | 'switch_topic'    // 换话题
  | 'end_interview'   // 结束面试
  | 'need_hint'       // 需要提示
  | 'want_easier'     // 想要更简单的题
  | 'want_harder'     // 想要更难的题
  | 'want_specific';  // 想要具体的面试题

interface UseOptimizedFollowupReturn {
  // 状态
  isEvaluating: boolean;
  isStreaming: boolean;
  streamingContent: string;
  statusResult: StatusResult | null;
  error: string | null;
  detectedIntent: UserIntent | null;  // 检测到的意图
  
  // 操作
  startOptimizedFollowup: (params: {
    userMessage: string;
    topicContext: TopicContext;
    targetPosition: string;
    resumeText?: string;
  }) => Promise<{ content: string; intent: UserIntent | null }>;
  reset: () => void;
}

export function useOptimizedFollowup(): UseOptimizedFollowupReturn {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [statusResult, setStatusResult] = useState<StatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detectedIntent, setDetectedIntent] = useState<UserIntent | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setIsEvaluating(false);
    setIsStreaming(false);
    setStreamingContent('');
    setStatusResult(null);
    setError(null);
    setDetectedIntent(null);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const startOptimizedFollowup = useCallback(async (params: {
    userMessage: string;
    topicContext: TopicContext;
    targetPosition: string;
    resumeText?: string;
  }): Promise<{ content: string; intent: UserIntent | null }> => {
    reset();
    setIsEvaluating(true);
    
    abortControllerRef.current = new AbortController();
    
    return new Promise((resolve, reject) => {
      fetch('/api/topic-practice/optimized-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: abortControllerRef.current?.signal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }
          
          const decoder = new TextDecoder();
          let fullContent = '';
          let currentIntent: UserIntent | null = null;
          
          const processStream = async () => {
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                setIsEvaluating(false);
                setIsStreaming(false);
                resolve({ content: fullContent, intent: currentIntent });
                return;
              }
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    if (data.type === 'status') {
                      // 收到状态评估结果
                      setIsEvaluating(false);
                      
                      if (data.specialIntent) {
                        currentIntent = data.specialIntent as UserIntent;
                        setDetectedIntent(currentIntent);
                        
                        // 换题意图（want_easier/want_harder/want_specific）会有流式内容
                        // 其他特殊意图（switch_topic/end_interview/need_hint）直接返回
                        if (['switch_topic', 'end_interview', 'need_hint'].includes(currentIntent)) {
                          resolve({ content: '', intent: currentIntent });
                          return;
                        }
                        
                        // 换题意图，等待流式内容
                        setIsStreaming(true);
                      } else {
                        // 正常追问
                        setStatusResult({
                          status: data.status,
                          newInfoPoints: data.newInfoPoints || [],
                          topicComplete: data.topicComplete,
                          userEngagement: data.userEngagement,
                          evaluationTime: data.evaluationTime
                        });
                        
                        // 开始流式追问
                        setIsStreaming(true);
                      }
                      
                    } else if (data.type === 'content') {
                      // 流式内容
                      fullContent += data.content;
                      setStreamingContent(fullContent);
                      
                    } else if (data.type === 'done') {
                      // 完成
                      setIsStreaming(false);
                      resolve({ 
                        content: fullContent || data.content || '', 
                        intent: currentIntent 
                      });
                      return;
                      
                    } else if (data.type === 'error') {
                      setError(data.error);
                      reject(new Error(data.error));
                      return;
                    }
                  } catch (e) {
                    // 忽略解析错误
                  }
                }
              }
            }
          };
          
          processStream().catch(reject);
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            resolve({ content: '', intent: null });
          } else {
            setError(err.message);
            reject(err);
          }
        })
        .finally(() => {
          setIsEvaluating(false);
          setIsStreaming(false);
        });
    });
  }, [reset]);

  return {
    isEvaluating,
    isStreaming,
    streamingContent,
    statusResult,
    error,
    detectedIntent,
    startOptimizedFollowup,
    reset
  };
}
