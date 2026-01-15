import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Lightbulb, Loader2, Info, Target, List, Tag, Compass, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { ReActTraceViewer, type ReActTrace } from "@/components/ReActTraceViewer";
import { trpc } from "@/lib/trpc";

interface HintButtonProps {
  sessionId: number;
  currentQuestion: string;
  userResponse?: string;
  language: 'en' | 'zh';
  disabled?: boolean;
}

const hintTypeIcons = {
  clarification: Info,
  structure: List,
  example: Target,
  keyword: Tag,
  approach: Compass,
};

const hintTypeLabels = {
  en: {
    clarification: 'Clarification',
    structure: 'Structure',
    example: 'Example',
    keyword: 'Keywords',
    approach: 'Approach',
  },
  zh: {
    clarification: '理解问题',
    structure: '回答结构',
    example: '举例说明',
    keyword: '关键词',
    approach: '思考方向',
  },
};

export function HintButton({ 
  sessionId, 
  currentQuestion, 
  userResponse, 
  language,
  disabled 
}: HintButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hint, setHint] = useState<{
    hint: string;
    reasoning: string;
    hintType: 'clarification' | 'structure' | 'example' | 'keyword' | 'approach';
    relatedQuestion?: string;
    trace?: ReActTrace;
  } | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  const getHintMutation = trpc.mockInterview.getHint.useMutation({
    onSuccess: (data) => {
      setHint(data);
    },
  });

  const handleGetHint = () => {
    if (!currentQuestion) return;
    
    getHintMutation.mutate({
      sessionId,
      currentQuestion,
      userResponse,
      language,
    });
  };

  const isZh = language === 'zh';
  const HintIcon = hint ? hintTypeIcons[hint.hintType] : Lightbulb;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !currentQuestion}
          onClick={() => {
            setIsOpen(true);
            if (!hint) {
              handleGetHint();
            }
          }}
          className="gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          {isZh ? '获取提示' : 'Get Hint'}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            {isZh ? '面试提示' : 'Interview Hint'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Question */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {isZh ? '当前问题' : 'Current Question'}
            </h3>
            <Card className="p-4 bg-blue-50/50 border-blue-100">
              <p className="text-sm">{currentQuestion}</p>
            </Card>
          </div>

          {/* Loading State */}
          {getHintMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                {isZh ? '正在生成提示...' : 'Generating hint...'}
              </p>
            </div>
          )}

          {/* Error State */}
          {getHintMutation.isError && (
            <Card className="p-4 bg-red-50 border-red-100">
              <p className="text-sm text-red-600">
                {isZh ? '生成提示失败，请重试' : 'Failed to generate hint. Please try again.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetHint}
                className="mt-2"
              >
                {isZh ? '重试' : 'Retry'}
              </Button>
            </Card>
          )}

          {/* Hint Content */}
          {hint && !getHintMutation.isPending && (
            <>
              {/* Hint Type Badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  <HintIcon className="w-4 h-4" />
                  <span>{hintTypeLabels[language][hint.hintType]}</span>
                </div>
              </div>

              {/* Main Hint */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {isZh ? '提示' : 'Hint'}
                </h3>
                <Card className="p-4 bg-yellow-50/50 border-yellow-100">
                  <p className="text-sm leading-relaxed">{hint.hint}</p>
                </Card>
              </div>

              {/* Reasoning */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {isZh ? '为什么给这个提示' : 'Why This Hint'}
                </h3>
                <Card className="p-4 bg-gray-50/50">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {hint.reasoning}
                  </p>
                </Card>
              </div>

              {/* Related Question from Knowledge Base */}
              {hint.relatedQuestion && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    {isZh ? '相关面试问题' : 'Related Interview Question'}
                  </h3>
                  <Card className="p-4 bg-blue-50/30 border-blue-100">
                    <p className="text-sm italic">"{hint.relatedQuestion}"</p>
                  </Card>
                </div>
              )}

              {/* AI Thinking Process */}
              {hint.trace && (
                <div className="pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTrace(!showTrace)}
                    className="w-full justify-between text-muted-foreground hover:text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      <span>{isZh ? 'AI 思考过程' : 'AI Thinking Process'}</span>
                    </div>
                    {showTrace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  {showTrace && (
                    <div className="mt-3">
                      <ReActTraceViewer
                        trace={hint.trace}
                        moduleName="hint_system"
                        title={isZh ? 'Hint 生成追踪' : 'Hint Generation Trace'}
                        animate={false}
                        className="border-0 shadow-none bg-muted/30"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Get Another Hint */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleGetHint}
                  disabled={getHintMutation.isPending}
                  className="w-full"
                >
                  {getHintMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lightbulb className="w-4 h-4 mr-2" />
                  )}
                  {isZh ? '获取另一个提示' : 'Get Another Hint'}
                </Button>
              </div>
            </>
          )}

          {/* Tips */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {isZh 
                ? '💡 提示：提示是为了帮助你思考，不是直接给答案。尝试用自己的话来回答问题。'
                : '💡 Tip: Hints are meant to guide your thinking, not give you the answer. Try to respond in your own words.'}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
