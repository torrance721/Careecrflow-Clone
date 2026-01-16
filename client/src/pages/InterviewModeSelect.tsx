/**
 * 话题练习入口页面
 * 
 * 简化流程：直接输入职位开始练习
 */

import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useInterviewTracking } from "@/hooks/useAnalytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, Sparkles, Target, MessageCircle, Building2, Zap, Bookmark, Home } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { getLoginUrl } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function InterviewModeSelect() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { language } = useLanguage();
  const isZh = language === "zh";

  // Parse URL params to pre-fill position
  const urlParams = new URLSearchParams(searchString);
  const initialPosition = urlParams.get("position") || "";

  const [position, setPosition] = useState(initialPosition);
  const { trackInterviewStart } = useInterviewTracking();

  const handleStart = () => {
    if (!position.trim()) return;
    
    // Track interview start
    trackInterviewStart('topic_practice', position);
    
    navigate(`/topic-practice?position=${encodeURIComponent(position)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && position.trim()) {
      handleStart();
    }
  };

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
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {isZh ? "开始面试练习" : "Start Interview Practice"}
          </h1>
          <p className="text-muted-foreground">
            {isZh
              ? "登录后即可开始面试练习"
              : "Sign in to start your interview practice"}
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 h-12 text-base"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            {isZh ? "登录开始使用" : "Sign in to Get Started"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              {isZh ? "首页" : "Home"}
            </Button>
            <h1 className="font-semibold text-lg">
              {isZh ? "话题练习" : "Topic Practice"}
            </h1>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container py-8 space-y-8 max-w-2xl">
        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">
              {isZh ? "开始话题练习" : "Start Topic Practice"}
            </CardTitle>
            <CardDescription className="text-base">
              {isZh
                ? "输入你的目标职位，我们会生成相关的面试话题"
                : "Enter your target position, we'll generate relevant interview topics"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Position Input */}
            <div className="space-y-2">
              <Input
                placeholder={isZh ? "例如：Product Manager at Google" : "e.g., Product Manager at Google"}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-12 text-base"
                autoFocus
              />
            </div>

            {/* Start Button */}
            <Button
              className="w-full h-12 text-base"
              size="lg"
              onClick={handleStart}
              disabled={!position.trim()}
            >
              {isZh ? "开始练习" : "Start Practice"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">
                {isZh ? "即时反馈" : "Instant Feedback"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isZh ? "一个信息点就给专业反馈" : "Professional feedback after one key point"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">
                {isZh ? "公司推荐" : "Company Match"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isZh ? "基于技能匹配合适公司" : "Match companies based on your skills"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">
                {isZh ? "随时切换" : "Switch Anytime"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isZh ? "换话题或结束，完全自主" : "Change topic or end, fully flexible"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 dark:bg-gray-800/50">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">
                {isZh ? "专业分析" : "Expert Analysis"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isZh ? "问题来源和考核能力解析" : "Question origin and skill assessment"}
              </p>
            </div>
          </div>
        </div>

        {/* Bookmarks Link */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/bookmarks')}
          >
            <Bookmark className="h-4 w-4 mr-2" />
            {isZh ? '查看收藏的问题' : 'View Bookmarked Questions'}
          </Button>
        </div>

        {/* Tips */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            {isZh
              ? "💡 提示：练习中随时可以说「换话题」或「结束面试」"
              : "💡 Tip: Say \"switch topic\" or \"end interview\" anytime during practice"}
          </p>
        </div>
      </main>
    </div>
  );
}
