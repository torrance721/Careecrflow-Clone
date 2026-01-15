/**
 * 话题深度指示器组件
 * 
 * 类似密码强度的 4 段式指示器，显示当前话题讨论的信息完整度
 * 
 * 段位说明：
 * - 1 段：初始状态，刚开始讨论
 * - 2 段：有基本信息
 * - 3 段：信息较完整
 * - 4 段：信息非常完整，话题可以自动结束
 */

import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';

interface TopicDepthIndicatorProps {
  /** 当前话题名称 */
  topicName: string;
  /** 当前深度等级 (1-4) */
  depth: number;
  /** 最大深度等级 */
  maxDepth?: number;
  /** 语言 */
  language?: 'en' | 'zh';
  /** 自定义类名 */
  className?: string;
}

// 深度等级标签
const DEPTH_LABELS = {
  en: ['Starting', 'Basic', 'Good', 'Complete'],
  zh: ['开始', '基础', '良好', '完整'],
};

// 深度等级颜色
const DEPTH_COLORS = [
  'bg-red-400',      // 1 - 红色
  'bg-yellow-400',   // 2 - 黄色
  'bg-blue-400',     // 3 - 蓝色
  'bg-green-400',    // 4 - 绿色
];

export function TopicDepthIndicator({
  topicName,
  depth,
  maxDepth = 4,
  language = 'en',
  className,
}: TopicDepthIndicatorProps) {
  // 确保深度在有效范围内
  const normalizedDepth = Math.max(1, Math.min(depth, maxDepth));
  const labels = DEPTH_LABELS[language];
  const currentLabel = labels[normalizedDepth - 1];
  
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* 话题名称 */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MessageCircle className="w-4 h-4" />
        <span className="font-medium truncate max-w-[150px]" title={topicName}>
          {topicName}
        </span>
      </div>
      
      {/* 分隔线 */}
      <div className="w-px h-4 bg-border" />
      
      {/* 深度指示器 */}
      <div className="flex items-center gap-1.5">
        {/* 分段条 */}
        <div className="flex gap-0.5">
          {Array.from({ length: maxDepth }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-6 h-2 rounded-sm transition-all duration-300",
                index < normalizedDepth
                  ? DEPTH_COLORS[Math.min(normalizedDepth - 1, DEPTH_COLORS.length - 1)]
                  : "bg-muted"
              )}
            />
          ))}
        </div>
        
        {/* 当前状态标签 */}
        <span className={cn(
          "text-xs font-medium px-1.5 py-0.5 rounded",
          normalizedDepth === 4 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : normalizedDepth === 3
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : normalizedDepth === 2
            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        )}>
          {currentLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * 根据收集的信息点计算深度等级
 * 
 * @param collectedInfoPoints 收集到的信息点数量
 * @param totalExpectedPoints 预期的总信息点数量（默认 8）
 * @returns 深度等级 (1-4)
 */
export function calculateDepthLevel(
  collectedInfoPoints: number,
  totalExpectedPoints: number = 8
): number {
  const ratio = collectedInfoPoints / totalExpectedPoints;
  
  if (ratio >= 0.9) return 4; // 90%+ = 完整
  if (ratio >= 0.6) return 3; // 60-90% = 良好
  if (ratio >= 0.3) return 2; // 30-60% = 基础
  return 1; // <30% = 开始
}

export default TopicDepthIndicator;
