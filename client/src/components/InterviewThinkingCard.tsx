/**
 * InterviewThinkingCard Component
 * 
 * Displays real-time progress during interview preparation.
 * Shows step-by-step progress with detailed descriptions.
 * Can be expanded in a sidebar Sheet for more details.
 */

import { useState, useEffect, useRef } from 'react';
import { ThinkingAnimation, BouncingDots } from './ThinkingAnimation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Brain, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Sparkles,
  Database,
  MessageSquare
} from 'lucide-react';

// Progress step types (matching server)
type ProgressStep = 
  | 'parsing'
  | 'searching_glassdoor'
  | 'searching_leetcode'
  | 'searching_tavily'
  | 'extracting_knowledge'
  | 'generating_plan'
  | 'complete'
  | 'error';

interface ProgressEvent {
  step: ProgressStep;
  message: string;
  detail?: string;
  progress: number;
  data?: Record<string, unknown>;
}

interface StepInfo {
  icon: React.ReactNode;
  label: string;
  description: string;
}

const STEP_INFO: Record<ProgressStep, StepInfo> = {
  parsing: {
    icon: <FileText className="w-4 h-4" />,
    label: 'Analyzing Input',
    description: 'Understanding your career goal and extracting company/position information',
  },
  searching_glassdoor: {
    icon: <Search className="w-4 h-4" />,
    label: 'Searching Glassdoor',
    description: 'Finding real interview experiences, questions, and difficulty ratings',
  },
  searching_leetcode: {
    icon: <Database className="w-4 h-4" />,
    label: 'Searching LeetCode',
    description: 'Collecting technical interview discussions and coding questions',
  },
  searching_tavily: {
    icon: <MessageSquare className="w-4 h-4" />,
    label: 'Searching Forums',
    description: 'Checking 一亩三分地, Reddit, Blind for additional insights',
  },
  extracting_knowledge: {
    icon: <Brain className="w-4 h-4" />,
    label: 'Extracting Knowledge',
    description: 'Using AI to analyze and structure interview patterns and questions',
  },
  generating_plan: {
    icon: <Sparkles className="w-4 h-4" />,
    label: 'Generating Plan',
    description: 'Creating a personalized interview preparation plan',
  },
  complete: {
    icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    label: 'Complete',
    description: 'Interview preparation is ready!',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4 text-red-500" />,
    label: 'Error',
    description: 'Something went wrong during preparation',
  },
};

interface InterviewThinkingCardProps {
  dreamJob: string;
  onComplete?: (data: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function InterviewThinkingCard({
  dreamJob,
  onComplete,
  onError,
  className = '',
}: InterviewThinkingCardProps) {
  const [currentStep, setCurrentStep] = useState<ProgressStep>('parsing');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('Starting...');
  const [detail, setDetail] = useState('');
  const [history, setHistory] = useState<ProgressEvent[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Start SSE connection
    const params = new URLSearchParams({ dreamJob });
    const eventSource = new EventSource(`/api/interview-progress?${params}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        
        setCurrentStep(data.step);
        setProgress(data.progress);
        setMessage(data.message);
        setDetail(data.detail || '');
        setHistory(prev => [...prev, data]);

        if (data.step === 'complete') {
          setIsComplete(true);
          eventSource.close();
          onComplete?.(data.data || {});
        } else if (data.step === 'error') {
          setIsError(true);
          eventSource.close();
          onError?.(data.detail || 'Unknown error');
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
      if (!isComplete && !isError) {
        setIsError(true);
        onError?.('Connection lost');
      }
    };

    return () => {
      eventSource.close();
    };
  }, [dreamJob, onComplete, onError, isComplete, isError]);

  const stepInfo = STEP_INFO[currentStep];

  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="p-4">
        {/* Main progress display */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-lg ${
            isError ? 'bg-red-100 text-red-600' : 
            isComplete ? 'bg-green-100 text-green-600' : 
            'bg-primary/10 text-primary'
          }`}>
            {stepInfo.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {!isComplete && !isError ? (
                <ThinkingAnimation text={message} className="text-sm font-medium" />
              ) : (
                <span className="text-sm font-medium">{message}</span>
              )}
            </div>
            {detail && (
              <p className="text-xs text-muted-foreground truncate">{detail}</p>
            )}
          </div>
          
          {/* Expand button */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="shrink-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Interview Preparation Progress</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                
                {/* Step history */}
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {history.map((event, index) => {
                    const info = STEP_INFO[event.step];
                    const isCurrentStep = index === history.length - 1 && !isComplete && !isError;
                    
                    return (
                      <div 
                        key={index}
                        className={`p-3 rounded-lg border ${
                          isCurrentStep ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded ${
                            event.step === 'error' ? 'bg-red-100 text-red-600' :
                            event.step === 'complete' ? 'bg-green-100 text-green-600' :
                            isCurrentStep ? 'bg-primary/20 text-primary' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {info.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{event.message}</span>
                              {isCurrentStep && <BouncingDots className="text-primary" />}
                            </div>
                            {event.detail && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {event.detail}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {info.description}
                            </p>
                            {event.data && Object.keys(event.data).length > 0 && (
                              <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                                {Object.entries(event.data).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="text-muted-foreground">{key}:</span>{' '}
                                    <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Progress bar */}
        <Progress value={progress} className="h-1.5" />
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for inline use
 */
export function InterviewThinkingInline({
  dreamJob,
  onComplete,
  onError,
}: Omit<InterviewThinkingCardProps, 'className'>) {
  const [message, setMessage] = useState('Preparing interview...');
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ dreamJob });
    const eventSource = new EventSource(`/api/interview-progress?${params}`);

    eventSource.onmessage = (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        setMessage(data.message);
        setProgress(data.progress);

        if (data.step === 'complete') {
          setIsComplete(true);
          eventSource.close();
          onComplete?.(data.data || {});
        } else if (data.step === 'error') {
          setIsError(true);
          eventSource.close();
          onError?.(data.detail || 'Unknown error');
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      if (!isComplete && !isError) {
        setIsError(true);
        onError?.('Connection lost');
      }
    };

    return () => eventSource.close();
  }, [dreamJob, onComplete, onError, isComplete, isError]);

  if (isComplete) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm">Ready!</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">Failed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ThinkingAnimation text={message} className="text-sm text-muted-foreground" />
      <span className="text-xs text-muted-foreground">({progress}%)</span>
    </div>
  );
}
