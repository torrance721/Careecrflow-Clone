/**
 * 打字机光标组件
 * 
 * 行业标准的流式输出交互：
 * 1. 闪烁的竖线光标
 * 2. 平滑的动画效果
 * 3. 内容完成后光标消失
 */

import { cn } from '@/lib/utils';

interface TypewriterCursorProps {
  /** 是否正在输入 */
  isTyping?: boolean;
  /** 自定义类名 */
  className?: string;
}

export function TypewriterCursor({ isTyping = true, className }: TypewriterCursorProps) {
  if (!isTyping) return null;
  
  return (
    <span 
      className={cn(
        "inline-block w-0.5 h-[1.2em] bg-primary ml-0.5 align-middle",
        "animate-cursor-blink",
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * 流式文本显示组件
 * 
 * 包含文本内容和打字机光标
 */
interface StreamingTextProps {
  /** 流式内容 */
  content: string;
  /** 是否正在流式输出 */
  isStreaming: boolean;
  /** 自定义类名 */
  className?: string;
}

export function StreamingText({ content, isStreaming, className }: StreamingTextProps) {
  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {content}
      <TypewriterCursor isTyping={isStreaming && content.length > 0} />
    </div>
  );
}

export default TypewriterCursor;
