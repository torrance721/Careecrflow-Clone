/**
 * ReAct Agent 演示页面
 * 
 * 展示统一的 ReAct 思维链可视化组件
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Brain, Target, Lightbulb } from 'lucide-react';
import { ReActViewer, ReActStatus } from '@/components/ReActViewer';
import type { StreamingStep, AgentInfo } from '@/components/ReActViewer';

// 模拟数据用于演示
const MOCK_STEPS: StreamingStep[] = [
  {
    id: 'step-1',
    step: 1,
    status: 'completed',
    thought: 'I need to analyze the user\'s career trajectory to understand their current position and experience level.',
    action: {
      tool: 'analyze_career_trajectory',
      toolDisplayName: 'Analyzing career trajectory',
      params: { currentRole: 'Software Engineer', yearsOfExperience: 3 },
    },
    observation: '{"stage": "mid-level", "trajectory": "technical IC track", "strengths": ["coding", "problem-solving"]}',
    startTime: Date.now() - 5000,
    endTime: Date.now() - 4500,
    durationMs: 500,
  },
  {
    id: 'step-2',
    step: 2,
    status: 'completed',
    thought: 'Now I should extract the user\'s career goals based on their background and target role.',
    action: {
      tool: 'extract_career_goals',
      toolDisplayName: 'Extracting career goals',
      params: { targetRole: 'Senior Software Engineer', targetIndustry: 'Tech' },
    },
    observation: '{"goals": ["technical leadership", "system design expertise", "mentoring juniors"]}',
    startTime: Date.now() - 4500,
    endTime: Date.now() - 4000,
    durationMs: 500,
  },
  {
    id: 'step-3',
    step: 3,
    status: 'completed',
    thought: 'I need to identify skill gaps between the user\'s current abilities and their target role requirements.',
    action: {
      tool: 'identify_skill_gaps',
      toolDisplayName: 'Identifying skill gaps',
      params: { currentSkills: ['JavaScript', 'React'], targetSkills: ['System Design', 'Leadership'] },
    },
    observation: '{"gaps": ["system design", "technical leadership", "cross-team collaboration"]}',
    startTime: Date.now() - 4000,
    endTime: Date.now() - 3500,
    durationMs: 500,
  },
  {
    id: 'step-4',
    step: 4,
    status: 'running',
    thought: 'Searching for aligned positions that match the user\'s background and career goals...',
    action: {
      tool: 'search_aligned_positions',
      toolDisplayName: 'Searching aligned positions',
      params: { role: 'Senior Software Engineer', location: 'San Francisco' },
    },
    startTime: Date.now() - 3500,
  },
];

const MOCK_AGENT: AgentInfo = {
  name: 'career_path_matching',
  displayName: 'Career Path Matching',
  description: 'Analyzing your career trajectory and finding matching positions...',
};

export default function ReActDemo() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isZh = language === 'zh';

  // Demo states
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StreamingStep[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Form states
  const [targetRole, setTargetRole] = useState('Senior Software Engineer');
  const [currentRole, setCurrentRole] = useState('Software Engineer');
  const [skills, setSkills] = useState('JavaScript, React, Node.js');

  // Simulate running agent
  const handleRunDemo = () => {
    setIsRunning(true);
    setSteps([]);
    setIsExpanded(true);
    
    // Simulate steps being added one by one
    MOCK_STEPS.forEach((step, index) => {
      setTimeout(() => {
        setSteps(prev => {
          const newSteps = [...prev];
          // Mark previous step as completed
          if (newSteps.length > 0) {
            newSteps[newSteps.length - 1] = {
              ...newSteps[newSteps.length - 1],
              status: 'completed',
            };
          }
          // Add new step
          return [...newSteps, step];
        });
        
        // End simulation after last step
        if (index === MOCK_STEPS.length - 1) {
          setTimeout(() => {
            setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as const })));
            setIsRunning(false);
          }, 1500);
        }
      }, index * 1500);
    });
  };

  // Reset demo
  const handleReset = () => {
    setIsRunning(false);
    setSteps([]);
    setIsExpanded(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isZh ? '返回' : 'Back'}
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              {isZh ? 'ReAct Agent 演示' : 'ReAct Agent Demo'}
            </h1>
            <p className="text-muted-foreground">
              {isZh 
                ? '统一的思维链可视化组件展示' 
                : 'Unified thinking chain visualization component demo'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="viewer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="viewer">
              {isZh ? '完整视图' : 'Full Viewer'}
            </TabsTrigger>
            <TabsTrigger value="status">
              {isZh ? '状态指示' : 'Status Indicator'}
            </TabsTrigger>
            <TabsTrigger value="interactive">
              {isZh ? '交互演示' : 'Interactive Demo'}
            </TabsTrigger>
          </TabsList>

          {/* Full Viewer Tab */}
          <TabsContent value="viewer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isZh ? '完整思维链视图' : 'Full Thinking Chain View'}</CardTitle>
                <CardDescription>
                  {isZh 
                    ? '展示 AI 的完整思考过程，可展开查看每个步骤的详细信息' 
                    : 'Shows the complete AI thinking process, expandable to view details of each step'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button onClick={handleRunDemo} disabled={isRunning}>
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isZh ? '运行中...' : 'Running...'}
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        {isZh ? '运行演示' : 'Run Demo'}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset} disabled={isRunning}>
                    {isZh ? '重置' : 'Reset'}
                  </Button>
                </div>

                <ReActViewer
                  agent={MOCK_AGENT}
                  steps={steps}
                  isRunning={isRunning}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setIsExpanded(!isExpanded)}
                  language={language as 'en' | 'zh'}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Status Indicator Tab */}
          <TabsContent value="status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{isZh ? '简化状态指示' : 'Simplified Status Indicator'}</CardTitle>
                <CardDescription>
                  {isZh 
                    ? '轻量级的状态显示，适合嵌入到其他组件中' 
                    : 'Lightweight status display, suitable for embedding in other components'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button onClick={handleRunDemo} disabled={isRunning}>
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isZh ? '运行中...' : 'Running...'}
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        {isZh ? '运行演示' : 'Run Demo'}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset} disabled={isRunning}>
                    {isZh ? '重置' : 'Reset'}
                  </Button>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <ReActStatus
                    agent={MOCK_AGENT}
                    currentStep={steps[steps.length - 1]}
                    isRunning={isRunning}
                    language={language as 'en' | 'zh'}
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  {isZh 
                    ? '这个简化版本只显示当前状态，不显示完整的思维链。适合在空间有限的地方使用。' 
                    : 'This simplified version only shows the current status, not the full thinking chain. Suitable for use in space-limited areas.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interactive Demo Tab */}
          <TabsContent value="interactive" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  {isZh ? '职业路径匹配 Agent' : 'Career Path Matching Agent'}
                </CardTitle>
                <CardDescription>
                  {isZh 
                    ? '输入你的背景信息，观察 AI 如何分析并推荐职位' 
                    : 'Enter your background information and watch how AI analyzes and recommends positions'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{isZh ? '当前职位' : 'Current Role'}</Label>
                    <Input
                      value={currentRole}
                      onChange={(e) => setCurrentRole(e.target.value)}
                      placeholder={isZh ? '例如：Software Engineer' : 'e.g., Software Engineer'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isZh ? '目标职位' : 'Target Role'}</Label>
                    <Input
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder={isZh ? '例如：Senior Software Engineer' : 'e.g., Senior Software Engineer'}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{isZh ? '技能（逗号分隔）' : 'Skills (comma-separated)'}</Label>
                  <Textarea
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder={isZh ? '例如：JavaScript, React, Node.js' : 'e.g., JavaScript, React, Node.js'}
                    rows={2}
                  />
                </div>

                <div className="flex gap-4">
                  <Button onClick={handleRunDemo} disabled={isRunning}>
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isZh ? '分析中...' : 'Analyzing...'}
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        {isZh ? '开始分析' : 'Start Analysis'}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset} disabled={isRunning}>
                    {isZh ? '重置' : 'Reset'}
                  </Button>
                </div>

                {(steps.length > 0 || isRunning) && (
                  <ReActViewer
                    agent={MOCK_AGENT}
                    steps={steps}
                    isRunning={isRunning}
                    isExpanded={true}
                    language={language as 'en' | 'zh'}
                  />
                )}
              </CardContent>
            </Card>

            {/* Feature highlights */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-medium">{isZh ? '实时思考' : 'Real-time Thinking'}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isZh 
                      ? '实时展示 AI 的思考过程，让用户了解决策是如何做出的' 
                      : 'Real-time display of AI thinking process, showing how decisions are made'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Target className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-medium">{isZh ? '工具调用' : 'Tool Invocation'}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isZh 
                      ? '展示 AI 使用的每个工具及其参数和结果' 
                      : 'Shows each tool used by AI along with parameters and results'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-medium">{isZh ? '可展开详情' : 'Expandable Details'}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isZh 
                      ? '点击展开查看每个步骤的详细信息，包括参数和观察结果' 
                      : 'Click to expand and view detailed information for each step'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
