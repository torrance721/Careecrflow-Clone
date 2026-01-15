import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2, Clock, Upload, FileText, X, Sparkles, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { TypingPlaceholder, CAREER_EXAMPLES, CAREER_EXAMPLES_ZH, TypingPlaceholderRef } from "@/components/TypingPlaceholder";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { InterviewThinkingCard } from "@/components/InterviewThinkingCard";

// Success case data
const SUCCESS_CASES = [
  { id: 1, title: "拿到 Google 数据分析师 Offer", titleEn: "Got Google Data Analyst Offer" },
  { id: 2, title: "成功转型产品经理", titleEn: "Successfully transitioned to PM" },
  { id: 3, title: "斩获 Amazon SDE Offer", titleEn: "Landed Amazon SDE Offer" },
  { id: 4, title: "入职字节跳动后端开发", titleEn: "Joined ByteDance as Backend Dev" },
];

type OnboardingStep = "goal" | "resume" | "situation" | "preparing";

interface KnowledgeBaseData {
  parsed?: {
    company: string | null;
    position: string;
  };
  knowledgeBase?: {
    id: number;
    questionCount: number;
  } | null;
  fromCache?: boolean;
  useGenericQuestions?: boolean;
}

export default function Onboarding() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isZh = language === "zh";

  // Step state
  const [step, setStep] = useState<OnboardingStep>("goal");
  
  // Goal input state
  const [goalInput, setGoalInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [currentTypingPhrase, setCurrentTypingPhrase] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<TypingPlaceholderRef>(null);
  
  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Situation state
  const [situation, setSituation] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  
  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Knowledge base state
  const [knowledgeBaseData, setKnowledgeBaseData] = useState<KnowledgeBaseData | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const careerExamples = isZh ? CAREER_EXAMPLES_ZH : CAREER_EXAMPLES;

  // Generate AI question mutation
  const generateQuestionMutation = trpc.onboarding.generateQuestion.useMutation({
    onSuccess: (data) => {
      const question = typeof data.question === 'string' ? data.question : '';
      setAiQuestion(question);
      setIsGeneratingQuestion(false);
    },
    onError: (error) => {
      console.error("Failed to generate question:", error);
      // Fallback question
      setAiQuestion(isZh 
        ? "好的！现在说说你的情况吧，越详细越好。比如你的教育/工作背景、目前求职进展、最担心什么问题？"
        : "Great! Now tell me about your situation in detail. For example, your education/work background, current job search progress, and what concerns you most?"
      );
      setIsGeneratingQuestion(false);
    },
  });

  // Start interview mutation (with knowledge base)
  const startInterviewMutation = trpc.onboarding.startInterviewWithKnowledge.useMutation({
    onSuccess: (data) => {
      toast.success(isZh ? "开始面试练习！" : "Starting interview practice!");
      navigate(`/mock-interview/${data.sessionId}`);
    },
    onError: (error) => {
      toast.error(error.message);
      setIsSubmitting(false);
      setIsPreparing(false);
      setStep("situation");
    },
  });

  // Handle input focus - fill with current typing phrase
  const handleInputFocus = () => {
    setIsFocused(true);
    // If input is empty and we have a current phrase, fill it
    if (!goalInput && currentTypingPhrase) {
      setGoalInput(currentTypingPhrase);
    }
  };

  // Handle goal submission - now navigates directly to interview mode selection
  const handleGoalSubmit = () => {
    if (!goalInput.trim()) {
      toast.error(isZh ? "请输入你的目标职位" : "Please enter your target position");
      return;
    }

    if (!isAuthenticated) {
      toast.error(isZh ? "请先登录" : "Please log in first");
      window.location.href = getLoginUrl();
      return;
    }

    // Navigate directly to new interview mode selection page
    navigate(`/interview-mode?position=${encodeURIComponent(goalInput)}`);
  };

  // Parse resume mutation
  const parseResumeMutation = trpc.onboarding.parseResume.useMutation({
    onSuccess: (data) => {
      if (data.success && data.text) {
        setResumeText(data.text);
        toast.success(isZh 
          ? `简历解析成功！提取了 ${data.metadata?.wordCount || 0} 个字`
          : `Resume parsed! Extracted ${data.metadata?.wordCount || 0} words`);
      } else {
        toast.error(data.error || (isZh ? "简历解析失败" : "Failed to parse resume"));
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handle resume upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResumeFile(file);
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(isZh ? "文件大小不能超过 5MB" : "File size cannot exceed 5MB");
        return;
      }
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // Parse the resume
        parseResumeMutation.mutate({
          fileData: base64,
          mimeType: file.type,
          filename: file.name,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle resume step completion
  const handleResumeNext = (hasResume: boolean) => {
    setStep("situation");
    setIsGeneratingQuestion(true);
    
    // Generate AI question based on goal and resume
    generateQuestionMutation.mutate({
      dreamJob: goalInput,
      resumeText: hasResume ? resumeText : "",
      language: language,
    });
  };

  // Handle knowledge base preparation complete
  const handleKnowledgeBaseComplete = (data: Record<string, unknown>) => {
    console.log('[Onboarding] Knowledge base ready:', data);
    setKnowledgeBaseData(data as KnowledgeBaseData);
    
    // Now start the interview with the knowledge base
    setIsSubmitting(true);
    startInterviewMutation.mutate({
      dreamJob: goalInput,
      resumeText: resumeText,
      situation: situation,
      language: language,
      knowledgeBaseId: (data as KnowledgeBaseData).knowledgeBase?.id,
      parsedCompany: (data as KnowledgeBaseData).parsed?.company || undefined,
      parsedPosition: (data as KnowledgeBaseData).parsed?.position,
    });
  };

  // Handle knowledge base preparation error
  const handleKnowledgeBaseError = (error: string) => {
    console.error('[Onboarding] Knowledge base error:', error);
    toast.error(isZh 
      ? `准备面试时出错: ${error}。将使用通用问题。`
      : `Error preparing interview: ${error}. Using generic questions.`
    );
    
    // Fall back to starting interview without knowledge base
    setIsSubmitting(true);
    startInterviewMutation.mutate({
      dreamJob: goalInput,
      resumeText: resumeText,
      situation: situation,
      language: language,
    });
  };

  // Handle final submission - now shows ThinkingCard
  const handleStartInterview = (skipSituation: boolean = false) => {
    if (!skipSituation && !situation.trim()) {
      toast.error(isZh ? "请描述一下你的情况" : "Please describe your situation");
      return;
    }

    // Store situation if skipped
    if (skipSituation) {
      setSituation("");
    }
    
    // Move to preparing step with ThinkingCard
    setIsPreparing(true);
    setStep("preparing");
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGoalSubmit();
    }
  };

  // Handle success case click
  const handleSuccessCaseClick = (caseItem: typeof SUCCESS_CASES[0]) => {
    // Extract job title from success case
    const jobTitle = isZh 
      ? caseItem.title.replace(/拿到|斩获|入职|成功转型/, "").replace(/Offer/, "").trim()
      : caseItem.titleEn.replace(/Got|Landed|Joined|Successfully transitioned to/, "").replace(/Offer/, "").trim();
    
    setGoalInput(jobTitle);
    inputRef.current?.focus();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
      {/* Tech background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Circuit lines - top right */}
        <svg className="absolute top-0 right-0 w-96 h-64 text-primary/10" viewBox="0 0 400 200">
          <path d="M400 20 H300 L280 40 H200" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M400 50 H320 L300 70 H250" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M400 80 H340 L320 100 H280" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="200" cy="40" r="4" fill="currentColor" />
          <circle cx="250" cy="70" r="4" fill="currentColor" />
          <circle cx="280" cy="100" r="4" fill="currentColor" />
        </svg>
        {/* Circuit lines - bottom left */}
        <svg className="absolute bottom-0 left-0 w-96 h-64 text-primary/10" viewBox="0 0 400 200">
          <path d="M0 180 H100 L120 160 H200" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M0 150 H80 L100 130 H150" stroke="currentColor" strokeWidth="2" fill="none" />
          <circle cx="200" cy="160" r="4" fill="currentColor" />
          <circle cx="150" cy="130" r="4" fill="currentColor" />
        </svg>
        {/* Floating dots */}
        <div className="absolute top-20 left-20 w-2 h-2 rounded-full bg-primary/20 animate-pulse" />
        <div className="absolute top-40 left-40 w-3 h-3 rounded-full bg-primary/15 animate-pulse delay-300" />
        <div className="absolute bottom-40 right-40 w-2 h-2 rounded-full bg-primary/20 animate-pulse delay-500" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-border/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            {/* UHired Logo */}
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-foreground">UHired</span>
              <span className="text-xs text-muted-foreground ml-2">AI 求职助手</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <span className="text-sm text-muted-foreground">
                {user?.name || user?.email}
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => window.location.href = getLoginUrl()}>
                {isZh ? "登录" : "Log in"}
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 container py-8 md:py-16">
        {step === "goal" && (
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            {/* Title - visually connected to input */}
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
              {isZh ? "我想成为" : "I want to become"}
            </h1>
            
            {/* Subtitle */}
            <p className="text-base text-muted-foreground mb-8">
              {isZh ? "帮你获得梦想的职位" : "Help you land your dream job"}
            </p>

            {/* Input Box with typing placeholder inside */}
            <div className="w-full max-w-2xl mx-auto mb-12">
              <div className={`flex items-center bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-300 ${
                isFocused ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'
              }`}>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleInputFocus}
                    onBlur={() => setIsFocused(false)}
                    className="w-full bg-transparent px-5 py-4 text-lg outline-none text-primary font-medium"
                    placeholder=""
                  />
                  {/* Typing placeholder - only show when input is empty and not focused */}
                  {!goalInput && !isFocused && (
                    <div className="absolute inset-0 flex items-center px-5 pointer-events-none">
                      <TypingPlaceholder
                        ref={typingRef}
                        phrases={careerExamples}
                        typingSpeed={60}
                        deletingSpeed={30}
                        pauseDuration={1500}
                        className="text-lg text-primary/60"
                        onPhraseChange={setCurrentTypingPhrase}
                      />
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleGoalSubmit}
                  disabled={!goalInput.trim()}
                  className="mr-2 h-10 px-6 rounded-lg bg-primary text-white hover:bg-primary/90 gap-2"
                >
                  <span>{isZh ? "开始" : "Start"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              {/* Hint text */}
              <p className="text-xs text-muted-foreground mt-2">
                {isZh ? "点击输入框即可编辑，按回车开始" : "Click to edit, press Enter to start"}
              </p>
            </div>

            {/* Success Cases */}
            <div className="w-full max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-4 justify-center">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-medium text-muted-foreground">
                  {isZh ? "成功案例" : "Success Stories"}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SUCCESS_CASES.map((caseItem) => (
                  <button
                    key={caseItem.id}
                    onClick={() => handleSuccessCaseClick(caseItem)}
                    className="group text-left p-5 bg-white dark:bg-gray-800 rounded-xl border-2 border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {isZh ? caseItem.title : caseItem.titleEn}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isZh ? "今天" : "Today"}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "resume" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            {/* AI Message */}
            <div className="flex gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none p-5 shadow-sm">
                <p className="text-foreground">
                  {isZh 
                    ? `太棒了！想成为 **${goalInput}**。先让我了解一下你的背景，你有简历吗？`
                    : `Great! You want to become a **${goalInput}**. Let me learn about your background first. Do you have a resume?`
                  }
                </p>
              </div>
            </div>

            {/* Resume Upload Options */}
            <div className="space-y-4">
              {/* Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {resumeFile ? (
                <Card className="p-4 border-2 border-primary/50 bg-primary/5">
                  <div className="flex items-center gap-3">
                    {parseResumeMutation.isPending ? (
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    ) : (
                      <FileText className="h-8 w-8 text-primary" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{resumeFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {parseResumeMutation.isPending 
                          ? (isZh ? "正在解析..." : "Parsing...")
                          : resumeText 
                            ? (isZh ? `已提取 ${resumeText.length} 个字符` : `Extracted ${resumeText.length} characters`)
                            : `${(resumeFile.size / 1024).toFixed(1)} KB`
                        }
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setResumeFile(null);
                        setResumeText("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Show preview of parsed text */}
                  {resumeText && (
                    <div className="mt-3 pt-3 border-t border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">
                        {isZh ? "简历预览" : "Resume Preview"}
                      </p>
                      <p className="text-sm text-foreground/80 line-clamp-3">
                        {resumeText.slice(0, 200)}...
                      </p>
                    </div>
                  )}
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 border-2 border-dashed hover:border-primary hover:bg-primary/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {isZh ? "点击上传简历 (PDF, DOC, DOCX)" : "Click to upload resume (PDF, DOC, DOCX)"}
                    </span>
                  </div>
                </Button>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleResumeNext(false)}
                >
                  {isZh ? "暂时没有，直接开始" : "Skip for now"}
                </Button>
                {resumeFile && (
                  <Button
                    className="flex-1"
                    onClick={() => handleResumeNext(true)}
                  >
                    {isZh ? "继续" : "Continue"}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "situation" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            {/* AI Message */}
            <div className="flex gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none p-5 shadow-sm">
                {isGeneratingQuestion ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">
                      {isZh ? "正在思考问题..." : "Thinking of a question..."}
                    </span>
                  </div>
                ) : (
                  <p className="text-foreground whitespace-pre-wrap">{aiQuestion}</p>
                )}
              </div>
            </div>

            {/* User Input */}
            {!isGeneratingQuestion && (
              <div className="space-y-4">
                <Textarea
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  placeholder={isZh 
                    ? "我是计算机专业的应届生，投了很多数据分析岗位..."
                    : "I'm a CS graduate, applied to many data analyst positions..."
                  }
                  className="min-h-[150px] text-base resize-none"
                />
                
                {/* Action Buttons - with skip option */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => handleStartInterview(true)}
                    disabled={isSubmitting}
                    className="flex-shrink-0"
                  >
                    {isZh ? "跳过，直接开始" : "Skip, start now"}
                  </Button>
                  <Button
                    onClick={() => handleStartInterview(false)}
                    disabled={!situation.trim() || isSubmitting}
                    className="flex-1 h-12"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {isZh ? "正在准备..." : "Preparing..."}
                      </>
                    ) : (
                      <>
                        {isZh ? "开始面试练习" : "Start Interview Practice"}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preparing" && (
          <div className="max-w-2xl mx-auto animate-fade-in">
            {/* AI Message */}
            <div className="flex gap-4 mb-8">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none p-5 shadow-sm">
                <p className="text-foreground">
                  {isZh 
                    ? `正在为你准备 **${goalInput}** 的面试练习...`
                    : `Preparing interview practice for **${goalInput}**...`
                  }
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {isZh 
                    ? "我正在收集真实的面试问题和公司信息，这可能需要一点时间。"
                    : "I'm gathering real interview questions and company information. This may take a moment."
                  }
                </p>
              </div>
            </div>

            {/* ThinkingCard */}
            <InterviewThinkingCard
              dreamJob={goalInput}
              onComplete={handleKnowledgeBaseComplete}
              onError={handleKnowledgeBaseError}
              className="mb-4"
            />

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center">
              {isZh 
                ? "点击卡片右侧箭头查看详细进度"
                : "Click the arrow on the right to see detailed progress"
              }
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-muted-foreground">
        {isZh 
          ? "AI 将根据你的目标职位和背景，生成针对性的面试问题"
          : "AI will generate targeted interview questions based on your target position and background"
        }
      </footer>

      {/* CSS for animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
