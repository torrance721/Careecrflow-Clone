/**
 * 双模式面试系统 - 核心类型定义
 * 
 * 设计原则：
 * 1. 非阻塞设计：用户随时可换话题或结束
 * 2. 信息点驱动：围绕"主要信息点"判定，而非轮次
 * 3. 专业反馈：展示 UHired 专业能力
 */

// ==================== 话题相关类型 ====================

/**
 * 话题状态
 * - collecting: 正在收集信息
 * - collected: 信息已收集完成，可以给反馈
 * - abandoned: 用户无法/不愿提供信息
 * - engaged: 聊得投机，超过 5 轮但用户意愿高
 */
export type TopicStatus = 'collecting' | 'collected' | 'abandoned' | 'engaged';

/**
 * 用户意图
 * - continue: 继续当前话题
 * - switch_topic: 换个话题
 * - end_interview: 结束面试
 * - need_hint: 需要提示
 * - view_feedback: 查看反馈
 */
export type UserIntent = 'continue' | 'switch_topic' | 'end_interview' | 'need_hint' | 'view_feedback';

/**
 * 话题上下文 - 单个话题的完整状态
 */
export interface TopicContext {
  /** 话题 ID */
  id: string;
  
  /** 话题名称（如 "SQL能力"、"项目经验"） */
  name: string;
  
  /** 话题状态 */
  status: TopicStatus;
  
  /** 开始时间 */
  startedAt: string;
  
  /** 结束时间 */
  endedAt?: string;
  
  /** 对话历史（仅该话题内） */
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  
  /** 已收集的信息点 */
  collectedInfo: CollectedInfoPoint[];
  
  /** 话题来源（如 "Google 真实面试问题"） */
  source?: string;
  
  /** 考核的能力维度 */
  targetSkills: string[];
  
  /** 题目难度级别 */
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * 已收集的信息点
 */
export interface CollectedInfoPoint {
  /** 信息类型（如 "技能声明"、"项目经历"、"量化成果"） */
  type: 'skill_claim' | 'project_experience' | 'quantified_result' | 'challenge_solution' | 'learning' | 'other';
  
  /** 信息内容摘要 */
  summary: string;
  
  /** 信息深度（1-5） */
  depth: number;
  
  /** 是否需要进一步追问 */
  needsFollowUp: boolean;
  
  /** 追问方向（如果需要） */
  followUpDirection?: string;
}

// ==================== 反馈相关类型 ====================

/**
 * 话题反馈 - 单个话题完成后的专业反馈
 */
export interface TopicFeedback {
  /** 话题 ID */
  topicId: string;
  
  /** 问题来源说明 */
  questionSource: {
    /** 来源公司（如 "Google", "Meta"） */
    company?: string;
    /** 来源描述 */
    description: string;
    /** 问题频率（如 "高频问题"） */
    frequency?: 'high' | 'medium' | 'low';
  };
  
  /** 考核能力说明 */
  targetAbility: {
    /** 主要考核能力 */
    primary: string;
    /** 次要考核能力 */
    secondary: string[];
    /** 为什么考核这个能力 */
    rationale: string;
  };
  
  /** 表现分析 */
  performanceAnalysis: {
    /** 做得好的点 */
    strengths: string[];
    /** 缺少的点 */
    gaps: string[];
    /** 具体分析 */
    details: string;
  };
  
  /** 改进建议 */
  improvementSuggestions: {
    /** 立即可做的改进 */
    immediate: string[];
    /** 长期提升方向 */
    longTerm: string[];
    /** 推荐的学习资源 */
    resources?: string[];
  };
  
  /** 评分（1-10） */
  score: number;
}

/**
 * 公司匹配推荐
 */
export interface CompanyMatch {
  /** 公司名称 */
  company: string;
  
  /** 职位名称 */
  jobTitle?: string;
  
  /** LinkedIn 职位链接 */
  linkedinUrl?: string;
  
  /** 匹配度（0-100） */
  matchScore: number;
  
  /** 匹配原因 */
  reasons: string[];
  
  /** 该公司看重的能力 */
  keySkills: string[];
  
  /** 建议的准备方向 */
  preparationTips: string[];
}

// ==================== 高保真面试相关类型 ====================

/**
 * 面试轮次类型
 */
export type InterviewRound = 
  | 'phone_screen'      // 电话筛选
  | 'technical'         // 技术面
  | 'behavioral'        // 行为面
  | 'system_design'     // 系统设计
  | 'case_study'        // 案例分析
  | 'hiring_manager'    // 招聘经理面
  | 'culture_fit';      // 文化匹配

/**
 * 高保真面试配置
 */
export interface FullInterviewConfig {
  /** 目标公司 */
  company: string;
  
  /** 目标职位 */
  position: string;
  
  /** 面试轮次 */
  round: InterviewRound;
  
  /** 时间限制（分钟，可选） */
  timeLimit?: 30 | 45 | 60;
  
  /** 面试官人设 */
  interviewerPersona?: {
    name: string;
    title: string;
    style: 'friendly' | 'neutral' | 'challenging';
  };
  
  /** 要覆盖的话题列表 */
  topicsTocover: string[];
}

/**
 * 高保真面试状态
 */
export interface FullInterviewState {
  /** 配置 */
  config: FullInterviewConfig;
  
  /** 开始时间 */
  startedAt: string;
  
  /** 剩余时间（秒） */
  remainingTime?: number;
  
  /** 已完成的话题 */
  completedTopics: TopicContext[];
  
  /** 当前话题 */
  currentTopic?: TopicContext;
  
  /** 待覆盖的话题 */
  pendingTopics: string[];
  
  /** 是否已结束 */
  ended: boolean;
  
  /** 结束原因 */
  endReason?: 'completed' | 'time_up' | 'user_ended';
}

/**
 * 高保真面试完整评估
 */
export interface FullInterviewAssessment {
  /** 面试配置 */
  config: FullInterviewConfig;
  
  /** 各话题反馈 */
  topicFeedbacks: TopicFeedback[];
  
  /** 多维度评分 */
  dimensionScores: {
    dimension: string;
    score: number;
    maxScore: number;
    comment: string;
  }[];
  
  /** 能力雷达图数据 */
  radarData: {
    label: string;
    value: number;
    benchmark: number; // 该公司平均水平
  }[];
  
  /** 竞争力分析 */
  competitiveness: {
    /** 百分位排名（如 "优于 75% 的候选人"） */
    percentile: number;
    /** 分析说明 */
    analysis: string;
  };
  
  /** 录用可能性预测 */
  hiringPrediction: {
    /** 可能性（0-100） */
    probability: number;
    /** 关键因素 */
    keyFactors: {
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      weight: number;
    }[];
  };
  
  /** 针对该公司的行动计划 */
  actionPlan: {
    /** 优先级 */
    priority: 'high' | 'medium' | 'low';
    /** 行动项 */
    action: string;
    /** 预期效果 */
    expectedImpact: string;
    /** 建议时间 */
    suggestedTimeframe: string;
  }[];
  
  /** 整体评语 */
  overallComment: string;
}

// ==================== 面试模式类型 ====================

/**
 * 面试模式
 */
export type InterviewMode = 'topic_practice' | 'full_interview';

/**
 * 面试会话
 */
export interface InterviewSession {
  /** 会话 ID */
  id: string;
  
  /** 用户 ID */
  userId: string;
  
  /** 面试模式 */
  mode: InterviewMode;
  
  /** 目标职位 */
  targetPosition: string;
  
  /** 目标公司（高保真模式必填） */
  targetCompany?: string;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 话题练习模式状态 */
  topicPractice?: {
    completedTopics: TopicContext[];
    currentTopic?: TopicContext;
    feedbacks: TopicFeedback[];
    companyMatches: CompanyMatch[];
  };
  
  /** 高保真面试模式状态 */
  fullInterview?: FullInterviewState;
  
  /** 最终评估（高保真模式） */
  assessment?: FullInterviewAssessment;
}
