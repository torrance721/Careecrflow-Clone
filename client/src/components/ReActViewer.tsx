/**
 * ReActViewer - 统一的 ReAct 思维链展示组件
 * 
 * 类似 ChatGPT 的思维链展示：
 * - 实时显示当前思考状态
 * - 可展开查看完整思维链
 * - 支持多种 Agent 类型
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Brain, Wrench, Eye, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface StreamingStep {
  id: string;
  step: number;
  status: StepStatus;
  thought?: string;
  action?: {
    tool: string;
    toolDisplayName: string;
    params: Record<string, unknown>;
  };
  observation?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

export interface AgentInfo {
  name: string;
  displayName: string;
  description: string;
}

export interface ReActViewerProps {
  agent: AgentInfo;
  steps: StreamingStep[];
  isRunning: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
  language?: 'en' | 'zh';
}

// ==================== Agent 显示名称映射 ====================

const AGENT_DISPLAY_NAMES: Record<string, { en: string; zh: string }> = {
  'career_path_matching': { en: 'Career Path Matching', zh: '职业路径匹配' },
  'adaptive_feedback': { en: 'Adaptive Feedback', zh: '自适应反馈' },
  'job_recommendation': { en: 'Job Recommendation', zh: '职位推荐' },
  'feedback_generation': { en: 'Feedback Generation', zh: '反馈生成' },
  'hint_agent': { en: 'Hint Generation', zh: '提示生成' },
  'question_generation': { en: 'Question Generation', zh: '问题生成' },
  'topic_practice': { en: 'Topic Practice', zh: '话题练习' },
};

const TOOL_DISPLAY_NAMES: Record<string, { en: string; zh: string }> = {
  // CareerPathMatchingAgent 工具
  'analyze_career_trajectory': { en: 'Analyzing career trajectory', zh: '分析职业轨迹' },
  'extract_career_goals': { en: 'Extracting career goals', zh: '提取职业目标' },
  'identify_skill_gaps': { en: 'Identifying skill gaps', zh: '识别技能差距' },
  'search_aligned_positions': { en: 'Searching aligned positions', zh: '搜索匹配职位' },
  'generate_career_fit_reasoning': { en: 'Generating fit reasoning', zh: '生成匹配理由' },
  // AdaptiveFeedbackAgent 工具
  'analyze_position_level': { en: 'Analyzing position level', zh: '分析职位级别' },
  'identify_evaluation_dimensions': { en: 'Identifying evaluation dimensions', zh: '识别评估维度' },
  'extract_user_evidence': { en: 'Extracting user evidence', zh: '提取用户证据' },
  'search_best_practices': { en: 'Searching best practices', zh: '搜索最佳实践' },
  'generate_adaptive_feedback': { en: 'Generating adaptive feedback', zh: '生成自适应反馈' },
  // 外部搜索工具
  'search_linkedin_jobs': { en: 'Searching LinkedIn jobs', zh: '搜索 LinkedIn 职位' },
  'search_glassdoor_company': { en: 'Searching Glassdoor info', zh: '搜索 Glassdoor 信息' },
  // 话题练习工具
  'select_topic': { en: 'Selecting topic', zh: '选择话题' },
  'collect_responses': { en: 'Collecting conversation data', zh: '整理对话内容' },
  'evaluate_skills': { en: 'Evaluating demonstrated skills', zh: '评估技能展示' },
  'search_jobs': { en: 'Searching matching positions', zh: '搜索匹配职位' },
  'compile_report': { en: 'Compiling final report', zh: '整合最终报告' },
  'generate_question': { en: 'Generating question', zh: '生成问题' },
  'detect_intent': { en: 'Detecting intent', zh: '检测意图' },
  'evaluate_response': { en: 'Evaluating response', zh: '评估回答' },
  'generate_followup': { en: 'Generating follow-up', zh: '生成追问' },
  'analyze_performance': { en: 'Analyzing performance', zh: '分析表现' },
  'generate_feedback': { en: 'Generating feedback', zh: '生成反馈' },
  'match_companies': { en: 'Matching companies', zh: '匹配公司' },
};

// ==================== 辅助函数 ====================

function getAgentDisplayName(name: string, language: 'en' | 'zh'): string {
  return AGENT_DISPLAY_NAMES[name]?.[language] || name;
}

function getToolDisplayName(name: string, language: 'en' | 'zh'): string {
  return TOOL_DISPLAY_NAMES[name]?.[language] || name;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ==================== 子组件 ====================

interface StepIndicatorProps {
  status: StepStatus;
  className?: string;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ status, className }) => {
  switch (status) {
    case 'running':
      return <Loader2 className={cn('w-4 h-4 animate-spin text-blue-500', className)} />;
    case 'completed':
      return <CheckCircle className={cn('w-4 h-4 text-green-500', className)} />;
    case 'error':
      return <XCircle className={cn('w-4 h-4 text-red-500', className)} />;
    default:
      return <div className={cn('w-4 h-4 rounded-full bg-gray-300', className)} />;
  }
};

interface StepCardProps {
  step: StreamingStep;
  language: 'en' | 'zh';
  isLast: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ step, language, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={cn(
      'relative pl-6 pb-4',
      !isLast && 'border-l-2 border-gray-200 dark:border-gray-700 ml-2'
    )}>
      {/* 步骤指示器 */}
      <div className="absolute left-0 -translate-x-1/2 bg-white dark:bg-gray-900">
        <StepIndicator status={step.status} />
      </div>
      
      {/* 步骤内容 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 ml-2">
        {/* 步骤头部 */}
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {language === 'zh' ? `步骤 ${step.step}` : `Step ${step.step}`}
            </span>
            {step.action && (
              <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                <Wrench className="w-3 h-3" />
                {getToolDisplayName(step.action.tool, language)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step.durationMs && (
              <span className="text-xs text-gray-400">
                {formatDuration(step.durationMs)}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
        
        {/* 思考内容预览 */}
        {step.thought && !isExpanded && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
            {step.thought}
          </p>
        )}
        
        {/* 展开的详细内容 */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* 思考 */}
            {step.thought && (
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <Brain className="w-3 h-3" />
                  {language === 'zh' ? '思考' : 'Thought'}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                  {step.thought}
                </p>
              </div>
            )}
            
            {/* 行动参数 */}
            {step.action && (
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <Wrench className="w-3 h-3" />
                  {language === 'zh' ? '行动参数' : 'Action Parameters'}
                </div>
                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                  {JSON.stringify(step.action.params, null, 2)}
                </pre>
              </div>
            )}
            
            {/* 观察结果 */}
            {step.observation && (
              <div>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                  <Eye className="w-3 h-3" />
                  {language === 'zh' ? '观察结果' : 'Observation'}
                </div>
                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto max-h-40">
                  {step.observation.length > 500 
                    ? step.observation.substring(0, 500) + '...' 
                    : step.observation}
                </pre>
              </div>
            )}
            
            {/* 错误信息 */}
            {step.error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {language === 'zh' ? '错误: ' : 'Error: '}{step.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== 主组件 ====================

export const ReActViewer: React.FC<ReActViewerProps> = ({
  agent,
  steps,
  isRunning,
  isExpanded: controlledExpanded,
  onToggleExpand,
  className,
  language = 'en',
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 支持受控和非受控模式
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpand = onToggleExpand || (() => setInternalExpanded(!internalExpanded));
  
  // 自动滚动到最新步骤
  useEffect(() => {
    if (isExpanded && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps, isExpanded]);
  
  // 获取当前状态描述
  const getCurrentStatus = () => {
    if (!isRunning && steps.length === 0) {
      return language === 'zh' ? '等待开始...' : 'Waiting to start...';
    }
    
    const runningStep = steps.find(s => s.status === 'running');
    if (runningStep) {
      if (runningStep.action) {
        return getToolDisplayName(runningStep.action.tool, language);
      }
      return language === 'zh' ? '正在思考...' : 'Thinking...';
    }
    
    if (!isRunning && steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      if (lastStep.status === 'error') {
        return language === 'zh' ? '执行出错' : 'Execution error';
      }
      return language === 'zh' ? '完成' : 'Completed';
    }
    
    return language === 'zh' ? '处理中...' : 'Processing...';
  };
  
  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
      className
    )}>
      {/* 头部 - 始终显示 */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-3">
          {/* Agent 图标和状态 */}
          <div className="relative">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isRunning ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'
            )}>
              <Brain className={cn(
                'w-4 h-4',
                isRunning ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
              )} />
            </div>
            {isRunning && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            )}
          </div>
          
          {/* Agent 名称和状态 */}
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {getAgentDisplayName(agent.name, language)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
              {getCurrentStatus()}
            </div>
          </div>
        </div>
        
        {/* 展开/收起按钮 */}
        <div className="flex items-center gap-2">
          {steps.length > 0 && (
            <span className="text-xs text-gray-400">
              {steps.length} {language === 'zh' ? '步' : 'steps'}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
      
      {/* 展开的详细内容 */}
      {isExpanded && (
        <div 
          ref={containerRef}
          className="border-t border-gray-200 dark:border-gray-700 p-4 max-h-96 overflow-y-auto"
        >
          {steps.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              {language === 'zh' ? '暂无思考步骤' : 'No thinking steps yet'}
            </div>
          ) : (
            <div className="space-y-0">
              {steps.map((step, index) => (
                <StepCard 
                  key={step.id} 
                  step={step} 
                  language={language}
                  isLast={index === steps.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== 简化版组件（只显示当前状态） ====================

export interface ReActStatusProps {
  agent: AgentInfo;
  currentStep?: StreamingStep;
  isRunning: boolean;
  language?: 'en' | 'zh';
  className?: string;
}

export const ReActStatus: React.FC<ReActStatusProps> = ({
  agent,
  currentStep,
  isRunning,
  language = 'en',
  className,
}) => {
  if (!isRunning && !currentStep) return null;
  
  const getStatusText = () => {
    if (!isRunning) {
      return language === 'zh' ? '完成' : 'Completed';
    }
    if (currentStep?.action) {
      return getToolDisplayName(currentStep.action.tool, language);
    }
    return language === 'zh' ? '正在思考...' : 'Thinking...';
  };
  
  return (
    <div className={cn(
      'flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400',
      className
    )}>
      {isRunning ? (
        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      ) : (
        <CheckCircle className="w-4 h-4 text-green-500" />
      )}
      <span>{getAgentDisplayName(agent.name, language)}: {getStatusText()}</span>
    </div>
  );
};

export default ReActViewer;
