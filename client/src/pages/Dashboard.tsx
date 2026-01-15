import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Home, 
  Briefcase, 
  FileText, 
  Kanban, 
  MessageSquare, 
  Folder, 
  Linkedin, 
  Mail, 
  Sparkles, 
  User, 
  Lightbulb, 
  Bug,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  ArrowRight,
  Plus,
  Users,
  Target,
  TrendingUp,
  Calendar,
  Mic,
  FileEdit,
  Send,
  X,
  UserPlus,
  Search,
  Award
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo } from "react";

// Tab 数据结构定义
interface TabTask {
  label: string;
  href: string;
  icon: React.ReactNode;
  completedIcon: React.ReactNode;
  checkCompleted: (data: { hasResume: boolean; hasLinkedIn: boolean; hasJobs: boolean; hasInterview: boolean; hasOffer: boolean; hasTailoredResume: boolean; hasCoverLetter: boolean; hasContact: boolean; hasContactActivity: boolean; hasLinkedInPost: boolean }) => boolean;
}

interface TabRightCard {
  category: string;
  title: string;
  description: string;
  cta: { label: string; href: string };
  image?: string;
}

interface TabData {
  tasks: TabTask[];
  rightCard: TabRightCard;
}

const tabDataConfig: Record<string, TabData> = {
  applicationMaterials: {
    tasks: [
      { 
        label: "Create A Base Resume", 
        href: "/resume-builder", 
        icon: <FileText className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasResume
      },
      { 
        label: "Optimize LinkedIn Profile", 
        href: "/linkedin-headline", 
        icon: <Linkedin className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasLinkedIn
      },
    ],
    rightCard: {
      category: "Application Materials",
      title: "Build Your Professional Profile",
      description: "Create a standout resume and optimize your LinkedIn profile to attract recruiters. A strong profile increases your visibility by 40%.",
      cta: { label: "Create Resume", href: "/resume-builder" }
    }
  },
  jobs: {
    tasks: [
      { 
        label: "Add a Job", 
        href: "/job-tracker", 
        icon: <Briefcase className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasJobs
      },
      // Removed: Tailor Your Resume
      // Removed: Create a Cover Letter
      { 
        label: "Apply for a Job", 
        href: "/job-tracker", 
        icon: <Send className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasJobs
      },
    ],
    rightCard: {
      category: "Jobs",
      title: "Add Your First Job",
      description: "Start tracking your job applications. Keep all your opportunities organized in one place and never miss a deadline.",
      cta: { label: "Add Job", href: "/job-tracker" }
    }
  },
  networking: {
    tasks: [
      { 
        label: "Add a Contact", 
        href: "/job-tracker", 
        icon: <UserPlus className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasContact
      },
      { 
        label: "Perform Contact Activity", 
        href: "/email-writer", 
        icon: <Mail className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasContactActivity
      },
      { 
        label: "Craft LinkedIn Post", 
        href: "/linkedin-post", 
        icon: <Linkedin className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: (data) => data.hasLinkedInPost
      },
      { 
        label: "Search For Recruiters", 
        href: "/jobs", 
        icon: <Search className="w-5 h-5 text-primary" />,
        completedIcon: <CheckCircle2 className="w-5 h-5 text-success" />,
        checkCompleted: () => false
      },
    ],
    rightCard: {
      category: "Networking",
      title: "Expand Your Network",
      description: "80% of jobs are filled through networking. Start building meaningful connections with recruiters and industry professionals.",
      cta: { label: "Create A New Contact", href: "/job-tracker" }
    }
  }
  // Removed: interviews tab
  // interviews: {
  //   tasks: [...],
  //   rightCard: {...}
  // }
};

// Explore All Features 弹窗数据
const exploreFeatures = [
  {
    title: "AI Resume Builder",
    description: "Leverage the power of AI to customize your resume targeted for a jobs you aim for.",
    icon: <FileText className="w-8 h-8" />,
    href: "/resume-builder",
    isNew: true
  },
  {
    title: "LinkedIn Optimization",
    description: "Follow our expert suggestions for your profile to build a star profile.",
    icon: <Linkedin className="w-8 h-8" />,
    href: "/linkedin-headline",
  },
  {
    title: "Cover Letters",
    description: "Get customized AI Cover letter for each job description highlighting your profile.",
    icon: <FileEdit className="w-8 h-8" />,
    href: "/cover-letters",
  },
  {
    title: "Job Tracker",
    description: "Keep all your job applications organized in one place and never miss a deadline.",
    icon: <Kanban className="w-8 h-8" />,
    href: "/job-tracker",
  },
  {
    title: "Mock Interviews",
    description: "Practice with AI-powered mock interviews and get instant feedback.",
    icon: <MessageSquare className="w-8 h-8" />,
    href: "/mock-interview",
  },
  {
    title: "Email Writer",
    description: "Generate professional emails for networking and follow-ups.",
    icon: <Mail className="w-8 h-8" />,
    href: "/email-writer",
  }
];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [showExploreModal, setShowExploreModal] = useState(false);

  // Fetch dynamic stats
  const { data: stats } = trpc.jobhProfile.stats.useQuery();
  const { data: resumes } = trpc.resume.list.useQuery();
  const { data: jobs } = trpc.jobTracker.list.useQuery();

  // 计算完成状态
  const completionData = useMemo(() => {
    return {
      hasResume: (resumes?.length || 0) > 0,
      hasLinkedIn: false, // Would check if LinkedIn profile is optimized
      hasJobs: (jobs?.length || 0) > 0,
      hasInterview: jobs?.some(j => j.status === 'interviewing') || false,
      hasOffer: jobs?.some(j => j.status === 'offer') || false,
      hasTailoredResume: resumes?.some(r => r.type === 'tailored') || false,
      hasCoverLetter: false, // Would check cover letters
      hasContact: false, // Would check contacts
      hasContactActivity: false, // Would check contact activities
      hasLinkedInPost: false, // Would check LinkedIn posts
    };
  }, [resumes, jobs]);

  // 获取当前 Tab 数据
  // Hidden: applicationMaterials and networking
  const tabKeys = ['jobs'] as const; // Removed: interviews
  const currentTabKey = tabKeys[currentStep];
  const currentTabData = tabDataConfig[currentTabKey];

  // 计算当前 Tab 的进度
  const currentTabProgress = useMemo(() => {
    const tasks = currentTabData.tasks;
    const completedCount = tasks.filter(task => task.checkCompleted(completionData)).length;
    return {
      completed: completedCount,
      total: tasks.length,
      percent: (completedCount / tasks.length) * 100
    };
  }, [currentTabData, completionData]);

  // 获取当前选中任务的右侧卡片内容
  const currentRightCard = useMemo(() => {
    // 如果有选中的任务，可以显示该任务的详细信息
    // 这里简化处理，直接显示 Tab 的右侧卡片
    return currentTabData.rightCard;
  }, [currentTabData]);

  // Job stats by status
  const jobStats = useMemo(() => {
    if (!jobs) return { applied: 0, interviewing: 0, offered: 0, rejected: 0 };
    return {
      applied: jobs.filter(j => j.status === 'applied').length,
      interviewing: jobs.filter(j => j.status === 'interviewing').length,
      offered: jobs.filter(j => j.status === 'offer').length,
      rejected: jobs.filter(j => j.status === 'rejected').length,
    };
  }, [jobs]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const progressSteps = [
    // Hidden: Application Materials
    // { label: "Application Materials", completed: completionData.hasResume && completionData.hasLinkedIn, active: currentStep === 0 },
    { label: "Jobs", completed: completionData.hasJobs, active: currentStep === 0 },
    // Hidden: Networking
    // { label: "Networking", completed: false, active: currentStep === 1 },
    // Hidden: Interviews
    // { label: "Interviews", completed: completionData.hasInterview, active: currentStep === 1 },
  ];

  const handleTabClick = (index: number) => {
    setCurrentStep(index);
    setSelectedTaskIndex(0); // 重置选中的任务
  };

  const handleTaskClick = (index: number, href: string) => {
    setSelectedTaskIndex(index);
    // 可以选择是否跳转，这里保留跳转行为
    // 如果要完全对齐 Careerflow（不跳转），可以注释掉下面的代码
    window.location.href = href;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">
            Hi, {user?.name?.split(' ')[0] || "there"}
          </h1>
          <p className="text-muted-foreground mt-2">
            Here's an impactful action plan for your dream job hunt
          </p>
        </div>

        {/* Progress Tracker - Dark Theme Style */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {progressSteps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <button
                onClick={() => handleTabClick(index)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  step.active 
                    ? "bg-primary text-primary-foreground shadow-md glow-primary-soft" 
                    : step.completed
                    ? "bg-success/20 text-success border border-success/30"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {step.label}
              </button>
              {index < progressSteps.length - 1 && (
                <div className={`w-8 h-px mx-1 ${step.completed ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats?.resumesCreated || resumes?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Resumes Created</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats?.jobsTracked || jobs?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Jobs Tracked</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Removed: Interviewing stat */}
          <Card className="border-border bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{jobStats.offered}</p>
                  <p className="text-xs text-muted-foreground">Offers Received</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid - 2 Columns (动态内容) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Your Progress Card - 根据 Tab 动态变化 */}
          <Card className="border-border bg-card lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between text-foreground">
                Your Progress
                <span className="text-sm font-normal text-muted-foreground">
                  {currentTabProgress.completed}/{currentTabProgress.total}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="progress-animated">
                <Progress value={currentTabProgress.percent} className="h-2" />
              </div>
              
              {/* Task List - 根据 Tab 动态变化 */}
              <div className="space-y-2">
                {currentTabData.tasks.map((task, index) => {
                  const isCompleted = task.checkCompleted(completionData);
                  const isSelected = selectedTaskIndex === index;
                  return (
                    <Link key={task.label} href={task.href}>
                      <div 
                        onClick={(e) => {
                          e.preventDefault();
                          handleTaskClick(index, task.href);
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-primary/10 border border-primary/30" 
                            : isCompleted 
                            ? "bg-secondary/50 border border-transparent" 
                            : "bg-secondary border border-transparent hover:border-primary/20"
                        }`}
                      >
                        {isCompleted ? task.completedIcon : task.icon}
                        <span className={`text-sm flex-1 ${isCompleted ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                          {task.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Card - 根据 Tab 动态变化 */}
          <Card className="border-primary/30 bg-card lg:col-span-1">
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-primary">{currentRightCard.category}</span>
              <CardTitle className="text-lg text-foreground">{currentRightCard.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {currentRightCard.description}
              </p>
              <Link href={currentRightCard.cta.href}>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  {currentRightCard.cta.label}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Removed: Quick Actions Card */}
          {/* <Card className="border-border bg-card">
            ...
          </Card> */}
        </div>

        {/* Removed: Job Pipeline */}
        {/* {(jobs?.length || 0) > 0 && (
          <Card className="border-border bg-card">
            ...
          </Card>
        )} */}

        {/* Removed: Feature Exploration Section (You've Taken the First Step) */}
        {/* <Card className="border-border bg-card">
          <CardContent className="py-6">
            ...
          </CardContent>
        </Card> */}

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-fade-in">
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Resume Builder"
            description="Create ATS-friendly resumes tailored for each job"
            href="/resume-builder"
          />
          <FeatureCard
            icon={<Kanban className="w-6 h-6" />}
            title="Job Tracker"
            description="Organize and track all your job applications"
            href="/job-tracker"
          />
          <FeatureCard
            icon={<Linkedin className="w-6 h-6" />}
            title="LinkedIn Optimizer"
            description="Improve your LinkedIn profile visibility"
            href="/linkedin-headline"
          />
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            title="AI Tools"
            description="Generate cover letters, emails, and more"
            href="/cover-letters"
          />
        </div>
      </div>

      {/* Explore All Features Modal */}
      <Dialog open={showExploreModal} onOpenChange={setShowExploreModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl text-foreground">Explore Features</DialogTitle>
            <p className="text-muted-foreground">
              Your AI Career Copilot is here. Discover the array of features designed to streamline your job search and enhance your professional journey!
            </p>
          </DialogHeader>
          
          {/* Tab Navigation in Modal */}
          <div className="flex items-center justify-center gap-2 py-4 border-b border-border flex-wrap">
            {progressSteps.map((step, index) => (
              <button
                key={step.label}
                onClick={() => handleTabClick(index)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  step.active 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {exploreFeatures.map((feature) => (
              <Link key={feature.title} href={feature.href}>
                <Card 
                  className="border-border bg-secondary/50 hover:bg-secondary transition-all cursor-pointer h-full"
                  onClick={() => setShowExploreModal(false)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0 bg-primary/20 text-primary">
                        {feature.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{feature.title}</h3>
                          {feature.isNew && (
                            <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded-full">New</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Get Started
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

function FeatureCard({ icon, title, description, href }: FeatureCardProps) {
  return (
    <Link href={href}>
      <Card className="border-border bg-card hover:border-primary/30 transition-all cursor-pointer h-full">
        <CardContent className="pt-6">
          <div className="w-12 h-12 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-4">
            {icon}
          </div>
          <h3 className="font-semibold mb-1 text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
