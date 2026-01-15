/**
 * ReAct Agent Framework - Type Definitions
 * 
 * ReAct = Reasoning + Acting
 * 每个模块可以：思考 → 使用工具 → 观察结果 → 继续思考
 */

// ==================== 时间预算配置 ====================

export interface TimeBudget {
  maxTimeMs: number;           // 最大等待时间（毫秒）
  priority: 'speed' | 'quality' | 'balanced';  // 优先级
  warningThresholdMs?: number; // 警告阈值
}

export const TIME_BUDGETS: Record<string, TimeBudget> = {
  // 用户面对的模块（需要快速响应）
  question_generation: {
    maxTimeMs: 10000,  // 10秒
    priority: 'quality',
    warningThresholdMs: 7000,
  },
  hint_system: {
    maxTimeMs: 3000,   // 3秒
    priority: 'speed',
    warningThresholdMs: 2000,
  },
  next_question: {
    maxTimeMs: 5000,   // 5秒
    priority: 'balanced',
    warningThresholdMs: 3500,
  },
  response_analysis: {
    maxTimeMs: 5000,   // 5秒
    priority: 'quality',
    warningThresholdMs: 3500,
  },
  
  // Agent Loop 模块（后台运行，可以慢）
  persona_generation: {
    maxTimeMs: 30000,  // 30秒
    priority: 'quality',
  },
  interview_simulation: {
    maxTimeMs: 300000, // 5分钟
    priority: 'quality',
  },
  feedback_generation: {
    maxTimeMs: 60000,  // 1分钟
    priority: 'quality',
  },
  prompt_optimization: {
    maxTimeMs: 120000, // 2分钟
    priority: 'quality',
  },
};

// ==================== 工具定义 ====================

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
  estimatedTimeMs?: number;  // 预估执行时间
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
}

// ==================== ReAct 思考步骤 ====================

export interface ThoughtStep {
  step: number;
  thought: string;           // 当前思考内容
  action?: {
    tool: string;            // 使用的工具
    params: Record<string, unknown>;
  };
  observation?: string;      // 工具返回的观察结果
  timeSpentMs: number;
}

export interface ReActTrace {
  steps: ThoughtStep[];
  totalTimeMs: number;
  finalAnswer?: unknown;
  earlyStop: boolean;
  earlyStopReason?: string;
}

// ==================== ReAct 配置 ====================

export interface ReActConfig {
  // 模块标识
  moduleName: string;
  
  // 思维链配置
  thinking: {
    maxSteps: number;           // 最大思考步数
    requiredThoughts?: string[]; // 必须思考的问题
    adaptiveDepth: boolean;     // 是否动态调整深度
  };
  
  // 工具配置
  tools: Tool[];
  
  // 时间配置
  timeBudget: TimeBudget;
  
  // 质量配置
  quality: {
    minScore?: number;           // 最低质量分数
    earlyStopOnQuality: boolean; // 达到质量阈值提前停止
  };
}

// ==================== Multi-Grader 评估 ====================

export interface RuleGrader {
  type: 'rule';
  name: string;
  description: string;
  check: (output: unknown, context: unknown) => number; // 0-1
}

export interface LLMGrader {
  type: 'llm_judge';
  name: string;
  description: string;
  prompt: string;
}

export interface SimilarityGrader {
  type: 'similarity';
  name: string;
  description: string;
  threshold: number;
  compareWith: string[];  // 与哪些历史输出比较
}

export type Grader = RuleGrader | LLMGrader | SimilarityGrader;

export interface MultiGraderConfig {
  graders: Grader[];
  aggregation: 'average' | 'min' | 'weighted';
  weights?: Record<string, number>;
}

export interface GradeResult {
  overallScore: number;
  details: Array<{
    graderName: string;
    score: number;
    feedback?: string;
  }>;
}

// ==================== Agent 状态 ====================

export interface AgentState {
  context: Record<string, unknown>;  // 上下文信息
  trace: ReActTrace;                 // 思考轨迹
  remainingTimeMs: number;           // 剩余时间
  currentStep: number;
}

// ==================== 执行结果 ====================

export interface AgentResult<T = unknown> {
  success: boolean;
  output?: T;
  trace: ReActTrace;
  grade?: GradeResult;
  error?: string;
}
