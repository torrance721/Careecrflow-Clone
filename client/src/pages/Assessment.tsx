import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  BookOpen,
  Clock,
  Briefcase,
  Building2,
  Target,
  Star,
  ArrowRight
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Assessment() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId ? parseInt(params.reportId) : undefined;
  const { t, language } = useLanguage();

  // We need to get the report by session ID, so let's query all reports and find the one
  const { data: reports, isLoading: reportsLoading } = trpc.mockInterview.listReports.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  // Find the report with matching ID
  const report = reports?.find(r => r.id === reportId);

  // Get job details
  const { data: sessionData, isLoading: sessionLoading } = trpc.mockInterview.getReport.useQuery(
    { sessionId: report?.sessionId || 0 },
    { enabled: !!report?.sessionId && isAuthenticated }
  );

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
            {language === 'zh' ? '请登录以查看您的评估报告' : 'Please login to view your assessment'}
          </p>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  if (reportsLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">
          {language === 'zh' ? '正在加载您的评估报告...' : 'Loading your assessment...'}
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-semibold mb-4">
            {language === 'zh' ? '报告未找到' : 'Report Not Found'}
          </h2>
          <p className="text-muted-foreground mb-6">
            {language === 'zh' 
              ? '您要查找的评估报告不存在。'
              : "The assessment report you're looking for doesn't exist."}
          </p>
          <Button onClick={() => navigate("/")}>
            {t('report.backToHome')}
          </Button>
        </Card>
      </div>
    );
  }

  const job = sessionData?.job;
  const matchScore = report.matchScore || 0;
  const strengths = report.strengths || [];
  const improvements = report.improvements || [];
  const suggestions = report.suggestions || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (language === 'zh') {
      if (score >= 80) return "高度匹配";
      if (score >= 60) return "潜力良好";
      return "需要提升";
    }
    if (score >= 80) return "Strong Match";
    if (score >= 60) return "Good Potential";
    return "Needs Development";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "low": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityLabel = (priority: string) => {
    if (language === 'zh') {
      switch (priority) {
        case "high": return "高";
        case "medium": return "中";
        case "low": return "低";
        default: return priority;
      }
    }
    return priority;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">{t('report.title')}</h1>
            {job && (
              <p className="text-sm text-muted-foreground">{job.position} @ {job.company}</p>
            )}
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Match Score Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{t('report.overallMatch')}</h2>
              <p className="text-sm text-muted-foreground">
                {language === 'zh' ? '基于您的面试回答' : 'Based on your interview responses'}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getScoreColor(matchScore)}`}>
                {matchScore}%
              </div>
              <div className={`text-sm ${getScoreColor(matchScore)}`}>
                {getScoreLabel(matchScore)}
              </div>
            </div>
          </div>
          <Progress value={matchScore} className="h-3" />
        </Card>

        {/* Job Info */}
        {job && (
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
            </div>
          </Card>
        )}

        {/* Summary */}
        {report.summary && (
          <Card className="p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              {language === 'zh' ? '总结' : 'Summary'}
            </h3>
            <p className="text-muted-foreground">{report.summary}</p>
          </Card>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              {t('report.strengths')}
            </h3>
            <div className="space-y-3">
              {strengths.map((strength, index) => (
                <div key={index} className="flex gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-green-800">{strength.skill}</div>
                    <div className="text-sm text-green-700">{strength.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Areas for Improvement */}
        {improvements.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
              {t('report.improvements')}
            </h3>
            <div className="space-y-3">
              {improvements.map((item, index) => (
                <div key={index} className="flex gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-yellow-800">{item.skill}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityColor(item.priority)}`}>
                        {getPriorityLabel(item.priority)}
                      </span>
                    </div>
                    <div className="text-sm text-yellow-700">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Learning Suggestions */}
        {suggestions.length > 0 && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {t('report.learningPath')}
            </h3>
            <div className="space-y-3">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex gap-3 p-4 border rounded-lg hover:bg-blue-50/50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{suggestion.topic}</div>
                    <div className="text-sm text-muted-foreground">{suggestion.resource}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{suggestion.estimatedTime}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground self-center" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate("/")}
          >
            {t('report.backToHome')}
          </Button>
          <Button 
            className="flex-1"
            onClick={() => navigate("/match-roles")}
          >
            {language === 'zh' ? '查看更多职位' : 'View More Jobs'}
          </Button>
        </div>
      </div>
    </div>
  );
}
