/**
 * Topic Practice Agent Loop Runner
 * 
 * 运行话题练习模式的完整 Agent Loop：
 * 1. 生成不同信任度的 Persona
 * 2. 运行话题练习模拟
 * 3. 收集评估数据
 * 4. 生成评估报告
 * 5. 分析结果并提出改进建议
 */

import { generatePersonas, loadExistingPersonas, MockPersona } from './personaGenerator';
import { 
  runTopicPracticeSimulation, 
  runBatchTopicPracticeSimulation,
  analyzeSimulationResults,
  TopicPracticeSimulationResult 
} from './topicPracticeSimulator';
import {
  aggregateMetrics,
  checkTopicPracticeQualityGates,
  checkTargetsMet,
  generateEvaluationReport,
  TopicPracticeMetrics,
  DEFAULT_TOPIC_PRACTICE_CONFIG,
} from './topicPracticeMetrics';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 配置 ====================

export interface TopicPracticeLoopConfig {
  // 迭代控制
  maxIterations: number;
  minIterations: number;
  
  // Persona 配置
  personasPerIteration: number;
  trustLevelDistribution: {
    low: number; // 低信任度 Persona 数量
    medium: number; // 中信任度 Persona 数量
    high: number; // 高信任度 Persona 数量
  };
  
  // 话题配置
  maxTopicsPerPersona: number;
  
  // 收敛检测
  convergenceWindow: number;
  convergenceThreshold: number;
  
  // 目标
  targetSatisfaction: number;
  targetRecommendationRate: number;
}

const DEFAULT_CONFIG: TopicPracticeLoopConfig = {
  maxIterations: 5,
  minIterations: 2,
  personasPerIteration: 3,
  trustLevelDistribution: {
    low: 1, // 1 个低信任度
    medium: 1, // 1 个中信任度
    high: 1, // 1 个高信任度
  },
  maxTopicsPerPersona: 2,
  convergenceWindow: 3,
  convergenceThreshold: 0.5,
  targetSatisfaction: 8,
  targetRecommendationRate: 80,
};

// ==================== 结果类型 ====================

export interface TopicPracticeLoopResult {
  totalIterations: number;
  converged: boolean;
  targetMet: boolean;
  iterations: Array<{
    iteration: number;
    personas: MockPersona[];
    simulations: TopicPracticeSimulationResult[];
    metrics: TopicPracticeMetrics;
    qualityGatesPassed: boolean;
    duration: number;
  }>;
  finalMetrics: TopicPracticeMetrics;
  summary: string;
  improvementSuggestions: string[];
  completedAt: string;
  totalDuration: number;
}

// ==================== 辅助函数 ====================

const RESULTS_DIR = '/home/ubuntu/UHWeb/data/topic-practice-loop-results';

function ensureResultsDir(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function saveResult(result: TopicPracticeLoopResult): string {
  ensureResultsDir();
  const filename = `topic_practice_loop_${Date.now()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

/**
 * 检查是否收敛
 */
function checkConvergence(
  iterations: TopicPracticeLoopResult['iterations'],
  config: TopicPracticeLoopConfig
): { converged: boolean; reason: string } {
  if (iterations.length < config.convergenceWindow) {
    return { converged: false, reason: '迭代次数不足' };
  }
  
  const recentIterations = iterations.slice(-config.convergenceWindow);
  const satisfactions = recentIterations.map(i => i.metrics.overallSatisfaction);
  
  const maxSatisfaction = Math.max(...satisfactions);
  const minSatisfaction = Math.min(...satisfactions);
  const variation = maxSatisfaction - minSatisfaction;
  
  if (variation <= config.convergenceThreshold) {
    const avgSatisfaction = satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length;
    if (avgSatisfaction >= config.targetSatisfaction) {
      return { converged: true, reason: `达到目标满意度 ${config.targetSatisfaction}，指标稳定` };
    }
    return { converged: true, reason: `指标稳定但未达目标 (${avgSatisfaction.toFixed(1)} < ${config.targetSatisfaction})` };
  }
  
  return { converged: false, reason: '指标仍在变化' };
}

/**
 * 生成指定信任度分布的 Persona
 */
async function generatePersonasWithTrustDistribution(
  distribution: TopicPracticeLoopConfig['trustLevelDistribution'],
  iteration: number,
  existingPersonas: MockPersona[]
): Promise<MockPersona[]> {
  const personas: MockPersona[] = [];
  
  // 生成低信任度 Persona (criticalness 7-10)
  if (distribution.low > 0) {
    const lowTrustPersonas = await generatePersonas({
      iteration,
      existingPersonas: [...existingPersonas, ...personas],
      targetCriticalness: { min: 7, max: 10 },
    }, distribution.low);
    personas.push(...lowTrustPersonas);
  }
  
  // 生成中信任度 Persona (criticalness 4-6)
  if (distribution.medium > 0) {
    const mediumTrustPersonas = await generatePersonas({
      iteration,
      existingPersonas: [...existingPersonas, ...personas],
      targetCriticalness: { min: 4, max: 6 },
    }, distribution.medium);
    personas.push(...mediumTrustPersonas);
  }
  
  // 生成高信任度 Persona (criticalness 1-3)
  if (distribution.high > 0) {
    const highTrustPersonas = await generatePersonas({
      iteration,
      existingPersonas: [...existingPersonas, ...personas],
      targetCriticalness: { min: 1, max: 3 },
    }, distribution.high);
    personas.push(...highTrustPersonas);
  }
  
  return personas;
}

// ==================== 主循环 ====================

/**
 * 运行单次迭代
 */
async function runIteration(
  iteration: number,
  config: TopicPracticeLoopConfig,
  existingPersonas: MockPersona[]
): Promise<TopicPracticeLoopResult['iterations'][0]> {
  const startTime = Date.now();
  
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║                    迭代 ${iteration}                                      ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  
  // 1. 生成 Persona
  console.log(`\n[Step 1] 生成 Persona...`);
  const personas = await generatePersonasWithTrustDistribution(
    config.trustLevelDistribution,
    iteration,
    existingPersonas
  );
  console.log(`  生成了 ${personas.length} 个 Persona:`);
  for (const p of personas) {
    console.log(`    - ${p.name}: 信任度 ${p.personality.trustLevel}/10, 挑剔度 ${p.personality.criticalness}/10`);
  }
  
  // 2. 运行模拟
  console.log(`\n[Step 2] 运行话题练习模拟...`);
  const simulations = await runBatchTopicPracticeSimulation(personas, config.maxTopicsPerPersona);
  console.log(`  完成 ${simulations.length} 个模拟`);
  
  // 3. 计算指标
  console.log(`\n[Step 3] 计算评估指标...`);
  const metrics = aggregateMetrics(simulations);
  
  // 4. 检查质量门控
  const qualityGates = checkTopicPracticeQualityGates(metrics);
  console.log(`  质量门控: ${qualityGates.passed ? '✅ 通过' : '❌ 未通过'}`);
  if (!qualityGates.passed) {
    for (const failure of qualityGates.failures) {
      console.log(`    - ${failure}`);
    }
  }
  
  // 5. 输出指标
  console.log(`\n[指标摘要]`);
  console.log(`  - 职位推荐满意度: ${metrics.jobRecommendationSatisfaction.toFixed(1)}/10`);
  console.log(`  - 反馈时机满意度: ${metrics.feedbackTimingSatisfaction.toFixed(1)}/10`);
  console.log(`  - 整体满意度: ${metrics.overallSatisfaction.toFixed(1)}/10`);
  console.log(`  - 推荐率: ${metrics.wouldRecommendRate.toFixed(0)}%`);
  
  const duration = Date.now() - startTime;
  console.log(`\n  迭代耗时: ${(duration / 1000).toFixed(1)} 秒`);
  
  return {
    iteration,
    personas,
    simulations,
    metrics,
    qualityGatesPassed: qualityGates.passed,
    duration,
  };
}

/**
 * 运行完整的话题练习 Agent Loop
 */
export async function runTopicPracticeLoop(
  config: Partial<TopicPracticeLoopConfig> = {}
): Promise<TopicPracticeLoopResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║           话题练习 Agent Loop 开始                                ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════╣`);
  console.log(`║  最大迭代次数: ${fullConfig.maxIterations}                                          ║`);
  console.log(`║  每次迭代 Persona 数: ${fullConfig.personasPerIteration}                                     ║`);
  console.log(`║  目标满意度: ${fullConfig.targetSatisfaction}                                           ║`);
  console.log(`║  目标推荐率: ${fullConfig.targetRecommendationRate}%                                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  
  const iterations: TopicPracticeLoopResult['iterations'] = [];
  const existingPersonas: MockPersona[] = loadExistingPersonas();
  
  let converged = false;
  let convergenceReason = '';
  
  for (let i = 1; i <= fullConfig.maxIterations; i++) {
    // 运行迭代
    const iterationResult = await runIteration(i, fullConfig, existingPersonas);
    iterations.push(iterationResult);
    
    // 更新已有 Persona
    existingPersonas.push(...iterationResult.personas);
    
    // 检查收敛（至少完成最小迭代次数后）
    if (i >= fullConfig.minIterations) {
      const convergence = checkConvergence(iterations, fullConfig);
      if (convergence.converged) {
        converged = true;
        convergenceReason = convergence.reason;
        console.log(`\n✅ 收敛: ${convergenceReason}`);
        break;
      }
    }
  }
  
  // 计算最终指标
  const allSimulations = iterations.flatMap(i => i.simulations);
  const finalMetrics = aggregateMetrics(allSimulations);
  
  // 检查目标达成
  const targets = checkTargetsMet(finalMetrics);
  
  // 收集改进建议
  const allSuggestions = allSimulations.flatMap(s => s.overallFeedback.improvementSuggestions);
  const suggestionCounts = new Map<string, number>();
  for (const suggestion of allSuggestions) {
    suggestionCounts.set(suggestion, (suggestionCounts.get(suggestion) || 0) + 1);
  }
  const topSuggestions = Array.from(suggestionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s]) => s);
  
  // 生成摘要
  const summary = `
话题练习 Agent Loop 完成
========================
总迭代次数: ${iterations.length}
收敛状态: ${converged ? '是' : '否'} (${convergenceReason || '达到最大迭代次数'})
目标达成: ${targets.met ? '是' : '否'}

最终指标:
- 职位推荐满意度: ${finalMetrics.jobRecommendationSatisfaction.toFixed(1)}/10
- 反馈时机满意度: ${finalMetrics.feedbackTimingSatisfaction.toFixed(1)}/10
- 整体满意度: ${finalMetrics.overallSatisfaction.toFixed(1)}/10
- 推荐率: ${finalMetrics.wouldRecommendRate.toFixed(0)}%

信任度影响:
- 低信任度 (n=${finalMetrics.trustLevelImpact.lowTrust.count}): 满意度 ${finalMetrics.trustLevelImpact.lowTrust.avgSatisfaction.toFixed(1)}
- 中信任度 (n=${finalMetrics.trustLevelImpact.mediumTrust.count}): 满意度 ${finalMetrics.trustLevelImpact.mediumTrust.avgSatisfaction.toFixed(1)}
- 高信任度 (n=${finalMetrics.trustLevelImpact.highTrust.count}): 满意度 ${finalMetrics.trustLevelImpact.highTrust.avgSatisfaction.toFixed(1)}
`;
  
  const totalDuration = Date.now() - startTime;
  
  const result: TopicPracticeLoopResult = {
    totalIterations: iterations.length,
    converged,
    targetMet: targets.met,
    iterations,
    finalMetrics,
    summary,
    improvementSuggestions: topSuggestions,
    completedAt: new Date().toISOString(),
    totalDuration,
  };
  
  // 保存结果
  const filepath = saveResult(result);
  console.log(`\n结果已保存到: ${filepath}`);
  
  // 输出最终报告
  console.log(generateEvaluationReport(finalMetrics));
  console.log(summary);
  
  return result;
}

// ==================== 快速测试函数 ====================

/**
 * 快速测试：只运行一次迭代
 */
export async function quickTest(): Promise<TopicPracticeLoopResult> {
  return runTopicPracticeLoop({
    maxIterations: 1,
    minIterations: 1,
    personasPerIteration: 2,
    trustLevelDistribution: {
      low: 1,
      medium: 1,
      high: 0,
    },
    maxTopicsPerPersona: 1,
  });
}

// ==================== CLI 入口 ====================

// ES module 入口
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  const isQuickTest = args.includes('--quick');
  
  console.log(`\n开始运行话题练习 Agent Loop...`);
  console.log(`模式: ${isQuickTest ? '快速测试' : '完整运行'}\n`);
  
  const runner = isQuickTest ? quickTest : runTopicPracticeLoop;
  
  runner()
    .then(result => {
      console.log(`\n✅ 完成！`);
      console.log(`总耗时: ${(result.totalDuration / 1000 / 60).toFixed(1)} 分钟`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ 错误:`, error);
      process.exit(1);
    });
}
