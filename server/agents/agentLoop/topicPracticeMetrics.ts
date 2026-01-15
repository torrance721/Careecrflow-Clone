/**
 * Topic Practice Evaluation Metrics
 * 
 * 话题练习模式的评估指标定义和计算逻辑
 * 
 * 核心指标：
 * 1. 职位推荐满意度 - 推荐的职位是否合适、理由是否有说服力
 * 2. 反馈时机满意度 - 结束话题的时机是否合适
 * 3. 提示质量 - 提示是否详细、有帮助
 * 4. 整体体验满意度 - 综合评价
 */

import { MockPersona, TARGET_USER_CONSTRAINTS } from './personaGenerator';
import { TopicPracticeSimulationResult, TopicPracticeFeedback } from './topicPracticeSimulator';

// ==================== 评估指标类型 ====================

export interface TopicPracticeMetrics {
  // 核心指标
  jobRecommendationSatisfaction: number; // 1-10, 职位推荐满意度
  feedbackTimingSatisfaction: number; // 1-10, 反馈时机满意度
  hintQuality: number; // 1-10, 提示质量
  overallSatisfaction: number; // 1-10, 整体满意度
  
  // 行为指标
  averageRoundsPerTopic: number; // 平均每个话题的轮次
  hintUsageRate: number; // 提示使用率
  topicCompletionRate: number; // 话题完成率（非放弃）
  abandonmentRate: number; // 放弃率
  
  // 信任度相关指标
  trustLevelImpact: {
    lowTrust: { count: number; avgSatisfaction: number; avgRounds: number };
    mediumTrust: { count: number; avgSatisfaction: number; avgRounds: number };
    highTrust: { count: number; avgSatisfaction: number; avgRounds: number };
  };
  
  // 推荐指标
  wouldRecommendRate: number; // 推荐率
}

export interface TopicPracticeEvaluationConfig {
  // 目标指标
  targetJobRecommendationSatisfaction: number; // 默认 8
  targetFeedbackTimingSatisfaction: number; // 默认 8
  targetOverallSatisfaction: number; // 默认 8
  targetWouldRecommendRate: number; // 默认 80%
  
  // 质量门控
  qualityGates: {
    minJobRecommendationSatisfaction: number; // 最低职位推荐满意度
    minFeedbackTimingSatisfaction: number; // 最低反馈时机满意度
    maxAbandonmentRate: number; // 最大放弃率
    minTopicCompletionRate: number; // 最小话题完成率
  };
  
  // 信任度权重（低信任度用户的满意度更重要）
  trustLevelWeights: {
    low: number; // 低信任度权重
    medium: number; // 中信任度权重
    high: number; // 高信任度权重
  };
}

// ==================== 默认配置 ====================

export const DEFAULT_TOPIC_PRACTICE_CONFIG: TopicPracticeEvaluationConfig = {
  targetJobRecommendationSatisfaction: 8,
  targetFeedbackTimingSatisfaction: 8,
  targetOverallSatisfaction: 8,
  targetWouldRecommendRate: 80,
  
  qualityGates: {
    minJobRecommendationSatisfaction: 7,
    minFeedbackTimingSatisfaction: 7,
    maxAbandonmentRate: 0.2, // 最多 20% 放弃率
    minTopicCompletionRate: 0.8, // 至少 80% 完成率
  },
  
  // 低信任度用户的满意度权重更高（更难满足）
  trustLevelWeights: {
    low: 0.5, // 低信任度用户占 50% 权重
    medium: 0.3, // 中信任度用户占 30% 权重
    high: 0.2, // 高信任度用户占 20% 权重
  },
};

// ==================== 指标计算函数 ====================

/**
 * 计算单个模拟的指标
 */
export function calculateSimulationMetrics(
  result: TopicPracticeSimulationResult
): Partial<TopicPracticeMetrics> {
  const topicFeedbacks = result.topics
    .filter(t => t.feedback !== null)
    .map(t => t.feedback as TopicPracticeFeedback);
  
  // 职位推荐满意度
  const jobRecommendationSatisfaction = topicFeedbacks.length > 0
    ? topicFeedbacks.reduce((sum, f) => sum + f.recommendationQuality, 0) / topicFeedbacks.length
    : 0;
  
  // 反馈时机满意度
  const feedbackTimingSatisfaction = topicFeedbacks.length > 0
    ? topicFeedbacks.filter(f => f.timingAppropriate).length / topicFeedbacks.length * 10
    : 0;
  
  // 提示使用率
  const totalHints = result.topics.reduce((sum, t) => sum + t.hintsUsed, 0);
  const totalRounds = result.topics.reduce((sum, t) => sum + t.rounds, 0);
  const hintUsageRate = totalRounds > 0 ? totalHints / totalRounds : 0;
  
  // 平均每个话题的轮次
  const averageRoundsPerTopic = result.topics.length > 0
    ? totalRounds / result.topics.length
    : 0;
  
  // 话题完成率和放弃率
  const completedTopics = result.topics.filter(t => t.feedback !== null).length;
  const topicCompletionRate = result.topics.length > 0
    ? completedTopics / result.topics.length
    : 0;
  const abandonmentRate = 1 - topicCompletionRate;
  
  return {
    jobRecommendationSatisfaction,
    feedbackTimingSatisfaction,
    hintUsageRate,
    averageRoundsPerTopic,
    topicCompletionRate,
    abandonmentRate,
    overallSatisfaction: result.overallFeedback.satisfaction,
    wouldRecommendRate: result.overallFeedback.wouldRecommend ? 100 : 0,
  };
}

/**
 * 聚合多个模拟的指标
 */
export function aggregateMetrics(
  results: TopicPracticeSimulationResult[],
  config: TopicPracticeEvaluationConfig = DEFAULT_TOPIC_PRACTICE_CONFIG
): TopicPracticeMetrics {
  if (results.length === 0) {
    return createEmptyMetrics();
  }
  
  // 按信任度分组
  const lowTrustResults = results.filter(r => r.persona.personality.trustLevel <= 3);
  const mediumTrustResults = results.filter(r => 
    r.persona.personality.trustLevel > 3 && r.persona.personality.trustLevel <= 6
  );
  const highTrustResults = results.filter(r => r.persona.personality.trustLevel > 6);
  
  // 计算各组指标
  const lowTrustMetrics = calculateGroupMetrics(lowTrustResults);
  const mediumTrustMetrics = calculateGroupMetrics(mediumTrustResults);
  const highTrustMetrics = calculateGroupMetrics(highTrustResults);
  
  // 加权计算总体指标
  const weights = config.trustLevelWeights;
  const totalWeight = 
    (lowTrustResults.length > 0 ? weights.low : 0) +
    (mediumTrustResults.length > 0 ? weights.medium : 0) +
    (highTrustResults.length > 0 ? weights.high : 0);
  
  const weightedSatisfaction = (
    (lowTrustResults.length > 0 ? lowTrustMetrics.avgSatisfaction * weights.low : 0) +
    (mediumTrustResults.length > 0 ? mediumTrustMetrics.avgSatisfaction * weights.medium : 0) +
    (highTrustResults.length > 0 ? highTrustMetrics.avgSatisfaction * weights.high : 0)
  ) / (totalWeight || 1);
  
  // 计算其他聚合指标
  const allMetrics = results.map(r => calculateSimulationMetrics(r));
  
  return {
    jobRecommendationSatisfaction: average(allMetrics.map(m => m.jobRecommendationSatisfaction || 0)),
    feedbackTimingSatisfaction: average(allMetrics.map(m => m.feedbackTimingSatisfaction || 0)),
    hintQuality: average(results.map(r => r.metrics.averageFeedbackQuality)),
    overallSatisfaction: weightedSatisfaction,
    
    averageRoundsPerTopic: average(allMetrics.map(m => m.averageRoundsPerTopic || 0)),
    hintUsageRate: average(allMetrics.map(m => m.hintUsageRate || 0)),
    topicCompletionRate: average(allMetrics.map(m => m.topicCompletionRate || 0)),
    abandonmentRate: average(allMetrics.map(m => m.abandonmentRate || 0)),
    
    trustLevelImpact: {
      lowTrust: {
        count: lowTrustResults.length,
        avgSatisfaction: lowTrustMetrics.avgSatisfaction,
        avgRounds: lowTrustMetrics.avgRounds,
      },
      mediumTrust: {
        count: mediumTrustResults.length,
        avgSatisfaction: mediumTrustMetrics.avgSatisfaction,
        avgRounds: mediumTrustMetrics.avgRounds,
      },
      highTrust: {
        count: highTrustResults.length,
        avgSatisfaction: highTrustMetrics.avgSatisfaction,
        avgRounds: highTrustMetrics.avgRounds,
      },
    },
    
    wouldRecommendRate: results.filter(r => r.overallFeedback.wouldRecommend).length / results.length * 100,
  };
}

/**
 * 计算一组结果的指标
 */
function calculateGroupMetrics(results: TopicPracticeSimulationResult[]): {
  avgSatisfaction: number;
  avgRounds: number;
} {
  if (results.length === 0) {
    return { avgSatisfaction: 0, avgRounds: 0 };
  }
  
  const avgSatisfaction = average(results.map(r => r.overallFeedback.satisfaction));
  const avgRounds = average(results.map(r => 
    r.topics.reduce((sum, t) => sum + t.rounds, 0) / r.topics.length
  ));
  
  return { avgSatisfaction, avgRounds };
}

/**
 * 检查质量门控
 */
export function checkTopicPracticeQualityGates(
  metrics: TopicPracticeMetrics,
  config: TopicPracticeEvaluationConfig = DEFAULT_TOPIC_PRACTICE_CONFIG
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const gates = config.qualityGates;
  
  if (metrics.jobRecommendationSatisfaction < gates.minJobRecommendationSatisfaction) {
    failures.push(
      `职位推荐满意度 ${metrics.jobRecommendationSatisfaction.toFixed(1)} < ${gates.minJobRecommendationSatisfaction}`
    );
  }
  
  if (metrics.feedbackTimingSatisfaction < gates.minFeedbackTimingSatisfaction) {
    failures.push(
      `反馈时机满意度 ${metrics.feedbackTimingSatisfaction.toFixed(1)} < ${gates.minFeedbackTimingSatisfaction}`
    );
  }
  
  if (metrics.abandonmentRate > gates.maxAbandonmentRate) {
    failures.push(
      `放弃率 ${(metrics.abandonmentRate * 100).toFixed(0)}% > ${gates.maxAbandonmentRate * 100}%`
    );
  }
  
  if (metrics.topicCompletionRate < gates.minTopicCompletionRate) {
    failures.push(
      `话题完成率 ${(metrics.topicCompletionRate * 100).toFixed(0)}% < ${gates.minTopicCompletionRate * 100}%`
    );
  }
  
  return { passed: failures.length === 0, failures };
}

/**
 * 检查是否达到目标
 */
export function checkTargetsMet(
  metrics: TopicPracticeMetrics,
  config: TopicPracticeEvaluationConfig = DEFAULT_TOPIC_PRACTICE_CONFIG
): { met: boolean; details: string[] } {
  const details: string[] = [];
  let allMet = true;
  
  if (metrics.jobRecommendationSatisfaction >= config.targetJobRecommendationSatisfaction) {
    details.push(`✅ 职位推荐满意度: ${metrics.jobRecommendationSatisfaction.toFixed(1)} >= ${config.targetJobRecommendationSatisfaction}`);
  } else {
    details.push(`❌ 职位推荐满意度: ${metrics.jobRecommendationSatisfaction.toFixed(1)} < ${config.targetJobRecommendationSatisfaction}`);
    allMet = false;
  }
  
  if (metrics.feedbackTimingSatisfaction >= config.targetFeedbackTimingSatisfaction) {
    details.push(`✅ 反馈时机满意度: ${metrics.feedbackTimingSatisfaction.toFixed(1)} >= ${config.targetFeedbackTimingSatisfaction}`);
  } else {
    details.push(`❌ 反馈时机满意度: ${metrics.feedbackTimingSatisfaction.toFixed(1)} < ${config.targetFeedbackTimingSatisfaction}`);
    allMet = false;
  }
  
  if (metrics.overallSatisfaction >= config.targetOverallSatisfaction) {
    details.push(`✅ 整体满意度: ${metrics.overallSatisfaction.toFixed(1)} >= ${config.targetOverallSatisfaction}`);
  } else {
    details.push(`❌ 整体满意度: ${metrics.overallSatisfaction.toFixed(1)} < ${config.targetOverallSatisfaction}`);
    allMet = false;
  }
  
  if (metrics.wouldRecommendRate >= config.targetWouldRecommendRate) {
    details.push(`✅ 推荐率: ${metrics.wouldRecommendRate.toFixed(0)}% >= ${config.targetWouldRecommendRate}%`);
  } else {
    details.push(`❌ 推荐率: ${metrics.wouldRecommendRate.toFixed(0)}% < ${config.targetWouldRecommendRate}%`);
    allMet = false;
  }
  
  return { met: allMet, details };
}

/**
 * 生成评估报告
 */
export function generateEvaluationReport(
  metrics: TopicPracticeMetrics,
  config: TopicPracticeEvaluationConfig = DEFAULT_TOPIC_PRACTICE_CONFIG
): string {
  const qualityGates = checkTopicPracticeQualityGates(metrics, config);
  const targets = checkTargetsMet(metrics, config);
  
  let report = `
╔══════════════════════════════════════════════════════════════════╗
║              话题练习模式评估报告                                  ║
╠══════════════════════════════════════════════════════════════════╣
║ 核心指标                                                          ║
║  - 职位推荐满意度: ${metrics.jobRecommendationSatisfaction.toFixed(1)}/10                                    ║
║  - 反馈时机满意度: ${metrics.feedbackTimingSatisfaction.toFixed(1)}/10                                    ║
║  - 提示质量: ${metrics.hintQuality.toFixed(1)}/10                                           ║
║  - 整体满意度: ${metrics.overallSatisfaction.toFixed(1)}/10                                       ║
╠══════════════════════════════════════════════════════════════════╣
║ 行为指标                                                          ║
║  - 平均轮次/话题: ${metrics.averageRoundsPerTopic.toFixed(1)}                                      ║
║  - 提示使用率: ${(metrics.hintUsageRate * 100).toFixed(0)}%                                         ║
║  - 话题完成率: ${(metrics.topicCompletionRate * 100).toFixed(0)}%                                         ║
║  - 放弃率: ${(metrics.abandonmentRate * 100).toFixed(0)}%                                             ║
╠══════════════════════════════════════════════════════════════════╣
║ 信任度影响                                                        ║
║  - 低信任度 (n=${metrics.trustLevelImpact.lowTrust.count}): 满意度 ${metrics.trustLevelImpact.lowTrust.avgSatisfaction.toFixed(1)}, 平均 ${metrics.trustLevelImpact.lowTrust.avgRounds.toFixed(1)} 轮    ║
║  - 中信任度 (n=${metrics.trustLevelImpact.mediumTrust.count}): 满意度 ${metrics.trustLevelImpact.mediumTrust.avgSatisfaction.toFixed(1)}, 平均 ${metrics.trustLevelImpact.mediumTrust.avgRounds.toFixed(1)} 轮    ║
║  - 高信任度 (n=${metrics.trustLevelImpact.highTrust.count}): 满意度 ${metrics.trustLevelImpact.highTrust.avgSatisfaction.toFixed(1)}, 平均 ${metrics.trustLevelImpact.highTrust.avgRounds.toFixed(1)} 轮    ║
╠══════════════════════════════════════════════════════════════════╣
║ 推荐率: ${metrics.wouldRecommendRate.toFixed(0)}%                                                   ║
╠══════════════════════════════════════════════════════════════════╣
║ 质量门控: ${qualityGates.passed ? '✅ 全部通过' : '❌ 未通过'}                                        ║
${qualityGates.failures.map(f => `║  - ${f}`).join('\n')}
╠══════════════════════════════════════════════════════════════════╣
║ 目标达成情况                                                      ║
${targets.details.map(d => `║  ${d}`).join('\n')}
╚══════════════════════════════════════════════════════════════════╝
`;
  
  return report;
}

// ==================== 辅助函数 ====================

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function createEmptyMetrics(): TopicPracticeMetrics {
  return {
    jobRecommendationSatisfaction: 0,
    feedbackTimingSatisfaction: 0,
    hintQuality: 0,
    overallSatisfaction: 0,
    averageRoundsPerTopic: 0,
    hintUsageRate: 0,
    topicCompletionRate: 0,
    abandonmentRate: 0,
    trustLevelImpact: {
      lowTrust: { count: 0, avgSatisfaction: 0, avgRounds: 0 },
      mediumTrust: { count: 0, avgSatisfaction: 0, avgRounds: 0 },
      highTrust: { count: 0, avgSatisfaction: 0, avgRounds: 0 },
    },
    wouldRecommendRate: 0,
  };
}

// ==================== 导出 ====================

// 类型已在定义时导出
