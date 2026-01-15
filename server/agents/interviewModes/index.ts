/**
 * 双模式面试系统
 * 
 * 模式一：话题练习 (Topic Practice)
 * - 快速练习单个话题
 * - 即时获得专业反馈
 * - 基于技能匹配公司推荐
 * 
 * 模式二：高保真面试 (Full Interview Simulation)
 * - 模拟真实公司面试流程
 * - 多话题覆盖
 * - 完整多维度评估
 * 
 * 核心设计原则：
 * - 非阻塞设计：用户随时可换话题或结束
 * - 信息点驱动：围绕"主要信息点"判定，而非轮次
 * - 专业反馈：展示 UHired 专业能力
 */

// 类型导出
export * from './types';

// 话题状态评估
export {
  evaluateTopicStatus,
  detectUserIntent,
  detectEndIntent,
  suggestNextTopic
} from './topicStatusEvaluator';

// 话题反馈生成
export {
  generateTopicFeedback,
  generateCompanyMatches,
  generateTopicTransition,
  generateEncouragementFeedback
} from './topicFeedbackGenerator';

// 高保真面试流程控制
export {
  getCompanyInterviewStyle,
  initializeFullInterview,
  startNewTopic,
  completeTopic,
  endInterviewEarly,
  shouldEndInterview,
  updateRemainingTime,
  generateInterviewOpening,
  generateTopicQuestion,
  generateTimeReminder
} from './fullInterviewOrchestrator';

// 多维度评估
export {
  generateFullAssessment,
  generateAllTopicFeedbacks
} from './multiDimensionEvaluator';
