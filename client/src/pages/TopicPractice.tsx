/**
 * 话题练习页面
 * 
 * 核心设计：
 * 1. 信息点驱动而非轮次驱动
 * 2. 非阻塞设计：用户随时可换话题或结束
 * 3. 调用真实后端 API 进行 LLM 对话
 * 4. 集成 ReActViewer 展示 AI 思维链
 */

import { useState, useRef, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Target, 
  Building2,
  CheckCircle,
  XCircle,
  Lightbulb,
  RefreshCw,
  Brain,
  Upload,
  FileText,
  X,
  Clock,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { ReActStatus } from '@/components/ReActViewer';
import type { StreamingStep, AgentInfo } from '@/components/ReActViewer';
import { useTopicPracticeStream } from '@/hooks/useTopicPracticeStream';
import { useFollowupStream } from '@/hooks/useStreamingResponse';
import { useOptimizedFollowup } from '@/hooks/useOptimizedFollowup';
import { StreamingText } from '@/components/TypewriterCursor';
import { Streamdown } from 'streamdown';
import { TopicDepthIndicator, calculateDepthLevel } from '@/components/TopicDepthIndicator';
import { Bookmark, BookmarkCheck } from 'lucide-react';

// 收藏按钮组件
function BookmarkButton({
  topic,
  question,
  difficulty,
  targetPosition,
  isZh
}: {
  topic: string;
  question: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  targetPosition: string;
  isZh: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: isBookmarked, isLoading: checkingBookmark } = trpc.bookmarks.isBookmarked.useQuery(
    { topic, question },
    { enabled: !!topic && !!question }
  );
  
  const addBookmark = trpc.bookmarks.add.useMutation({
    onSuccess: () => {
      utils.bookmarks.isBookmarked.invalidate({ topic, question });
      toast.success(isZh ? '已收藏' : 'Bookmarked');
    },
    onError: () => {
      toast.error(isZh ? '收藏失败' : 'Failed to bookmark');
    }
  });
  
  const handleBookmark = () => {
    if (isBookmarked) return;
    addBookmark.mutate({
      topic,
      question,
      difficulty,
      targetPosition,
    });
  };
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleBookmark}
      disabled={checkingBookmark || addBookmark.isPending || isBookmarked}
      title={isBookmarked ? (isZh ? '已收藏' : 'Bookmarked') : (isZh ? '收藏这个问题' : 'Bookmark this question')}
    >
      {isBookmarked ? (
        <BookmarkCheck className="h-4 w-4 text-primary" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </Button>
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface TopicFeedback {
  topicId: string;
  questionSource: {
    company?: string;
    description: string;
    frequency?: 'high' | 'medium' | 'low';
  };
  targetAbility: {
    primary: string;
    secondary: string[];
    rationale: string;
  };
  performanceAnalysis: {
    strengths: string[];
    gaps: string[];
    details: string;
  };
  improvementSuggestions: {
    immediate: string[];
    longTerm: string[];
    resources?: string[];
  };
  score: number;
}

interface CompanyMatch {
  company: string;
  jobTitle?: string;
  linkedinUrl?: string;
  matchScore: number;
  reasons: string[];
  keySkills: string[];
  preparationTips: string[];
}

type ViewState = 'start' | 'resume' | 'chat' | 'feedback';

// AI 思考状态类型
type AIThinkingPhase = 'idle' | 'understanding' | 'analyzing' | 'generating' | 'complete';

export default function TopicPractice() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isZh = language === 'zh';

  // Parse URL params
  const params = new URLSearchParams(search);
  const initialPosition = params.get('position') || '';

  // Session state
  const [targetPosition, setTargetPosition] = useState(initialPosition);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string>('');
  const [currentDifficulty, setCurrentDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [showPaywall, setShowPaywall] = useState(false);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<TopicFeedback[]>([]);
  const [companyMatches, setCompanyMatches] = useState<CompanyMatch[]>([]);
  const [overallSummary, setOverallSummary] = useState<string>('');
  const [isEnded, setIsEnded] = useState(false);
  
  // Interview duration tracking
  const [interviewStartTime, setInterviewStartTime] = useState<Date | null>(null);
  const [interviewDuration, setInterviewDuration] = useState<number>(0); // in seconds
  
  // View state
  const [viewState, setViewState] = useState<ViewState>(initialPosition ? 'start' : 'start');
  
  // AI 思考状态
  const [aiThinkingPhase, setAiThinkingPhase] = useState<AIThinkingPhase>('idle');
  const [currentStep, setCurrentStep] = useState<StreamingStep | undefined>(undefined);
  
  // SSE 流式思维链
  const { isStreaming, steps, agent, startStream, clearSteps } = useTopicPracticeStream();
  
  // 流式响应
  const { streamingContent, isStreaming: isStreamingResponse, streamFollowup, reset: resetStream } = useFollowupStream();
  const [collectedInfo, setCollectedInfo] = useState<Array<{ type: string; summary: string; depth: number }>>([]);
  
  // 优化的追问（方案 A）
  const { 
    isEvaluating, 
    isStreaming: isOptimizedStreaming, 
    streamingContent: optimizedStreamingContent,
    statusResult,
    startOptimizedFollowup,
    reset: resetOptimized
  } = useOptimizedFollowup();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [isParsingResume, setIsParsingResume] = useState(false);

  // tRPC mutations
  const startSession = trpc.topicPractice.startSession.useMutation();
  const parseResumeMutation = trpc.onboarding.parseResume.useMutation({
    onSuccess: (data) => {
      setIsParsingResume(false);
      if (data.success && data.text) {
        setResumeText(data.text);
        toast.success(isZh 
          ? `简历解析成功！提取了 ${data.metadata?.wordCount || 0} 个字`
          : `Resume parsed! Extracted ${data.metadata?.wordCount || 0} words`);
      } else {
        toast.error(data.error || (isZh ? '简历解析失败' : 'Failed to parse resume'));
      }
    },
    onError: (error) => {
      setIsParsingResume(false);
      toast.error(isZh ? '简历解析出错' : 'Error parsing resume');
    },
  });
  const sendMessage = trpc.topicPractice.sendMessage.useMutation();
  const endSession = trpc.topicPractice.endSession.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after loading
  useEffect(() => {
    if (!isLoading && inputRef.current && viewState === 'chat') {
      inputRef.current.focus();
    }
  }, [isLoading, viewState]);

  // Auto-start if position provided - now goes to resume step first
  useEffect(() => {
    if (initialPosition && !sessionId && viewState === 'start') {
      // Go to resume step instead of starting directly
      setViewState('resume');
    }
  }, [initialPosition]);

  // Handle resume file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!validTypes.includes(file.type)) {
        toast.error(isZh ? '请上传 PDF 或 Word 文档' : 'Please upload PDF or Word document');
        return;
      }
      
      setResumeFile(file);
      setIsParsingResume(true);
      
      // Read file as base64
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

  // Handle proceeding from resume step
  const handleResumeNext = (withResume: boolean) => {
    // Start the actual session with resume context
    handleStartSessionWithResume(withResume ? resumeText : '');
  };

  // Remove uploaded resume
  const handleRemoveResume = () => {
    setResumeFile(null);
    setResumeText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 模拟 AI 思考过程
  const simulateAIThinking = async (phase: 'start' | 'message' | 'end') => {
    const phases: { phase: AIThinkingPhase; tool: string; displayName: string; duration: number }[] = 
      phase === 'start' ? [
        { phase: 'understanding', tool: 'analyze_position', displayName: isZh ? '分析目标职位' : 'Analyzing target position', duration: 800 },
        { phase: 'analyzing', tool: 'select_topic', displayName: isZh ? '选择面试话题' : 'Selecting interview topic', duration: 600 },
        { phase: 'generating', tool: 'generate_question', displayName: isZh ? '生成开场问题' : 'Generating opening question', duration: 700 },
      ] : phase === 'message' ? [
        { phase: 'understanding', tool: 'detect_intent', displayName: isZh ? '理解用户意图' : 'Understanding user intent', duration: 500 },
        { phase: 'analyzing', tool: 'evaluate_response', displayName: isZh ? '评估回答质量' : 'Evaluating response quality', duration: 600 },
        { phase: 'generating', tool: 'generate_followup', displayName: isZh ? '生成追问' : 'Generating follow-up', duration: 700 },
      ] : [
        // 结束面试时显示更详细的步骤，总时长约 20 秒
        { phase: 'analyzing', tool: 'collect_responses', displayName: isZh ? '整理对话内容' : 'Collecting conversation data', duration: 2000 },
        { phase: 'analyzing', tool: 'analyze_performance', displayName: isZh ? '分析整体表现' : 'Analyzing overall performance', duration: 3000 },
        { phase: 'generating', tool: 'evaluate_skills', displayName: isZh ? '评估技能展示' : 'Evaluating demonstrated skills', duration: 3000 },
        { phase: 'generating', tool: 'generate_feedback', displayName: isZh ? '生成详细反馈' : 'Generating detailed feedback', duration: 4000 },
        { phase: 'generating', tool: 'search_jobs', displayName: isZh ? '搜索匹配职位' : 'Searching matching positions', duration: 4000 },
        { phase: 'generating', tool: 'match_companies', displayName: isZh ? '匹配推荐公司' : 'Matching recommended companies', duration: 3000 },
        { phase: 'generating', tool: 'compile_report', displayName: isZh ? '整合最终报告' : 'Compiling final report', duration: 2000 },
      ];

    for (const p of phases) {
      setAiThinkingPhase(p.phase);
      setCurrentStep({
        id: `step-${Date.now()}`,
        step: phases.indexOf(p) + 1,
        status: 'running',
        thought: p.displayName,
        action: {
          tool: p.tool,
          toolDisplayName: p.displayName,
          params: {},
        },
        startTime: Date.now(),
      });
      await new Promise(resolve => setTimeout(resolve, p.duration));
    }
    
    setAiThinkingPhase('complete');
    setCurrentStep(undefined);
  };

  // Start session - called from start page (without resume step)
  const handleStartSession = async () => {
    if (!targetPosition.trim()) return;
    // Go to resume step first
    setViewState('resume');
  };

  // Start session with resume context
  const handleStartSessionWithResume = async (resumeContent: string) => {
    if (!targetPosition.trim()) return;
    
    setIsLoading(true);
    setAiThinkingPhase('understanding');
    
    // 启动 SSE 流式思维链
    clearSteps();
    startStream('start', { targetPosition });
    
    try {
      // 模拟 AI 思考（与 SSE 并行）
      const thinkingPromise = simulateAIThinking('start');
      const resultPromise = startSession.mutateAsync({ 
        targetPosition,
        resumeText: resumeContent 
      });
      
      const [, result] = await Promise.all([thinkingPromise, resultPromise]);
      
      setSessionId(result.sessionId);
      setCurrentTopic(result.topic.name);
      // Normalize difficulty to capitalized form
      const normalizedDifficulty = (result.topic.difficulty || 'medium').toLowerCase();
      const difficultyMap: Record<string, 'Easy' | 'Medium' | 'Hard'> = {
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard'
      };
      setCurrentDifficulty(difficultyMap[normalizedDifficulty] || 'Medium');
      setMessages([{
        role: 'assistant',
        content: result.openingMessage,
        timestamp: new Date().toISOString()
      }]);
      setViewState('chat');
      setInterviewStartTime(new Date()); // 记录面试开始时间
    } catch (error) {
      console.error('Failed to start session:', error);
      toast.error(isZh ? '启动会话失败' : 'Failed to start session');
    } finally {
      setIsLoading(false);
      setAiThinkingPhase('idle');
    }
  };

  // Send message - 使用优化的追问流程（方案 A）
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId || isLoading) return;
    
    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);
    
    setIsLoading(true);
    setAiThinkingPhase('understanding');
    resetOptimized();
    
    // 启动 SSE 流式思维链
    clearSteps();
    startStream('message', { sessionId, message: userMessage });
    
    try {
      // 启动优化的追问流程（快速状态评估 + 流式追问）- 目标 ≤5秒
      const topicContext = {
        id: sessionId,
        name: currentTopic,
        status: 'collecting' as const,
        startedAt: new Date().toISOString(),
        messages: messages.map(m => ({ ...m, timestamp: m.timestamp || new Date().toISOString() })),
        collectedInfo: collectedInfo.map(info => ({ ...info, needsFollowUp: true })),
        targetSkills: []
      };
      
      // 只使用优化追问端点，不等待后端完整处理
      // 后端处理在后台异步执行，用于持久化数据
      sendMessage.mutate({
        sessionId,
        message: userMessage
      }, {
        onSuccess: (result) => {
          // 后台更新信息收集点
          if (result.collectedInfo) {
            setCollectedInfo(result.collectedInfo);
          }
          // 处理特殊意图
          if (result.userIntent === 'end_interview') {
            handleEndSession();
          }
          if (result.userIntent === 'switch_topic' && result.feedback) {
            setFeedbacks(prev => [...prev, result.feedback!]);
            setViewState('feedback');
          }
          if (result.feedback) {
            setFeedbacks(prev => [...prev, result.feedback!]);
          }
        }
      });
      
      // 等待优化追问完成（目标 ≤5秒）
      const { content: streamedResponse, intent } = await startOptimizedFollowup({
        userMessage,
        topicContext,
        targetPosition,
        resumeText
      });
      
      // 处理特殊意图
      if (intent) {
        console.log('[TopicPractice] Detected intent:', intent);
        
        // switch_topic, end_interview, need_hint 由后端 sendMessage 处理
        // want_easier, want_harder, want_specific 已经在 optimized-followup 中处理并返回新问题
        if (intent === 'switch_topic') {
          // 换话题由后端处理，但仍需添加响应消息
          if (streamedResponse) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: streamedResponse,
              timestamp: new Date().toISOString()
            }]);
          }
          return;
        }
        if (intent === 'end_interview') {
          // 结束面试由后端处理，但仍需添加响应消息
          if (streamedResponse) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: streamedResponse,
              timestamp: new Date().toISOString()
            }]);
          }
          return;
        }
        if (intent === 'need_hint') {
          // 需要提示，触发提示按钮
          if (streamedResponse) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: streamedResponse,
              timestamp: new Date().toISOString()
            }]);
          }
          return;
        }
      }
      
      // 更新信息收集点（用于深度指示器）
      if (statusResult?.newInfoPoints && statusResult.newInfoPoints.length > 0) {
        setCollectedInfo(prev => [...prev, ...statusResult.newInfoPoints]);
      }
      
      // Add AI response from optimized followup
      if (streamedResponse) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: streamedResponse,
          timestamp: new Date().toISOString()
        }]);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isZh ? '抱歉，发生了一些错误。请重试。' : 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
      setAiThinkingPhase('idle');
      resetStream();
    }
  };

  // End session
  const handleEndSession = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setAiThinkingPhase('analyzing');
    
    // 启动 SSE 流式思维链
    clearSteps();
    startStream('end', { sessionId });
    
    try {
      // 模拟 AI 思考（与 SSE 并行）
      const thinkingPromise = simulateAIThinking('end');
      const resultPromise = endSession.mutateAsync({ sessionId });
      
      const [, result] = await Promise.all([thinkingPromise, resultPromise]);
      
      setFeedbacks(result.feedbacks);
      setCompanyMatches(result.companyMatches);
      setOverallSummary(result.overallSummary);
      setIsEnded(true);
      
      // 计算面试时长
      if (interviewStartTime) {
        const durationSeconds = Math.floor((new Date().getTime() - interviewStartTime.getTime()) / 1000);
        setInterviewDuration(durationSeconds);
      }
      
      setViewState('feedback');
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      setIsLoading(false);
      setAiThinkingPhase('idle');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (sessionId) {
        handleSendMessage();
      } else {
        handleStartSession();
      }
    }
  };

  // Continue practice after feedback
  const handleContinuePractice = () => {
    setViewState('chat');
  };

  // Reset and start new session
  const handleReset = () => {
    setSessionId(null);
    setMessages([]);
    setFeedbacks([]);
    setCompanyMatches([]);
    setOverallSummary('');
    setIsEnded(false);
    setViewState('start');
  };

  // 获取当前 Agent 信息
  const getAgentInfo = (): AgentInfo => ({
    name: 'topic_practice',
    displayName: isZh ? '话题练习' : 'Topic Practice',
    description: isZh ? '分析你的回答并生成追问...' : 'Analyzing your response and generating follow-up...',
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Start screen
  if (viewState === 'start' && !sessionId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl py-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/interview-mode')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isZh ? '返回' : 'Back'}
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                {isZh ? '话题练习' : 'Topic Practice'}
              </CardTitle>
              <CardDescription>
                {isZh 
                  ? '输入你的目标职位，开始一个话题的深度练习' 
                  : 'Enter your target position to start a deep practice session'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {isZh ? '目标职位' : 'Target Position'}
                </label>
                <Input
                  placeholder={isZh ? '例如：Software Engineer at Google' : 'e.g., Software Engineer at Google'}
                  value={targetPosition}
                  onChange={(e) => setTargetPosition(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <Button 
                onClick={handleStartSession} 
                disabled={!targetPosition.trim() || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isZh ? '准备中...' : 'Preparing...'}
                  </>
                ) : (
                  isZh ? '开始练习' : 'Start Practice'
                )}
              </Button>
              
              {/* AI 思考状态显示 */}
              {isLoading && aiThinkingPhase !== 'idle' && (
                <div className="mt-4">
                  <ReActStatus
                    agent={getAgentInfo()}
                    currentStep={currentStep}
                    isRunning={true}
                    language={language as 'en' | 'zh'}
                  />
                </div>
              )}
              
              <div className="text-sm text-muted-foreground space-y-1 pt-4">
                <p className="font-medium">{isZh ? '提示：' : 'Tips:'}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    {isZh ? '随时可以说' : 'Say'} <Badge variant="outline">{isZh ? '"换话题"' : '"switch topic"'}</Badge> {isZh ? '切换到新话题' : 'to change topics'}
                  </li>
                  <li>
                    {isZh ? '随时可以说' : 'Say'} <Badge variant="outline">{isZh ? '"结束面试"' : '"end interview"'}</Badge> {isZh ? '获取完整评估' : 'to get full assessment'}
                  </li>
                  <li>
                    {isZh ? '如果卡住了，可以说' : 'If stuck, say'} <Badge variant="outline">{isZh ? '"给我提示"' : '"give me a hint"'}</Badge>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Resume upload screen
  if (viewState === 'resume') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl py-8">
          <Button
            variant="ghost"
            onClick={() => setViewState('start')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isZh ? '返回' : 'Back'}
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {isZh ? '上传简历（可选）' : 'Upload Resume (Optional)'}
              </CardTitle>
              <CardDescription>
                {isZh 
                  ? `目标职位：${targetPosition}。上传简历可以让面试问题更有针对性。` 
                  : `Target: ${targetPosition}. Upload your resume for more targeted interview questions.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {resumeFile ? (
                <Card className="p-4 border-2 border-primary/50 bg-primary/5">
                  <div className="flex items-center gap-3">
                    {isParsingResume ? (
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    ) : (
                      <FileText className="h-8 w-8 text-primary" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{resumeFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {isParsingResume 
                          ? (isZh ? '正在解析...' : 'Parsing...')
                          : resumeText 
                            ? (isZh ? `已提取 ${resumeText.length} 个字符` : `Extracted ${resumeText.length} characters`)
                            : `${(resumeFile.size / 1024).toFixed(1)} KB`
                        }
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveResume}
                      disabled={isParsingResume}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Show preview of parsed text */}
                  {resumeText && (
                    <div className="mt-3 pt-3 border-t border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">
                        {isZh ? '简历预览' : 'Resume Preview'}
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
                  className="w-full h-32 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {isZh ? '点击上传简历 (PDF, DOC, DOCX)' : 'Click to upload resume (PDF, DOC, DOCX)'}
                    </span>
                  </div>
                </Button>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleResumeNext(false)}
                  disabled={isLoading}
                >
                  {isZh ? '跳过，直接开始' : 'Skip, Start Now'}
                </Button>
                {resumeFile && resumeText && (
                  <Button
                    className="flex-1"
                    onClick={() => handleResumeNext(true)}
                    disabled={isLoading || isParsingResume}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isZh ? '准备中...' : 'Preparing...'}
                      </>
                    ) : (
                      isZh ? '使用简历开始' : 'Start with Resume'
                    )}
                  </Button>
                )}
              </div>

              {/* AI 思考状态显示 */}
              {isLoading && aiThinkingPhase !== 'idle' && (
                <div className="mt-4">
                  <ReActStatus
                    agent={getAgentInfo()}
                    currentStep={currentStep}
                    isRunning={true}
                    language={language as 'en' | 'zh'}
                  />
                </div>
              )}

              {/* Tips */}
              <div className="text-sm text-muted-foreground space-y-2 pt-4 border-t">
                <p className="font-medium">{isZh ? '为什么上传简历？' : 'Why upload resume?'}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    {isZh ? '面试问题会根据你的项目经验定制' : 'Interview questions will be tailored to your project experience'}
                  </li>
                  <li>
                    {isZh ? '可以更好地展示你的技术优势' : 'Better showcase your technical strengths'}
                  </li>
                  <li>
                    {isZh ? '获得更有针对性的反馈和建议' : 'Get more targeted feedback and suggestions'}
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Feedback screen
  if (viewState === 'feedback') {
    const latestFeedback = feedbacks[feedbacks.length - 1];
    
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-3xl py-8">
          <Button
            variant="ghost"
            onClick={() => {
              if (isEnded) {
                navigate('/mock-interviews');
              } else {
                handleContinuePractice();
              }
            }}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isEnded ? (isZh ? '返回 Mock Interviews' : 'Back to Mock Interviews') : (isZh ? '继续面试' : 'Continue Interview')}
          </Button>

          <div className="space-y-6">
            {/* Overall Summary */}
            {isEnded && overallSummary && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{isZh ? '整体评估' : 'Overall Assessment'}</CardTitle>
                    {interviewDuration > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {Math.floor(interviewDuration / 60)}{isZh ? '分' : 'm'} {interviewDuration % 60}{isZh ? '秒' : 's'}
                        </span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{overallSummary}</p>
                </CardContent>
              </Card>
            )}

            {/* Latest Feedback */}
            {latestFeedback && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{isZh ? '话题反馈' : 'Topic Feedback'}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{latestFeedback.score}/10</span>
                    </div>
                  </div>
                  <CardDescription>
                    {latestFeedback.questionSource.description}
                    {latestFeedback.questionSource.frequency && (
                      <Badge variant="outline" className="ml-2">
                        {latestFeedback.questionSource.frequency === 'high' ? (isZh ? '高频' : 'High Freq') : 
                         latestFeedback.questionSource.frequency === 'medium' ? (isZh ? '中频' : 'Med Freq') : (isZh ? '低频' : 'Low Freq')}
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={latestFeedback.score * 10} className="h-2" />
                  
                  {/* Target Ability */}
                  <div>
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4" />
                      {isZh ? '考核能力' : 'Target Abilities'}
                    </h4>
                    <p className="text-sm text-muted-foreground">{latestFeedback.targetAbility.rationale}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge>{latestFeedback.targetAbility.primary}</Badge>
                      {latestFeedback.targetAbility.secondary.map((ability, i) => (
                        <Badge key={i} variant="outline">{ability}</Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Performance Analysis */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        {isZh ? '做得好的地方' : 'Strengths'}
                      </h4>
                      <ul className="text-sm space-y-1">
                        {latestFeedback.performanceAnalysis.strengths.map((s, i) => (
                          <li key={i} className="text-muted-foreground">• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium flex items-center gap-2 mb-2 text-orange-600">
                        <XCircle className="h-4 w-4" />
                        {isZh ? '可以改进的地方' : 'Areas for Improvement'}
                      </h4>
                      <ul className="text-sm space-y-1">
                        {latestFeedback.performanceAnalysis.gaps.map((g, i) => (
                          <li key={i} className="text-muted-foreground">• {g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Separator />

                  {/* Improvement Suggestions */}
                  <div>
                    <h4 className="font-medium mb-2">{isZh ? '改进建议' : 'Improvement Suggestions'}</h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-blue-600">{isZh ? '立即可做：' : 'Quick Wins:'}</p>
                        <ul className="text-sm text-muted-foreground">
                          {latestFeedback.improvementSuggestions.immediate.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-600">{isZh ? '长期提升：' : 'Long-term Growth:'}</p>
                        <ul className="text-sm text-muted-foreground">
                          {latestFeedback.improvementSuggestions.longTerm.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Matches with Paywall */}
            {isEnded && companyMatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {isZh ? '推荐公司' : 'Recommended Companies'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {/* 模糊处理的公司列表 */}
                    <div className="space-y-4 blur-md pointer-events-none">
                      {companyMatches.map((match, index) => (
                        <div 
                          key={index} 
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{match.company}</h4>
                              {match.jobTitle && (
                                <p className="text-sm text-muted-foreground">{match.jobTitle}</p>
                              )}
                            </div>
                            <Badge variant="secondary">{match.matchScore}% {isZh ? '匹配' : 'Match'}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {match.reasons.join(' ')}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {match.keySkills.map((skill, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 覆盖层和解锁按钮 */}
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                          <Lock className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-1">
                            {isZh ? '解锁精准推荐' : 'Unlock Precise Recommendations'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {isZh ? '订阅后查看匹配度最高的公司和职位' : 'Subscribe to view top matching companies and positions'}
                          </p>
                        </div>
                        <Button 
                          onClick={() => setShowPaywall(true)}
                          size="lg"
                          className="bg-primary hover:bg-primary/90"
                        >
                          {isZh ? '解锁推荐' : 'Unlock Recommendations'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {!isEnded && (
              <div className="flex gap-4">
                <Button onClick={handleContinuePractice} className="flex-1">
                  {isZh ? '继续面试' : 'Continue Interview'}
                </Button>
                <Button variant="outline" onClick={handleEndSession}>
                  {isZh ? '结束并获取完整评估' : 'End & Get Full Assessment'}
                </Button>
              </div>
            )}

            {isEnded && (
              <div className="flex gap-4">
                <Button onClick={() => navigate('/mock-interviews')} className="flex-1">
                  {isZh ? '返回 Mock Interviews' : 'Back to Mock Interviews'}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isZh ? '再来一次' : 'Try Again'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chat screen
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container max-w-3xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/interview-mode')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <h1 className="font-semibold">{targetPosition}</h1>
                {/* 话题深度指示器 + 难度标签 */}
                <div className="flex items-center gap-2 mt-1">
                  <TopicDepthIndicator
                    topicName={currentTopic || (isZh ? '准备中' : 'Preparing')}
                    depth={calculateDepthLevel(collectedInfo.length, 8)}
                    language={language as 'en' | 'zh'}
                  />
                  <Badge
                    variant={currentDifficulty === 'Easy' ? 'secondary' : currentDifficulty === 'Hard' ? 'destructive' : 'default'}
                    className="text-xs"
                  >
                    {currentDifficulty === 'Easy' ? (isZh ? '简单' : 'Easy') :
                     currentDifficulty === 'Hard' ? (isZh ? '困难' : 'Hard') :
                     (isZh ? '中等' : 'Medium')}
                  </Badge>
                </div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleEndSession}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isZh ? '生成报告中...' : 'Generating report...'}
                </>
              ) : (
                isZh ? '结束面试' : 'End Interview'
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="container max-w-3xl py-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} group`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <Streamdown>{message.content}</Streamdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                {/* 收藏按钮 - 只在第一条 AI 消息（问题）旁边显示 */}
                {message.role === 'assistant' && index === 0 && currentTopic && (
                  <BookmarkButton
                    topic={currentTopic}
                    question={message.content}
                    difficulty={currentDifficulty}
                    targetPosition={targetPosition}
                    isZh={isZh}
                  />
                )}
              </div>
            </div>
          ))}
          
          {/* 流式响应显示 - 逐字显示 AI 回复（优先使用优化追问的流式内容） */}
          {(isOptimizedStreaming && optimizedStreamingContent) && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                <StreamingText 
                  content={optimizedStreamingContent} 
                  isStreaming={isOptimizedStreaming} 
                />
              </div>
            </div>
          )}
          
          {/* 状态评估中显示 - 快速状态评估阶段 */}
          {isEvaluating && !optimizedStreamingContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isZh ? '正在分析你的回答...' : 'Analyzing your response...'}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* AI 思考状态显示 - 当没有流式内容且不在评估时显示 */}
          {isLoading && !optimizedStreamingContent && !isEvaluating && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted">
                <ReActStatus
                  agent={getAgentInfo()}
                  currentStep={currentStep}
                  isRunning={true}
                  language={language as 'en' | 'zh'}
                />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-card">
        <div className="container max-w-3xl py-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder={isZh 
                ? "输入你的回答... (可以说'换话题'或'结束面试')" 
                : "Type your answer... (say 'switch topic' or 'end interview')"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setInputValue(isZh ? '这题太简单，换个难的' : 'This is too easy, give me a harder one')}
              disabled={isLoading}
            >
              {isZh ? '换难题' : 'Harder'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setInputValue(isZh ? '这题太难了，换个简单的' : 'This is too hard, give me an easier one')}
              disabled={isLoading}
            >
              {isZh ? '换简单题' : 'Easier'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setInputValue(isZh ? '换话题' : 'switch topic')}
              disabled={isLoading}
            >
              {isZh ? '换话题' : 'Switch Topic'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setInputValue(isZh ? '给我提示' : 'give me a hint')}
              disabled={isLoading}
            >
              {isZh ? '给我提示' : 'Give Hint'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setInputValue(isZh ? '结束面试' : 'end interview')}
              disabled={isLoading}
            >
              {isZh ? '结束面试' : 'End Interview'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isZh 
              ? '提示：如果题目太简单或太难，可以要求换一个题目' 
              : 'Tip: If the question is too easy or too hard, feel free to ask for a different one'}
          </p>
        </div>
      </div>
    </div>
  );
}
