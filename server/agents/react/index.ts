/**
 * ReAct Agent Framework
 * 
 * 导出所有 ReAct 相关的类型、工具和 Agent
 */

// 类型定义
export * from './types';

// 时间预算管理
export { 
  TimeBudgetManager, 
  createTimeBudget, 
  withTimeBudget 
} from './timeBudgetManager';

// Multi-Grader 评估系统
export { 
  MultiGrader, 
  createMultiGrader,
  questionGenerationGraders,
  hintSystemGraders,
  nextQuestionGraders,
} from './multiGrader';

// 基础 Agent
export { BaseReActAgent } from './baseAgent';

// 问题生成 Agent
export { 
  QuestionGenerationAgent,
  generateQuestionWithReAct,
  generateQuestionsWithReAct,
  type QuestionGenerationInput,
  type GeneratedQuestion,
} from './questionGenerationAgent';

// Hint Agent
export {
  HintAgent,
  generateHintWithReAct,
  type HintInput,
  type GeneratedHint,
} from './hintAgent';

// Next Question Agent
export {
  NextQuestionAgent,
  decideNextQuestionWithReAct,
  type NextQuestionInput,
  type NextQuestionDecision,
} from './nextQuestionAgent';

// 工具
export { questionGenerationTools } from './tools/questionTools';
export { 
  toolDiscoveryTools, 
  toolRegistry, 
  discoverTools, 
  generateToolCode,
  createToolFromCode,
} from './tools/toolDiscovery';

// 集成适配器
export {
  setIntegrationConfig,
  getIntegrationConfig,
  generateInterviewPlanWithReAct,
  generateHintWithReActAdapter,
  generateNextQuestionWithReAct,
  generateInterviewPlanSmart,
  generateHintSmart,
  generateNextQuestionSmart,
} from './integration';
