/**
 * 流式响应 Hook
 * 
 * 用于实时显示 AI 响应，支持逐字显示效果
 */

import { useState, useCallback, useRef } from 'react';

interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

interface UseStreamingResponseOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: string) => void;
}

interface UseStreamingResponseReturn {
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (endpoint: string, body: Record<string, unknown>) => Promise<string>;
  stopStream: () => void;
  reset: () => void;
}

export function useStreamingResponse(
  options: UseStreamingResponseOptions = {}
): UseStreamingResponseReturn {
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStreamingContent('');
    setError(null);
    setIsStreaming(false);
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<string> => {
    // 停止之前的流
    stopStream();
    reset();

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    let fullContent = '';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
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

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const chunk = JSON.parse(data) as StreamChunk;

              if (chunk.type === 'content' && chunk.content) {
                fullContent += chunk.content;
                setStreamingContent(fullContent);
                options.onChunk?.(chunk.content);
              } else if (chunk.type === 'done') {
                options.onComplete?.(fullContent);
              } else if (chunk.type === 'error') {
                setError(chunk.error || 'Unknown error');
                options.onError?.(chunk.error || 'Unknown error');
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      setIsStreaming(false);
      return fullContent;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // Stream was aborted, not an error
        return fullContent;
      }

      const errorMessage = (err as Error).message || 'Stream failed';
      setError(errorMessage);
      options.onError?.(errorMessage);
      setIsStreaming(false);
      throw err;
    }
  }, [options, reset, stopStream]);

  return {
    streamingContent,
    isStreaming,
    error,
    startStream,
    stopStream,
    reset,
  };
}

/**
 * 简化版：用于话题练习的追问流式响应
 */
export function useFollowupStream() {
  const { streamingContent, isStreaming, error, startStream, reset } = useStreamingResponse();

  const streamFollowup = useCallback(async (params: {
    userMessage: string;
    topicName: string;
    targetPosition: string;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    collectedInfo: Array<{ type: string; summary: string; depth: number }>;
  }): Promise<string> => {
    return startStream('/api/topic-practice/stream-followup', params);
  }, [startStream]);

  return {
    streamingContent,
    isStreaming,
    error,
    streamFollowup,
    reset,
  };
}
