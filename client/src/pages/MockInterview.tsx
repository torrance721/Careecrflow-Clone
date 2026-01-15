import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Send, Loader2, Briefcase, MapPin, DollarSign, Building2, User, Bot } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { Streamdown } from "streamdown";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { HintButton } from "@/components/HintButton";
import { AIThinkingIndicator } from "@/components/AIThinkingIndicator";

export default function MockInterview() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ sessionId?: string; jobId?: string }>();
  const { t, language } = useLanguage();
  
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get session if sessionId is provided
  const sessionId = params.sessionId ? parseInt(params.sessionId) : undefined;
  const jobId = params.jobId ? parseInt(params.jobId) : undefined;

  const { data: sessionData, isLoading: sessionLoading, refetch: refetchSession } = trpc.mockInterview.getSession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId && isAuthenticated }
  );

  const createSessionMutation = trpc.mockInterview.createSession.useMutation({
    onSuccess: (data) => {
      navigate(`/mock-interview/${data.session.id}`);
    },
  });

  const sendMessageMutation = trpc.mockInterview.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetchSession();
    },
  });

  const endSessionMutation = trpc.mockInterview.endSession.useMutation({
    onSuccess: (data) => {
      navigate(`/assessment/${data.report?.id}`);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionData?.messages]);

  // Create session if jobId is provided but no sessionId
  useEffect(() => {
    if (jobId && !sessionId && isAuthenticated && !isCreating) {
      setIsCreating(true);
      createSessionMutation.mutate({ jobId, language });
    }
  }, [jobId, sessionId, isAuthenticated, isCreating, language]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <Card className="p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">{t('auth.loginRequired')}</h2>
          <p className="text-muted-foreground mb-6">
            {language === 'zh' ? '请登录以开始模拟面试' : 'Please login to start a mock interview'}
          </p>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  if (sessionLoading || createSessionMutation.isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">
          {language === 'zh' ? '正在准备您的模拟面试...' : 'Preparing your mock interview...'}
        </p>
      </div>
    );
  }

  const session = sessionData?.session;
  const messages = sessionData?.messages || [];
  const job = sessionData?.job;
  const isCompleted = session?.status === "completed";

  const handleSendMessage = () => {
    if (!message.trim() || !sessionId || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate({ sessionId, content: message, language });
  };

  const handleEndSession = () => {
    if (!sessionId || endSessionMutation.isPending) return;
    endSessionMutation.mutate({ sessionId, language });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">{t('interview.title')}</h1>
            {job && (
              <p className="text-sm text-muted-foreground">{job.position} @ {job.company}</p>
            )}
          </div>
          <LanguageSwitcher />
          {session && (
            <div className="text-sm text-muted-foreground">
              Q{session.currentQuestion}/{session.totalQuestions}
            </div>
          )}
        </div>
      </header>

      {/* Job Info Card */}
      {job && (
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Card className="p-4 bg-blue-50/50 border-blue-100">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="w-4 h-4" />
                <span>{job.position}</span>
              </div>
              {job.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{job.location}</span>
                </div>
              )}
              {job.salaryMin && job.salaryMax && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span>${Number(job.salaryMin).toLocaleString()} - ${Number(job.salaryMax).toLocaleString()}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl mx-auto px-4 py-4 space-y-4">
          {/* Welcome message */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-2">
              {language === 'zh' ? '欢迎参加模拟面试！' : 'Welcome to your Mock Interview!'}
            </p>
            <p>
              {language === 'zh' 
                ? '这是一次友好的对话，帮助您了解自己与这个职位的匹配度。您可以：'
                : 'This is a friendly conversation to help you understand your fit for this role. Feel free to:'}
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>{language === 'zh' ? '详细描述您的项目经历' : 'Share detailed descriptions of your projects'}</li>
              <li>{language === 'zh' ? '粘贴您的作品集或 GitHub 链接' : 'Paste links to your portfolio or GitHub'}</li>
              <li>{language === 'zh' ? '慢慢来，充分表达您的经验' : 'Take your time to articulate your experience'}</li>
            </ul>
          </div>

          {/* Chat messages */}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "user" ? "bg-primary text-white" : "bg-blue-100 text-blue-600"
              }`}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`flex-1 max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                <Card className={`p-4 inline-block text-left ${
                  msg.role === "user" ? "bg-primary text-white" : "bg-white"
                }`}>
                  <Streamdown>{msg.content}</Streamdown>
                </Card>
              </div>
            </div>
          ))}

          {/* AI Thinking Indicator */}
          {sendMessageMutation.isPending && (
            <AIThinkingIndicator
              isThinking={true}
              language={language as 'en' | 'zh'}
              showDetails={false}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t sticky bottom-0">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          {isCompleted ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                {language === 'zh' ? '面试已完成！' : 'Interview completed!'}
              </p>
              <Button onClick={handleEndSession} disabled={endSessionMutation.isPending}>
                {endSessionMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {language === 'zh' ? '正在生成报告...' : 'Generating Report...'}
                  </>
                ) : (
                  language === 'zh' ? '查看评估报告' : 'View Assessment Report'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={language === 'zh' 
                    ? '输入您的回答...（按 Enter 发送，Shift+Enter 换行）'
                    : 'Type your response... (Press Enter to send, Shift+Enter for new line)'}
                  className="min-h-[80px] resize-none"
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className="self-end"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <HintButton
                    sessionId={sessionId!}
                    currentQuestion={messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || ''}
                    userResponse={message}
                    language={language as 'en' | 'zh'}
                    disabled={sendMessageMutation.isPending || messages.length < 2}
                  />
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {language === 'zh' 
                      ? '卡住了？点击获取提示'
                      : 'Stuck? Click for a hint'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEndSession}
                  disabled={messages.length < 4 || endSessionMutation.isPending}
                >
                  {language === 'zh' ? '结束并获取报告' : 'End & Get Report'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
