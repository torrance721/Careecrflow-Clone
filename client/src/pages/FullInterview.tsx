/**
 * 高保真面试页面
 * 
 * 模拟真实公司面试流程
 * - 可选时间限制
 * - 多话题覆盖
 * - 完整评估报告
 * - 非阻塞设计：随时可结束
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Clock, CheckCircle, XCircle, TrendingUp, Target, Award } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface DimensionScore {
  dimension: string;
  score: number;
  maxScore: number;
  comment: string;
}

interface RadarDataPoint {
  label: string;
  value: number;
  benchmark: number;
}

interface ActionPlanItem {
  priority: "high" | "medium" | "low";
  action: string;
  expectedImpact: string;
  suggestedTimeframe: string;
}

interface FullAssessment {
  dimensionScores: DimensionScore[];
  radarData: RadarDataPoint[];
  competitiveness: {
    percentile: number;
    analysis: string;
  };
  hiringPrediction: {
    probability: number;
    keyFactors: Array<{
      factor: string;
      impact: "positive" | "negative" | "neutral";
      weight: number;
    }>;
  };
  actionPlan: ActionPlanItem[];
  overallComment: string;
}

type ViewState = "interview" | "assessment";

export default function FullInterview() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();
  const { language } = useLanguage();
  const isZh = language === "zh";

  // Parse URL params
  const params = new URLSearchParams(search);
  const company = params.get("company") || "";
  const position = params.get("position") || "";
  const round = params.get("round") || "behavioral";
  const timeLimitParam = params.get("timeLimit");
  const timeLimit = timeLimitParam ? parseInt(timeLimitParam) : null;

  // Interview state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState("");
  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [pendingTopics, setPendingTopics] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Timer state
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    timeLimit ? timeLimit * 60 : null
  );
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Assessment state
  const [assessment, setAssessment] = useState<FullAssessment | null>(null);
  const [viewState, setViewState] = useState<ViewState>("interview");

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning || remainingSeconds === null) return;

    const interval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize interview
  useEffect(() => {
    if (company && position && messages.length === 0) {
      initializeInterview();
    }
  }, [company, position]);

  const initializeInterview = async () => {
    setIsLoading(true);
    
    // Set up topics based on round
    const topics = getRoundTopics(round);
    setPendingTopics(topics.slice(1));
    setCurrentTopic(topics[0]);

    const greeting = isZh
      ? `你好！我是 ${company} 的面试官。\n\n今天我们进行 ${position} 职位的${getRoundName(round)}面试${timeLimit ? `，时间约 ${timeLimit} 分钟` : ""}。\n\n面试过程中，如果你需要暂停或想提前结束，随时告诉我。\n\n准备好了吗？我们开始吧。\n\n首先，请简单介绍一下你自己。`
      : `Hi! I'm an interviewer from ${company}.\n\nToday we'll conduct a ${getRoundName(round)} interview for the ${position} position${timeLimit ? `, approximately ${timeLimit} minutes` : ""}.\n\nDuring the interview, feel free to pause or end early anytime.\n\nReady? Let's begin.\n\nFirst, please briefly introduce yourself.`;

    setMessages([{
      role: "assistant",
      content: greeting,
      timestamp: new Date().toISOString()
    }]);

    setIsTimerRunning(true);
    setIsLoading(false);
  };

  const getRoundTopics = (round: string): string[] => {
    const topicMap: Record<string, string[]> = {
      phone_screen: isZh 
        ? ["自我介绍", "项目经验", "技术基础", "职业规划"]
        : ["Self Introduction", "Project Experience", "Technical Basics", "Career Goals"],
      behavioral: isZh
        ? ["自我介绍", "项目经验", "团队协作", "挑战应对", "职业规划"]
        : ["Self Introduction", "Project Experience", "Teamwork", "Challenge Handling", "Career Goals"],
      technical: isZh
        ? ["技术基础", "系统设计", "问题解决", "代码能力"]
        : ["Technical Basics", "System Design", "Problem Solving", "Coding Skills"],
      system_design: isZh
        ? ["需求分析", "架构设计", "扩展性", "权衡取舍"]
        : ["Requirements Analysis", "Architecture Design", "Scalability", "Trade-offs"],
      hiring_manager: isZh
        ? ["自我介绍", "职业规划", "团队匹配", "期望与动机"]
        : ["Self Introduction", "Career Goals", "Team Fit", "Expectations & Motivation"]
    };
    return topicMap[round] || topicMap.behavioral;
  };

  const getRoundName = (round: string): string => {
    const names: Record<string, string> = isZh
      ? {
          phone_screen: "电话筛选",
          behavioral: "行为面试",
          technical: "技术面试",
          system_design: "系统设计",
          hiring_manager: "招聘经理面试"
        }
      : {
          phone_screen: "Phone Screen",
          behavioral: "Behavioral Interview",
          technical: "Technical Interview",
          system_design: "System Design",
          hiring_manager: "Hiring Manager Interview"
        };
    return names[round] || round;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTimeUp = () => {
    setIsTimerRunning(false);
    toast.info(isZh ? "时间到！" : "Time's up!");
    generateAssessment("time_up");
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    setMessages(prev => [...prev, {
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    setIsLoading(true);

    // Check for end intent
    const lowerMessage = userMessage.toLowerCase();
    const wantsToEnd = ["结束面试", "结束", "不想继续", "end interview", "end", "stop", "quit"].some(k => lowerMessage.includes(k));

    if (wantsToEnd) {
      setIsTimerRunning(false);
      await generateAssessment("user_ended");
      return;
    }

    // Simulate AI response
    await simulateInterviewerResponse(userMessage);
    setIsLoading(false);
  };

  const simulateInterviewerResponse = async (userMessage: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const userMessageCount = messages.filter(m => m.role === "user").length;
    
    // Check if we should move to next topic
    if (userMessageCount > 0 && userMessageCount % 3 === 0 && pendingTopics.length > 0) {
      // Move to next topic
      const nextTopic = pendingTopics[0];
      setCompletedTopics(prev => [...prev, currentTopic]);
      setCurrentTopic(nextTopic);
      setPendingTopics(prev => prev.slice(1));

      const transition = isZh
        ? `好的，谢谢你的分享。\n\n接下来我们聊聊"${nextTopic}"。\n\n${getTopicQuestion(nextTopic)}`
        : `Great, thanks for sharing.\n\nNow let's talk about "${nextTopic}".\n\n${getTopicQuestion(nextTopic)}`;

      setMessages(prev => [...prev, {
        role: "assistant",
        content: transition,
        timestamp: new Date().toISOString()
      }]);
    } else if (pendingTopics.length === 0 && userMessageCount > 0 && userMessageCount % 3 === 0) {
      // All topics covered, end interview
      setCompletedTopics(prev => [...prev, currentTopic]);
      setIsTimerRunning(false);
      
      const closing = isZh
        ? "非常感谢你今天的分享！面试到此结束。\n\n让我为你生成详细的评估报告..."
        : "Thank you so much for sharing today! The interview ends here.\n\nLet me generate a detailed assessment report for you...";

      setMessages(prev => [...prev, {
        role: "assistant",
        content: closing,
        timestamp: new Date().toISOString()
      }]);

      await generateAssessment("completed");
    } else {
      // Continue current topic
      const followUp = getFollowUpQuestion(currentTopic, userMessageCount);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: followUp,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const getTopicQuestion = (topic: string): string => {
    const questions: Record<string, string> = isZh
      ? {
          "自我介绍": "请简单介绍一下你自己。",
          "项目经验": "请分享一个你最有成就感的项目经历。",
          "团队协作": "描述一次你与团队成员产生分歧的经历，你是如何处理的？",
          "挑战应对": "分享一个你面对重大挑战的经历。",
          "职业规划": "你对未来 3-5 年的职业规划是什么？",
          "技术基础": "请介绍一下你最熟悉的技术栈。",
          "系统设计": "如果让你设计一个高并发系统，你会怎么考虑？",
          "问题解决": "描述一个你解决过的复杂技术问题。"
        }
      : {
          "Self Introduction": "Please briefly introduce yourself.",
          "Project Experience": "Share a project you're most proud of.",
          "Teamwork": "Describe a time when you had a disagreement with a team member. How did you handle it?",
          "Challenge Handling": "Share an experience where you faced a significant challenge.",
          "Career Goals": "What are your career plans for the next 3-5 years?",
          "Technical Basics": "Tell me about your most familiar tech stack.",
          "System Design": "If you were to design a high-concurrency system, how would you approach it?",
          "Problem Solving": "Describe a complex technical problem you've solved."
        };
    return questions[topic] || (isZh ? "请详细说说这方面的经历。" : "Please tell me more about your experience in this area.");
  };

  const getFollowUpQuestion = (topic: string, count: number): string => {
    const followUps = isZh
      ? [
          "能详细说说吗？",
          "在这个过程中你学到了什么？",
          "如果再来一次，你会有什么不同的做法？",
          "你是如何衡量成功的？"
        ]
      : [
          "Can you elaborate on that?",
          "What did you learn from this experience?",
          "If you could do it again, what would you do differently?",
          "How did you measure success?"
        ];
    return followUps[count % followUps.length];
  };

  const generateAssessment = async (reason: "completed" | "time_up" | "user_ended") => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate mock assessment
    setAssessment({
      dimensionScores: [
        { dimension: isZh ? "技术能力" : "Technical Skills", score: 7, maxScore: 10, comment: isZh ? "展示了扎实的技术基础" : "Demonstrated solid technical foundation" },
        { dimension: isZh ? "问题解决" : "Problem Solving", score: 8, maxScore: 10, comment: isZh ? "思路清晰，方法得当" : "Clear thinking, appropriate methods" },
        { dimension: isZh ? "沟通表达" : "Communication", score: 7, maxScore: 10, comment: isZh ? "表达清晰，可以更简洁" : "Clear expression, could be more concise" },
        { dimension: isZh ? "团队协作" : "Teamwork", score: 8, maxScore: 10, comment: isZh ? "展示了良好的协作意识" : "Showed good collaboration awareness" },
        { dimension: isZh ? "学习能力" : "Learning Ability", score: 8, maxScore: 10, comment: isZh ? "持续学习的态度很好" : "Good attitude towards continuous learning" },
        { dimension: isZh ? "文化匹配" : "Culture Fit", score: 7, maxScore: 10, comment: isZh ? "价值观基本契合" : "Values generally align" }
      ],
      radarData: [
        { label: isZh ? "技术能力" : "Technical", value: 7, benchmark: 8 },
        { label: isZh ? "问题解决" : "Problem Solving", value: 8, benchmark: 8 },
        { label: isZh ? "沟通表达" : "Communication", value: 7, benchmark: 7.5 },
        { label: isZh ? "团队协作" : "Teamwork", value: 8, benchmark: 7.5 },
        { label: isZh ? "学习能力" : "Learning", value: 8, benchmark: 8 },
        { label: isZh ? "文化匹配" : "Culture Fit", value: 7, benchmark: 7 }
      ],
      competitiveness: {
        percentile: 72,
        analysis: isZh
          ? `基于本次面试表现，您的综合能力优于约 72% 的 ${company} ${position} 候选人。您在问题解决和团队协作方面表现突出，技术深度还有提升空间。`
          : `Based on this interview, your overall ability exceeds approximately 72% of ${company} ${position} candidates. You excelled in problem solving and teamwork, with room for improvement in technical depth.`
      },
      hiringPrediction: {
        probability: 65,
        keyFactors: [
          { factor: isZh ? "问题解决能力" : "Problem Solving", impact: "positive", weight: 0.25 },
          { factor: isZh ? "团队协作" : "Teamwork", impact: "positive", weight: 0.2 },
          { factor: isZh ? "技术深度" : "Technical Depth", impact: "neutral", weight: 0.25 },
          { factor: isZh ? "沟通表达" : "Communication", impact: "neutral", weight: 0.15 },
          { factor: isZh ? "文化匹配" : "Culture Fit", impact: "positive", weight: 0.15 }
        ]
      },
      actionPlan: [
        {
          priority: "high",
          action: isZh ? "深入学习系统设计" : "Deep dive into system design",
          expectedImpact: isZh ? "提升技术面试通过率" : "Improve technical interview pass rate",
          suggestedTimeframe: isZh ? "2-4 周" : "2-4 weeks"
        },
        {
          priority: "medium",
          action: isZh ? "准备更多量化的项目成果" : "Prepare more quantified project outcomes",
          expectedImpact: isZh ? "增强说服力" : "Increase persuasiveness",
          suggestedTimeframe: isZh ? "1 周" : "1 week"
        },
        {
          priority: "medium",
          action: isZh ? `研究 ${company} 的产品和文化` : `Research ${company}'s products and culture`,
          expectedImpact: isZh ? "提升文化匹配度" : "Improve culture fit",
          suggestedTimeframe: isZh ? "1 周" : "1 week"
        }
      ],
      overallComment: isZh
        ? `本次 ${company} ${position} 模拟面试表现良好。您展示了扎实的基础能力和积极的学习态度。建议在技术深度方面继续提升，同时准备更多具体的项目案例和数据。相信通过针对性的准备，您有很大机会获得 ${company} 的 offer。`
        : `Good performance in this ${company} ${position} mock interview. You demonstrated solid foundational skills and a positive learning attitude. We recommend continuing to improve technical depth while preparing more specific project cases and data. With targeted preparation, you have a good chance of receiving an offer from ${company}.`
    });

    setViewState("assessment");
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Assessment View
  if (viewState === "assessment" && assessment) {
    const avgScore = assessment.dimensionScores.reduce((sum, d) => sum + d.score, 0) / assessment.dimensionScores.length;

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="container flex items-center justify-between h-14">
            <h1 className="font-semibold text-lg">
              {isZh ? "面试评估报告" : "Interview Assessment Report"}
            </h1>
            <Badge>{company} - {position}</Badge>
          </div>
        </header>

        <main className="container py-6 space-y-6 max-w-4xl">
          {/* Overall Score */}
          <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{isZh ? "综合评分" : "Overall Score"}</h2>
                  <p className="opacity-90">{assessment.overallComment.slice(0, 100)}...</p>
                </div>
                <div className="text-center">
                  <div className="text-5xl font-bold">{avgScore.toFixed(1)}</div>
                  <div className="text-sm opacity-80">/10</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Competitiveness & Hiring Prediction */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {isZh ? "竞争力分析" : "Competitiveness"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">
                  Top {100 - assessment.competitiveness.percentile}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {assessment.competitiveness.analysis}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {isZh ? "录用可能性" : "Hiring Probability"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary mb-2">
                  {assessment.hiringPrediction.probability}%
                </div>
                <div className="space-y-1">
                  {assessment.hiringPrediction.keyFactors.slice(0, 3).map((factor, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {factor.impact === "positive" ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : factor.impact === "negative" ? (
                        <XCircle className="h-3 w-3 text-red-500" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-gray-300" />
                      )}
                      <span className="text-muted-foreground">{factor.factor}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dimension Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isZh ? "各维度评分" : "Dimension Scores"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assessment.dimensionScores.map((dim, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{dim.dimension}</span>
                    <span className="text-sm text-muted-foreground">{dim.score}/{dim.maxScore}</span>
                  </div>
                  <Progress value={dim.score * 10} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{dim.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Action Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4" />
                {isZh ? "行动计划" : "Action Plan"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assessment.actionPlan.map((item, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={
                        item.priority === "high" ? "destructive" :
                        item.priority === "medium" ? "default" : "secondary"
                      }>
                        {item.priority === "high" ? (isZh ? "高优先级" : "High") :
                         item.priority === "medium" ? (isZh ? "中优先级" : "Medium") :
                         (isZh ? "低优先级" : "Low")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{item.suggestedTimeframe}</span>
                    </div>
                    <h4 className="font-medium mb-1">{item.action}</h4>
                    <p className="text-sm text-muted-foreground">{item.expectedImpact}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Overall Comment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isZh ? "整体评语" : "Overall Comment"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{assessment.overallComment}</p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/interview-mode")}
            >
              {isZh ? "返回" : "Back"}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setViewState("interview");
                setMessages([]);
                setAssessment(null);
                setCompletedTopics([]);
                initializeInterview();
              }}
            >
              {isZh ? "重新面试" : "Retry Interview"}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Interview View
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container flex items-center justify-between h-14">
          <div>
            <h1 className="font-semibold text-lg">{company}</h1>
            <p className="text-xs text-muted-foreground">{position} - {getRoundName(round)}</p>
          </div>
          <div className="flex items-center gap-2">
            {remainingSeconds !== null && (
              <Badge variant={remainingSeconds < 300 ? "destructive" : "outline"} className="font-mono">
                <Clock className="h-3 w-3 mr-1" />
                {formatTime(remainingSeconds)}
              </Badge>
            )}
            <Badge variant="outline">{currentTopic}</Badge>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="container py-2 border-b">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{isZh ? "进度:" : "Progress:"}</span>
          {completedTopics.map((topic, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              {topic}
            </Badge>
          ))}
          <Badge className="text-xs">{currentTopic}</Badge>
          {pendingTopics.map((topic, i) => (
            <Badge key={i} variant="outline" className="text-xs opacity-50">{topic}</Badge>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="container py-4 space-y-4 max-w-3xl">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t">
        <div className="container py-4 max-w-3xl">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isZh ? "输入你的回答..." : "Type your answer..."}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {isZh
              ? "随时可以说「结束面试」提前结束"
              : "You can say 'end interview' to finish early anytime"}
          </p>
        </div>
      </div>
    </div>
  );
}
