/**
 * ReActTraceViewer Component
 * 
 * 展示 ReAct Agent 的思考轨迹，让用户了解 AI 如何选择问题
 * 支持实时更新和动画效果
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  Wrench,
  Eye,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
  Search,
  Database,
  MessageSquare,
  Lightbulb,
  Target,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== Types ====================

export interface ThoughtStep {
  step: number;
  thought: string;
  action?: {
    tool: string;
    params: Record<string, unknown>;
  };
  observation?: string;
  timeSpentMs: number;
}

export interface ReActTrace {
  steps: ThoughtStep[];
  totalTimeMs: number;
  finalAnswer?: unknown;
  earlyStop: boolean;
  earlyStopReason?: string;
}

export interface ReActTraceData {
  moduleName: string;
  trace: ReActTrace;
  timestamp: number;
}

// ==================== Tool Icons ====================

const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_knowledge_base: <Search className="w-3 h-3" />,
  analyze_difficulty: <Target className="w-3 h-3" />,
  check_user_background: <Database className="w-3 h-3" />,
  generate_question_variants: <MessageSquare className="w-3 h-3" />,
  select_best_question: <Sparkles className="w-3 h-3" />,
  analyze_response: <Brain className="w-3 h-3" />,
  generate_hint: <Lightbulb className="w-3 h-3" />,
  evaluate_progress: <Target className="w-3 h-3" />,
  default: <Wrench className="w-3 h-3" />,
};

const MODULE_COLORS: Record<string, string> = {
  question_generation: 'bg-blue-500',
  hint_system: 'bg-amber-500',
  next_question: 'bg-green-500',
  response_analysis: 'bg-purple-500',
  default: 'bg-gray-500',
};

// ==================== Single Step Component ====================

interface ThoughtStepCardProps {
  step: ThoughtStep;
  isActive: boolean;
  isLast: boolean;
  animate: boolean;
}

function ThoughtStepCard({ step, isActive, isLast, animate }: ThoughtStepCardProps) {
  const [expanded, setExpanded] = useState(isActive);
  const toolIcon = step.action?.tool 
    ? TOOL_ICONS[step.action.tool] || TOOL_ICONS.default 
    : null;

  return (
    <div 
      className={cn(
        "relative pl-6 pb-4",
        !isLast && "border-l-2 border-muted ml-3",
        animate && isActive && "animate-pulse"
      )}
    >
      {/* Step indicator */}
      <div className={cn(
        "absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {step.step}
      </div>

      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <div className={cn(
            "ml-4 p-3 rounded-lg border cursor-pointer transition-colors",
            isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
          )}>
            <div className="flex items-start gap-2">
              <Brain className={cn(
                "w-4 h-4 mt-0.5 flex-shrink-0",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{step.thought}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{step.timeSpentMs}ms</span>
                  {step.action && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        {toolIcon}
                        <span>{step.action.tool}</span>
                      </div>
                    </>
                  )}
                  {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="ml-4 mt-2 space-y-2">
            {/* Action details */}
            {step.action && (
              <div className="p-2 rounded bg-muted/50 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <Wrench className="w-3 h-3" />
                  <span className="font-medium">Action: {step.action.tool}</span>
                </div>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(step.action.params, null, 2)}
                </pre>
              </div>
            )}

            {/* Observation */}
            {step.observation && (
              <div className="p-2 rounded bg-green-50 dark:bg-green-950/20 text-xs">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                  <Eye className="w-3 h-3" />
                  <span className="font-medium">Observation</span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{step.observation}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ==================== Compact Trace Badge ====================

interface ReActTraceBadgeProps {
  trace: ReActTrace;
  moduleName: string;
  onClick?: () => void;
}

export function ReActTraceBadge({ trace, moduleName, onClick }: ReActTraceBadgeProps) {
  const moduleColor = MODULE_COLORS[moduleName] || MODULE_COLORS.default;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors gap-1",
        onClick && "hover:border-primary"
      )}
      onClick={onClick}
    >
      <div className={cn("w-2 h-2 rounded-full", moduleColor)} />
      <Brain className="w-3 h-3" />
      <span>{trace.steps.length} steps</span>
      <span className="text-muted-foreground">• {trace.totalTimeMs}ms</span>
      {trace.earlyStop && (
        <Zap className="w-3 h-3 text-amber-500" />
      )}
    </Badge>
  );
}

// ==================== Full Trace Viewer ====================

interface ReActTraceViewerProps {
  trace: ReActTrace;
  moduleName: string;
  title?: string;
  animate?: boolean;
  className?: string;
}

export function ReActTraceViewer({ 
  trace, 
  moduleName, 
  title,
  animate = false,
  className 
}: ReActTraceViewerProps) {
  const moduleColor = MODULE_COLORS[moduleName] || MODULE_COLORS.default;
  const [activeStep, setActiveStep] = useState(trace.steps.length);

  // Animate through steps
  useEffect(() => {
    if (animate && trace.steps.length > 0) {
      setActiveStep(0);
      const interval = setInterval(() => {
        setActiveStep(prev => {
          if (prev >= trace.steps.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [animate, trace.steps.length]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", moduleColor)} />
            <CardTitle className="text-base">
              {title || `${moduleName.replace(/_/g, ' ')} Trace`}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{trace.totalTimeMs}ms</span>
            {trace.earlyStop && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Early Stop
              </Badge>
            )}
          </div>
        </div>
        
        {/* Progress indicator */}
        <Progress 
          value={(activeStep / trace.steps.length) * 100} 
          className="h-1 mt-2" 
        />
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-0">
            {trace.steps.map((step, index) => (
              <ThoughtStepCard
                key={step.step}
                step={step}
                isActive={index === activeStep - 1}
                isLast={index === trace.steps.length - 1}
                animate={animate}
              />
            ))}
          </div>

          {/* Final answer */}
          {trace.finalAnswer !== undefined && trace.finalAnswer !== null && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium text-sm">Final Answer</span>
              </div>
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                {String(typeof trace.finalAnswer === 'string' 
                  ? trace.finalAnswer 
                  : JSON.stringify(trace.finalAnswer, null, 2))}
              </pre>
            </div>
          )}

          {/* Early stop reason */}
          {trace.earlyStop && trace.earlyStopReason && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Early Stop Reason</span>
              </div>
              <p className="text-xs text-muted-foreground">{trace.earlyStopReason}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ==================== Sheet Wrapper ====================

interface ReActTraceSheetProps {
  trace: ReActTrace;
  moduleName: string;
  title?: string;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
}

export function ReActTraceSheet({ 
  trace, 
  moduleName, 
  title,
  trigger,
  children 
}: ReActTraceSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-1">
            <Brain className="w-4 h-4" />
            <span>View Thinking</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {title || 'AI Thinking Process'}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <ReActTraceViewer 
            trace={trace} 
            moduleName={moduleName}
            animate={true}
            className="border-0 shadow-none"
          />
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ==================== Inline Thinking Indicator ====================

interface ThinkingIndicatorProps {
  isThinking: boolean;
  currentStep?: string;
  stepsCompleted?: number;
  totalSteps?: number;
  className?: string;
}

export function ThinkingIndicator({ 
  isThinking, 
  currentStep,
  stepsCompleted = 0,
  totalSteps = 0,
  className 
}: ThinkingIndicatorProps) {
  if (!isThinking) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm text-muted-foreground",
      className
    )}>
      <div className="relative">
        <Brain className="w-4 h-4 animate-pulse text-primary" />
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
      </div>
      <span className="animate-pulse">
        {currentStep || 'Thinking...'}
      </span>
      {totalSteps > 0 && (
        <Badge variant="outline" className="text-xs">
          {stepsCompleted}/{totalSteps}
        </Badge>
      )}
    </div>
  );
}

// ==================== Multi-Trace Timeline ====================

interface MultiTraceTimelineProps {
  traces: ReActTraceData[];
  className?: string;
}

export function MultiTraceTimeline({ traces, className }: MultiTraceTimelineProps) {
  const [selectedTrace, setSelectedTrace] = useState<ReActTraceData | null>(null);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Timeline */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {traces.map((traceData, index) => (
          <ReActTraceBadge
            key={index}
            trace={traceData.trace}
            moduleName={traceData.moduleName}
            onClick={() => setSelectedTrace(traceData)}
          />
        ))}
      </div>

      {/* Selected trace viewer */}
      {selectedTrace && (
        <ReActTraceViewer
          trace={selectedTrace.trace}
          moduleName={selectedTrace.moduleName}
          animate={false}
        />
      )}
    </div>
  );
}

export default ReActTraceViewer;
