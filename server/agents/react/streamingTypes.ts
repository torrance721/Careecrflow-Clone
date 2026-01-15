/**
 * ReAct Agent 流式输出类型定义
 * 
 * 支持实时展示思考过程，类似 ChatGPT 思维链
 */

// ==================== 思考步骤状态 ====================

export type StepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface StreamingStep {
  id: string;
  step: number;
  status: StepStatus;
  thought?: string;
  action?: {
    tool: string;
    toolDisplayName: string;  // 用户友好的工具名称
    params: Record<string, unknown>;
  };
  observation?: string;
  error?: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
}

// ==================== 流式事件类型 ====================

export type StreamEventType = 
  | 'agent_start'      // Agent 开始执行
  | 'step_start'       // 步骤开始
  | 'thought'          // 思考内容更新
  | 'action_start'     // 开始执行工具
  | 'action_complete'  // 工具执行完成
  | 'step_complete'    // 步骤完成
  | 'agent_complete'   // Agent 执行完成
  | 'error';           // 错误

export interface BaseStreamEvent {
  type: StreamEventType;
  timestamp: number;
  agentName: string;
  agentDisplayName: string;  // 用户友好的 Agent 名称
}

export interface AgentStartEvent extends BaseStreamEvent {
  type: 'agent_start';
  totalSteps?: number;  // 预估总步骤数
  description: string;  // Agent 正在做什么的描述
}

export interface StepStartEvent extends BaseStreamEvent {
  type: 'step_start';
  stepId: string;
  stepNumber: number;
}

export interface ThoughtEvent extends BaseStreamEvent {
  type: 'thought';
  stepId: string;
  thought: string;
  isPartial?: boolean;  // 是否是部分内容（流式输出）
}

export interface ActionStartEvent extends BaseStreamEvent {
  type: 'action_start';
  stepId: string;
  tool: string;
  toolDisplayName: string;
  params: Record<string, unknown>;
}

export interface ActionCompleteEvent extends BaseStreamEvent {
  type: 'action_complete';
  stepId: string;
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface StepCompleteEvent extends BaseStreamEvent {
  type: 'step_complete';
  stepId: string;
  stepNumber: number;
  durationMs: number;
}

export interface AgentCompleteEvent extends BaseStreamEvent {
  type: 'agent_complete';
  success: boolean;
  result?: unknown;
  error?: string;
  totalDurationMs: number;
  totalSteps: number;
}

export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  stepId?: string;
  error: string;
  recoverable: boolean;
}

export type StreamEvent = 
  | AgentStartEvent
  | StepStartEvent
  | ThoughtEvent
  | ActionStartEvent
  | ActionCompleteEvent
  | StepCompleteEvent
  | AgentCompleteEvent
  | ErrorEvent;

// ==================== 流式输出回调 ====================

export type StreamCallback = (event: StreamEvent) => void;

// ==================== Agent 显示名称映射 ====================

export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'career_path_matching': '职业路径匹配',
  'adaptive_feedback': '自适应反馈生成',
  'job_recommendation': '职位推荐',
  'feedback_generation': '反馈生成',
  'hint_agent': '提示生成',
  'question_generation': '问题生成',
};

// ==================== 工具显示名称映射 ====================

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // CareerPathMatchingAgent 工具
  'analyze_career_trajectory': '分析职业轨迹',
  'extract_career_goals': '提取职业目标',
  'identify_skill_gaps': '识别技能差距',
  'search_aligned_positions': '搜索匹配职位',
  'generate_career_fit_reasoning': '生成匹配理由',
  
  // AdaptiveFeedbackAgent 工具
  'analyze_position_level': '分析职位级别',
  'identify_evaluation_dimensions': '识别评估维度',
  'extract_user_evidence': '提取用户证据',
  'search_best_practices': '搜索最佳实践',
  'generate_adaptive_feedback': '生成自适应反馈',
  
  // 其他工具
  'search_linkedin_jobs': '搜索 LinkedIn 职位',
  'search_glassdoor_company': '搜索 Glassdoor 公司信息',
  'analyze_skill_match': '分析技能匹配',
  'generate_recommendation_reason': '生成推荐理由',
};

// ==================== 辅助函数 ====================

export function getAgentDisplayName(agentName: string): string {
  return AGENT_DISPLAY_NAMES[agentName] || agentName;
}

export function getToolDisplayName(toolName: string): string {
  return TOOL_DISPLAY_NAMES[toolName] || toolName;
}

export function createStreamEvent<T extends StreamEvent>(
  type: T['type'],
  agentName: string,
  data: Omit<T, 'type' | 'timestamp' | 'agentName' | 'agentDisplayName'>
): T {
  return {
    type,
    timestamp: Date.now(),
    agentName,
    agentDisplayName: getAgentDisplayName(agentName),
    ...data,
  } as T;
}
