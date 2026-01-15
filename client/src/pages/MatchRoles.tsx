import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight, Loader2, ExternalLink, Linkedin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { JobCard } from "@/components/JobCard";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LinkedInJobSearch } from "@/components/LinkedInJobSearch";

export default function MatchRoles() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const { t, language } = useLanguage();

  const { data: jobs, isLoading, refetch } = trpc.jobs.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const generateJobsMutation = trpc.jobs.generateMock.useMutation({
    onSuccess: () => {
      refetch();
      setCurrentIndex(0);
    },
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!jobs || jobs.length === 0) return;
      if (e.key === "ArrowLeft") {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex(prev => Math.min(jobs.length - 1, prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jobs]);

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

  const totalJobs = jobs?.length || 0;
  const currentJob = jobs?.[currentIndex];
  const hasNotification = true; // Mock notification indicator

  return (
    <div className="min-h-screen bg-blue-gradient flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">{t('matchRoles.title')}</h1>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl bg-primary/10 relative"
              onClick={() => generateJobsMutation.mutate()}
              disabled={generateJobsMutation.isPending}
            >
              <RefreshCw className={`h-5 w-5 text-primary ${generateJobsMutation.isPending ? 'animate-spin' : ''}`} />
              {hasNotification && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container py-4 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <RefreshCw className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {language === 'zh' ? '未找到匹配的职位' : 'No matching roles found'}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {language === 'zh' 
                ? '请先设置您的求职偏好，然后点击刷新按钮查找匹配的职位。'
                : 'Set your job preferences first, then click the refresh button to find matching roles.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <LinkedInJobSearch onSuccess={() => refetch()} />
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => generateJobsMutation.mutate()}
                disabled={generateJobsMutation.isPending}
              >
                {generateJobsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {language === 'zh' ? '生成模拟职位' : 'Generate Mock Jobs'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Subheader */}
            <div className="mb-4">
              <h2 className="font-semibold text-lg">
                {language === 'zh' ? '推荐职位' : 'Recommended Roles'}
              </h2>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-muted-foreground">
                  {language === 'zh' 
                    ? '基于您的回答和偏好'
                    : 'Based on your answers & preferences'}
                </p>
                <span className="text-sm font-medium">
                  {currentIndex + 1}/{totalJobs}
                </span>
              </div>
              
              {/* Progress Indicators */}
              <div className="flex gap-1.5 mt-3">
                {jobs.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className="flex-1 h-1.5 rounded-full transition-colors"
                    style={{
                      backgroundColor: index <= currentIndex 
                        ? 'oklch(55% 0.22 264)' 
                        : 'oklch(90% 0.02 264)'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Job Card */}
            <div className="flex-1 overflow-auto">
              {currentJob && <JobCard job={currentJob} />}
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      {jobs && jobs.length > 0 && (
        <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border p-4">
          <div className="container flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full flex-shrink-0"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-full text-base font-medium"
              onClick={() => {
                if (currentJob?.linkedinUrl) {
                  window.open(currentJob.linkedinUrl, "_blank");
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('matchRoles.viewOnLinkedIn')}
            </Button>
            
            <Button
              className="flex-1 h-12 rounded-full bg-primary hover:bg-primary/90 text-base font-medium"
              onClick={() => {
                if (currentJob) {
                  // Navigate to new interview mode selection with job context
                  setLocation(`/interview-mode?position=${encodeURIComponent(currentJob.position + ' at ' + currentJob.company)}`);
                }
              }}
            >
              {t('matchRoles.startInterview')}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
              onClick={() => setCurrentIndex(prev => Math.min(totalJobs - 1, prev + 1))}
              disabled={currentIndex === totalJobs - 1}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
