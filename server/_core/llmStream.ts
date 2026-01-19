/**
 * 流式 LLM 调用
 * 
 * 支持 SSE 流式输出，用于实时显示 AI 响应
 */

import { ENV } from './env';
import type { Message, Tool, ToolChoice, ResponseFormat, InvokeParams } from './llm';

export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
  finishReason?: string;
}

export type StreamCallback = (chunk: StreamChunk) => void;

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id, content } = message;

  if (role === "tool" || role === "function") {
    const contentStr = Array.isArray(content)
      ? content.map(part => (typeof part === "string" ? part : JSON.stringify(part))).join("\n")
      : typeof content === "string" ? content : JSON.stringify(content);

    return {
      role,
      name,
      tool_call_id,
      content: contentStr,
    };
  }

  // Normalize content to string for simplicity in streaming
  if (typeof content === "string") {
    return { role, name, content };
  }

  if (Array.isArray(content)) {
    const textParts = content
      .filter(part => typeof part === "string" || part.type === "text")
      .map(part => typeof part === "string" ? part : (part as { type: "text"; text: string }).text);
    return { role, name, content: textParts.join("\n") };
  }

  return { role, name, content: JSON.stringify(content) };
};

/**
 * 流式调用 LLM
 * 
 * @param params LLM 调用参数
 * @param onChunk 每个 chunk 的回调函数
 * @returns 完整的响应内容
 */
export async function invokeLLMStream(
  params: Omit<InvokeParams, 'responseFormat' | 'response_format' | 'outputSchema' | 'output_schema'>,
  onChunk: StreamCallback
): Promise<string> {
  assertApiKey();

  const { messages, tools, toolChoice, tool_choice } = params;

  const payload: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: messages.map(normalizeMessage),
    stream: true, // 启用流式输出
    max_tokens: 16384,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = toolChoice || tool_choice;
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`;
    onChunk({ type: 'error', error });
    throw new Error(error);
  }

  if (!response.body) {
    const error = 'No response body';
    onChunk({ type: 'error', error });
    throw new Error(error);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onChunk({ type: 'done', content: fullContent });
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            onChunk({ type: 'done', content: fullContent });
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const finishReason = parsed.choices?.[0]?.finish_reason;

            if (delta?.content) {
              fullContent += delta.content;
              onChunk({ type: 'content', content: delta.content });
            }

            if (finishReason) {
              onChunk({ type: 'done', content: fullContent, finishReason });
            }
          } catch (e) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

/**
 * 创建一个简单的流式响应生成器
 * 用于 SSE 端点
 */
export async function* createStreamGenerator(
  params: Omit<InvokeParams, 'responseFormat' | 'response_format' | 'outputSchema' | 'output_schema'>
): AsyncGenerator<StreamChunk> {
  const chunks: StreamChunk[] = [];
  let resolveNext: (() => void) | null = null;
  let done = false;

  // Start the stream
  const streamPromise = invokeLLMStream(params, (chunk) => {
    chunks.push(chunk);
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
    if (chunk.type === 'done' || chunk.type === 'error') {
      done = true;
    }
  }).catch((error) => {
    chunks.push({ type: 'error', error: error.message });
    done = true;
    if (resolveNext) {
      resolveNext();
      resolveNext = null;
    }
  });

  while (!done || chunks.length > 0) {
    if (chunks.length > 0) {
      const chunk = chunks.shift()!;
      yield chunk;
      if (chunk.type === 'done' || chunk.type === 'error') {
        break;
      }
    } else {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
  }

  await streamPromise;
}
