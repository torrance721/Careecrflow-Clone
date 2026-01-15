import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, Settings, RefreshCw } from "lucide-react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { JobPreferencesModal } from "@/components/JobPreferencesModal";
import { BottomNav } from "@/components/BottomNav";
import { InterviewHistoryCard } from "@/components/InterviewHistoryCard";
import { useLocation } from "wouter";
import { useLanguage, interpolate } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Home() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"mock-interview" | "mock-questions" | "ai-interview">("mock-interview");
  const { t, language } = useLanguage();

  const { data: preferences, refetch: refetchPreferences } = trpc.preferences.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: jobs, refetch: refetchJobs } = trpc.jobs.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: interviews, refetch: refetchInterviews } = trpc.interviews.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const generateJobsMutation = trpc.jobs.generateMock.useMutation({
    onSuccess: () => {
      refetchJobs();
    },
  });

  const generateInterviewsMutation = trpc.interviews.generateMock.useMutation({
    onSuccess: () => {
      refetchInterviews();
    },
  });

  // Calculate match accuracy based on preferences completion
  const calculateMatchAccuracy = () => {
    if (!preferences) return 0;
    let score = 0;
    const total = 5;
    if (preferences.employmentTypes && preferences.employmentTypes.length > 0) score += 2;
    if (preferences.workMode) score += 1;
    if (preferences.location) score += 2;
    return score;
  };

  const matchAccuracy = calculateMatchAccuracy();
  const answeredQuestions = matchAccuracy;
  const totalQuestions = 5;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <span className="text-3xl font-bold text-primary">U</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {language === 'zh' ? '欢迎使用 UHired' : 'Welcome to UHired'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'zh' 
              ? '您的 AI 驱动求职面试准备平台。获取个性化职位匹配，练习模拟面试。'
              : 'Your AI-powered job interview preparation platform. Get personalized job matches and practice mock interviews.'}
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 h-12 text-base"
            onClick={() => window.location.href = getLoginUrl()}
          >
            {language === 'zh' ? '登录开始使用' : 'Sign in to Get Started'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-gradient pb-24 md:pb-4">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">
              {language === 'zh' ? '全栈开发面试助手' : 'Full Stack Developer Interview Bot'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-4 space-y-4">
        {/* Job Recommendations Card */}
        <Card className="bg-card rounded-2xl shadow-sm border-0 overflow-hidden">
          <div className="bg-blue-gradient p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-lg">{t('home.jobRecommendations')}</h2>
              <span className="text-sm text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
                {t('home.answers')} {answeredQuestions}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mb-3">
              {jobs && jobs.length > 0 
                ? interpolate(t('home.jobsMatched'), { count: jobs.length })
                : (language === 'zh' ? '您现在可以匹配职位了。' : 'You can now match roles.')}
            </p>
            
            <div className="flex items-center gap-2 mb-3">
              <span className="text-primary text-sm font-medium">{t('home.estimatedMatchAccuracy')}</span>
              <span className={`font-bold ${matchAccuracy > 3 ? 'text-green-600' : 'text-primary'}`}>
                {Math.round((matchAccuracy / totalQuestions) * 100)}%
              </span>
              <span className="text-muted-foreground text-sm ml-auto">
                {answeredQuestions}/{totalQuestions}
              </span>
            </div>
            
            <Progress 
              value={(matchAccuracy / totalQuestions) * 100} 
              className="h-1.5 bg-primary/20"
            />

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPreferencesOpen(true)}
                className="text-primary font-medium text-sm underline underline-offset-2 hover:no-underline"
              >
                {t('home.setPreferences')}
              </button>
              <Button
                className="rounded-full px-4 h-9 bg-primary hover:bg-primary/90"
                onClick={() => setLocation("/match-roles")}
                disabled={!preferences || matchAccuracy === 0}
              >
                {t('home.matchRoles')} →
              </Button>
            </div>
          </div>
        </Card>

        {/* Generate Mock Data Buttons (for demo) */}
        {(!jobs || jobs.length === 0) && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => generateJobsMutation.mutate()}
              disabled={generateJobsMutation.isPending}
            >
              {generateJobsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {language === 'zh' ? '生成职位' : 'Generate Jobs'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => generateInterviewsMutation.mutate()}
              disabled={generateInterviewsMutation.isPending}
            >
              {generateInterviewsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {language === 'zh' ? '生成面试' : 'Generate Interviews'}
            </Button>
          </div>
        )}

        {/* Interview History */}
        <div className="space-y-3">
          {interviews && interviews.length > 0 ? (
            interviews.map((interview) => (
              <InterviewHistoryCard
                key={interview.id}
                interview={interview}
                onClick={() => setLocation(`/mock-history/${interview.id}`)}
              />
            ))
          ) : (
            <Card className="bg-card rounded-2xl border-0 shadow-sm">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">
                  {t('home.noInterviewHistory')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Start Mock Button */}
      <div className="fixed bottom-20 left-0 right-0 px-4 md:bottom-4">
        <div className="container max-w-lg mx-auto">
          <Button
            className="w-full h-12 rounded-full text-base font-medium bg-primary hover:bg-primary/90 shadow-lg"
            onClick={() => {
              // Navigate to match roles first to select a job
              if (jobs && jobs.length > 0) {
                setLocation("/match-roles");
              } else {
                alert(language === 'zh' 
                  ? '请先生成职位或设置您的偏好来匹配职位。'
                  : 'Please generate jobs first or set your preferences to match roles.');
              }
            }}
          >
            {t('home.startMock')}
          </Button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Job Preferences Modal */}
      <JobPreferencesModal
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        onSave={() => {
          refetchPreferences();
        }}
      />
    </div>
  );
}
