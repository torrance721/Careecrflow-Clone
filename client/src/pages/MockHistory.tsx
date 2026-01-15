import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Play, Pause, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function MockHistory() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const interviewId = params.id ? parseInt(params.id) : null;
  const { t, language } = useLanguage();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>("score");
  const audioRef = useRef<HTMLAudioElement>(null);

  const { data: interview, isLoading } = trpc.interviews.get.useQuery(
    { id: interviewId! },
    { enabled: isAuthenticated && !!interviewId }
  );

  const deleteMutation = trpc.interviews.delete.useMutation({
    onSuccess: () => {
      setLocation("/");
    },
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'zh' ? "zh-CN" : "en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <h2 className="text-xl font-semibold mb-2">
          {language === 'zh' ? '面试记录未找到' : 'Interview not found'}
        </h2>
        <Button onClick={() => setLocation("/")} className="rounded-full">
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const feedback = interview.aiFeedback;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg ml-3">{t('history.title')}</h1>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 container py-4 space-y-4 pb-24">
        {/* Question Card */}
        <Card className="bg-card rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-foreground leading-relaxed">
              {interview.question}
            </p>
            <button className="w-full flex justify-center mt-2">
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>

        {/* Mock Interview Card */}
        <Card className="bg-blue-gradient rounded-2xl border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{t('nav.mockInterview')}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg bg-primary/10 hover:bg-primary/20"
                onClick={() => {
                  const confirmMsg = language === 'zh' 
                    ? "确定要删除这条面试记录吗？" 
                    : "Are you sure you want to delete this interview?";
                  if (confirm(confirmMsg)) {
                    deleteMutation.mutate({ id: interview.id });
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-primary" />
              </Button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-primary font-medium">
                {language === 'zh' ? '日期' : 'Date'}: {formatDate(interview.date)}
              </span>
              <span className="text-primary font-medium">
                {language === 'zh' ? '得分' : 'Score'}: {interview.score}/10
              </span>
              <span className="text-muted-foreground">
                1/1
              </span>
            </div>

            {/* Audio Player */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full bg-muted"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(currentTime / 100) * 100}%` }}
                />
              </div>
              
              <span className="text-sm text-muted-foreground min-w-[80px] text-right">
                {interview.audioDuration || "0m:0s"}
              </span>
            </div>

            {interview.audioUrl && (
              <audio
                ref={audioRef}
                src={interview.audioUrl}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setIsPlaying(false)}
              />
            )}
          </CardContent>
        </Card>

        {/* AI Feedback */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm px-1">
            {language === 'zh' ? '以下是对您回答的分析：' : "Here's an analysis of your answer:"}
          </p>
          <div className="h-px bg-border" />
        </div>

        {/* Score Section */}
        <Card className="bg-card rounded-2xl border-0 shadow-sm">
          <button
            className="w-full p-4 flex items-center justify-between"
            onClick={() => toggleSection("score")}
          >
            <span className="text-primary font-semibold">
              {language === 'zh' ? '1. 为我的回答评分' : '1. Score my answer.'}
            </span>
            {expandedSection === "score" ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSection === "score" && (
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <div>
                <span className="font-semibold">{language === 'zh' ? '得分：' : 'Score: '}</span>
                <span>{interview.score}/10</span>
              </div>
              {feedback?.scoreReason && (
                <div>
                  <span className="font-semibold">
                    {language === 'zh' ? '为什么是这个分数？' : 'Why this score? '}
                  </span>
                  <span className="text-muted-foreground">{feedback.scoreReason}</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Interviewer Intent Section */}
        <Card className="bg-card rounded-2xl border-0 shadow-sm">
          <button
            className="w-full p-4 flex items-center justify-between"
            onClick={() => toggleSection("intent")}
          >
            <span className="text-primary font-semibold">
              {language === 'zh' 
                ? '2. 面试官为什么会问这个问题？' 
                : '2. Why would an interviewer ask this question?'}
            </span>
            {expandedSection === "intent" ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {expandedSection === "intent" && feedback && (
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              {feedback.capabilityAssessed && (
                <div>
                  <span className="font-semibold">
                    {language === 'zh' ? '评估的能力：' : 'Capability assessed: '}
                  </span>
                  <span className="text-muted-foreground">{feedback.capabilityAssessed}</span>
                </div>
              )}
              {feedback.whatToAnswer && (
                <div>
                  <span className="font-semibold">
                    {language === 'zh' ? '我应该如何回答？' : 'What exactly should I be answering? '}
                  </span>
                  <span className="text-muted-foreground">{feedback.whatToAnswer}</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </main>

      {/* Practice Again Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="container">
          <Button
            className="w-full h-12 rounded-full text-base font-medium bg-primary hover:bg-primary/90"
            onClick={() => {
              alert(language === 'zh' ? '再次练习功能即将推出！' : 'Practice Again feature coming soon!');
            }}
          >
            {t('report.tryAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
}
