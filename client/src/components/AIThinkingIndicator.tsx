/**
 * AI Thinking Indicator Component
 * 
 * 显示 AI 正在思考的实时状态和步骤动画
 * 用于面试页面，让用户了解 AI 正在做什么
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Bot, Brain, Search, Lightbulb, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThinkingStep {
  id: string;
  type: 'thinking' | 'searching' | 'analyzing' | 'generating' | 'complete';
  content: string;
  timestamp: number;
  duration?: number;
}

interface AIThinkingIndicatorProps {
  isThinking: boolean;
  steps?: ThinkingStep[];
  currentStep?: string;
  showDetails?: boolean;
  className?: string;
  language?: 'en' | 'zh';
}

const stepIcons = {
  thinking: Brain,
  searching: Search,
  analyzing: Lightbulb,
  generating: MessageSquare,
  complete: CheckCircle2,
};

const stepLabels = {
  en: {
    thinking: 'Thinking...',
    searching: 'Searching knowledge base...',
    analyzing: 'Analyzing your response...',
    generating: 'Generating response...',
    complete: 'Complete',
  },
  zh: {
    thinking: '思考中...',
    searching: '搜索知识库...',
    analyzing: '分析您的回答...',
    generating: '生成回复...',
    complete: '完成',
  },
};

export function AIThinkingIndicator({
  isThinking,
  steps = [],
  currentStep,
  showDetails = false,
  className,
  language = 'en',
}: AIThinkingIndicatorProps) {
  const [displayedSteps, setDisplayedSteps] = useState<ThinkingStep[]>([]);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Animate through default thinking phases if no steps provided
  useEffect(() => {
    if (!isThinking) {
      setDisplayedSteps([]);
      setAnimationPhase(0);
      return;
    }

    if (steps.length > 0) {
      setDisplayedSteps(steps);
      return;
    }

    // Default animation cycle
    const phases = ['thinking', 'searching', 'analyzing', 'generating'] as const;
    const interval = setInterval(() => {
      setAnimationPhase((prev) => (prev + 1) % phases.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isThinking, steps]);

  if (!isThinking) {
    return null;
  }

  const defaultPhases = ['thinking', 'searching', 'analyzing', 'generating'] as const;
  const currentPhase = currentStep || defaultPhases[animationPhase];
  const Icon = stepIcons[currentPhase as keyof typeof stepIcons] || Brain;
  const label = stepLabels[language][currentPhase as keyof typeof stepLabels.en] || stepLabels[language].thinking;

  return (
    <div className={cn("flex gap-3", className)}>
      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center gap-3">
          {/* Animated Icon */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Icon className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping" />
          </div>

          {/* Status Text */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-blue-800">{label}</span>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            </div>
            
            {/* Progress dots */}
            <div className="flex gap-1 mt-2">
              {defaultPhases.map((phase, index) => (
                <div
                  key={phase}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    index <= animationPhase
                      ? "bg-blue-500 scale-100"
                      : "bg-blue-200 scale-75"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Steps (optional) */}
        {showDetails && displayedSteps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200 space-y-2">
            {displayedSteps.map((step, index) => {
              const StepIcon = stepIcons[step.type] || Brain;
              const isLast = index === displayedSteps.length - 1;
              
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-start gap-2 text-sm",
                    isLast ? "text-blue-700" : "text-blue-500"
                  )}
                >
                  <StepIcon className={cn(
                    "w-4 h-4 mt-0.5 flex-shrink-0",
                    isLast && "animate-pulse"
                  )} />
                  <span className="flex-1">{step.content}</span>
                  {step.duration && (
                    <span className="text-xs text-blue-400">
                      {step.duration}ms
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function AIThinkingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

/**
 * Minimal thinking indicator for message bubbles
 */
export function AIThinkingBubble({ 
  message, 
  language = 'en' 
}: { 
  message?: string; 
  language?: 'en' | 'zh';
}) {
  const defaultMessage = language === 'zh' ? 'AI 正在思考...' : 'AI is thinking...';
  
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Brain className="w-4 h-4 animate-pulse text-blue-500" />
      <span>{message || defaultMessage}</span>
      <AIThinkingDots />
    </div>
  );
}
