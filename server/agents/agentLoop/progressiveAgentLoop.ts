/**
 * Progressive Agent Loop with ReAct Integration
 * 
 * 渐进式收敛策略：
 * 1. 从低挑剔度用户开始，逐步增加难度
 * 2. 使用 Multi-Grader 评估每次迭代的质量
 * 3. 动态调整思维深度和工具使用
 * 4. 目标：挑剔度 4-10 的用户满意度 ≥ 8
 */

import { 
  generatePersonas, 
  loadExistingPersonas, 
  evolvePersonaGenerator,
  MockPersona,
  PersonaGeneratorConfig,
} from './personaGenerator';
import { simulateInterview, SimulationResult } from './interviewSimulator';
import { runRealisticSimulation, toStandardSimulation, RealisticSimulationResult } from './realisticSimulator';
import { generateFeedback, aggregateFeedback, FeedbackReport } from './feedbackGenerator';
import { 
  optimizePrompts, 
  loadOptimizationHistory,
  OptimizationResult,
} from './promptOptimizer';
import { 
  TimeBudgetManager, 
  createTimeBudget,
  MultiGrader,
  createMultiGrader,
  TIME_BUDGETS,
} from '../react';
import {
  calculateGeneralizationScore,
  generateGeneralizationReport,
  type GeneralizationReport,
  type IterationResult as GenIterationResult,
} from './generalizationEvaluator';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 配置类型 ====================

export interface ProgressiveConfig {
  // 收敛目标
  targetSatisfaction: number;      // 目标满意度 (默认 8)
  targetRecommendationRate: number; // 目标推荐率 (默认 80%)
  
  // 迭代控制
  maxIterations: number;           // 最大迭代次数
  minIterations: number;           // 最小迭代次数（确保充分测试）
  
  // 挑剔度控制
  criticalnessBands: Array<{
    min: number;
    max: number;
    personaCount: number;
    weight: number;  // 该区间的权重
  }>;
  
  // 收敛检测
  convergenceWindow: number;       // 检测收敛的窗口大小
  convergenceThreshold: number;    // 满意度变化阈值
  
  // 时间预算
  iterationTimeoutMs: number;      // 每次迭代的超时时间
  
  // 质量门控
  qualityGates: {
    minSatisfactionPerBand: number;  // 每个挑剔度区间的最低满意度
    maxHintUsageRate: number;        // 最大提示使用率
    minCompletionRate: number;       // 最小完成率
  };
}

export interface ProgressiveIterationResult {
  iteration: number;
  criticalnessBand: { min: number; max: number };
  personas: MockPersona[];
  simulations: SimulationResult[];
  feedback: FeedbackReport[];
  optimization: OptimizationResult;
  generalizationReport?: GeneralizationReport;  // 泛化性报告
  metrics: {
    averageSatisfaction: number;
    recommendationRate: number;
    completionRate: number;
    hintUsageRate: number;
    moduleRatings: Record<string, number>;
  };
  qualityGatesPassed: boolean;
  duration: number;
}

export interface ProgressiveAgentLoopResult {
  totalIterations: number;
  converged: boolean;
  targetMet: boolean;
  finalMetrics: {
    averageSatisfaction: number;
    recommendationRate: number;
    satisfactionByBand: Record<string, number>;
  };
  iterations: ProgressiveIterationResult[];
  totalDuration: number;
  completedAt: string;
  summary: string;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: ProgressiveConfig = {
  targetSatisfaction: 9, // 目标满意度提升到 9.0
  targetRecommendationRate: 90, // 目标推荐率提升到 90%
  maxIterations: 15, // 增加最大迭代次数
  minIterations: 5, // 增加最小迭代次数
  criticalnessBands: [
    { min: 4, max: 4, personaCount: 1, weight: 0.15 },  // 低挑剔度
    { min: 5, max: 5, personaCount: 1, weight: 0.15 },
    { min: 6, max: 6, personaCount: 1, weight: 0.15 },
    { min: 7, max: 7, personaCount: 1, weight: 0.15 },  // 中挑剔度
    { min: 8, max: 8, personaCount: 1, weight: 0.15 },
    { min: 9, max: 9, personaCount: 1, weight: 0.15 },  // 高挑剔度
    { min: 10, max: 10, personaCount: 1, weight: 0.10 }, // 极高挑剔度
  ],
  convergenceWindow: 4,
  convergenceThreshold: 0.3, // 更严格的收敛阈值
  iterationTimeoutMs: 600000, // 10 minutes
  qualityGates: {
    minSatisfactionPerBand: 8, // 每个区间至少 8 分
    maxHintUsageRate: 0.3, // 更低的提示使用率
    minCompletionRate: 0.9, // 更高的完成率
  },
};

const RESULTS_DIR = '/home/ubuntu/UHWeb/data/agent-loop-results';

// ==================== 工具函数 ====================

function ensureResultsDir(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function saveResult(result: ProgressiveAgentLoopResult): string {
  ensureResultsDir();
  const filename = `progressive_loop_${Date.now()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

/**
 * 检查是否达到收敛
 */
function checkConvergence(
  iterations: ProgressiveIterationResult[],
  config: ProgressiveConfig
): { converged: boolean; reason: string } {
  if (iterations.length < config.convergenceWindow) {
    return { converged: false, reason: 'Not enough iterations' };
  }

  const recentIterations = iterations.slice(-config.convergenceWindow);
  const satisfactions = recentIterations.map(i => i.metrics.averageSatisfaction);
  
  // 计算满意度变化
  const maxSatisfaction = Math.max(...satisfactions);
  const minSatisfaction = Math.min(...satisfactions);
  const variation = maxSatisfaction - minSatisfaction;
  
  if (variation <= config.convergenceThreshold) {
    // 检查是否达到目标
    const avgSatisfaction = satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length;
    if (avgSatisfaction >= config.targetSatisfaction) {
      return { converged: true, reason: `Target satisfaction ${config.targetSatisfaction} reached with stable metrics` };
    }
    return { converged: true, reason: `Metrics stabilized but below target (${avgSatisfaction.toFixed(1)} < ${config.targetSatisfaction})` };
  }
  
  return { converged: false, reason: 'Metrics still improving' };
}

/**
 * 检查质量门控
 */
function checkQualityGates(
  metrics: ProgressiveIterationResult['metrics'],
  config: ProgressiveConfig
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  
  if (metrics.averageSatisfaction < config.qualityGates.minSatisfactionPerBand) {
    failures.push(`Satisfaction ${metrics.averageSatisfaction.toFixed(1)} < ${config.qualityGates.minSatisfactionPerBand}`);
  }
  
  if (metrics.hintUsageRate > config.qualityGates.maxHintUsageRate) {
    failures.push(`Hint usage ${(metrics.hintUsageRate * 100).toFixed(0)}% > ${config.qualityGates.maxHintUsageRate * 100}%`);
  }
  
  if (metrics.completionRate < config.qualityGates.minCompletionRate) {
    failures.push(`Completion rate ${(metrics.completionRate * 100).toFixed(0)}% < ${config.qualityGates.minCompletionRate * 100}%`);
  }
  
  return { passed: failures.length === 0, failures };
}

// ==================== 主循环 ====================

/**
 * 运行单次迭代
 */
async function runProgressiveIteration(
  iteration: number,
  band: { min: number; max: number; personaCount: number },
  existingPersonas: MockPersona[],
  config: ProgressiveConfig
): Promise<ProgressiveIterationResult> {
  const startTime = Date.now();
  const timeBudget = new TimeBudgetManager('iteration', { 
    maxTimeMs: config.iterationTimeoutMs, 
    priority: 'balanced' 
  });
  
  console.log(`\n--- Iteration ${iteration} | Criticalness Band: ${band.min}-${band.max} ---`);
  
  // 生成 Persona
  const targetCriticalness = (band.min + band.max) / 2;
  const personaConfig: PersonaGeneratorConfig = {
    iteration,
    existingPersonas,
    targetCriticalness,
  };
  
  console.log(`  Generating ${band.personaCount} personas...`);
  const personas = await generatePersonas(personaConfig, band.personaCount);
  timeBudget.checkpoint('personas_generated');
  
  // 模拟面试 - 使用真人流程模拟器
  console.log(`  Simulating interviews (realistic mode)...`);
  const simulations: SimulationResult[] = [];
  const realisticSimulations: RealisticSimulationResult[] = [];
  
  for (const persona of personas) {
    if (timeBudget.isNearTimeout()) {
      console.log(`  ⚠️ Time budget running low, skipping remaining simulations`);
      break;
    }
    
    // 使用真人流程模拟器
    const realisticSim = await runRealisticSimulation(persona, iteration);
    realisticSimulations.push(realisticSim);
    
    // 转换为标准格式用于反馈生成
    const simulation = toStandardSimulation(realisticSim);
    simulations.push(simulation);
    
    // 输出详细信息
    const journeyInfo = `browse:${Math.round(realisticSim.journey.homepage.browseTime/1000)}s, wait:${Math.round(realisticSim.journey.preparation.waitTime/1000)}s`;
    console.log(`    ${persona.name}: ${simulation.completedSuccessfully ? '✓' : '✗'} (${simulation.hintsUsed} hints, ${journeyInfo})`);
  }
  timeBudget.checkpoint('simulations_completed');
  
  // 生成反馈
  console.log(`  Generating feedback...`);
  const feedback: FeedbackReport[] = [];
  for (let i = 0; i < Math.min(personas.length, simulations.length); i++) {
    const report = await generateFeedback(personas[i], simulations[i]);
    feedback.push(report);
    console.log(`    ${personas[i].name}: ${report.overallSatisfaction}/10`);
  }
  timeBudget.checkpoint('feedback_generated');
  
  // 聚合指标
  const aggregated = aggregateFeedback(feedback);
  const completionRate = simulations.filter(s => s.completedSuccessfully).length / simulations.length;
  const hintUsageRate = simulations.reduce((sum, s) => sum + s.hintsUsed, 0) / (simulations.length * 3); // 假设最多 3 个提示
  
  const metrics = {
    averageSatisfaction: aggregated.averageSatisfaction,
    recommendationRate: aggregated.recommendationRate,
    completionRate,
    hintUsageRate,
    moduleRatings: aggregated.moduleRatings,
  };
  
  // 检查质量门控
  const qualityCheck = checkQualityGates(metrics, config);
  console.log(`  Quality gates: ${qualityCheck.passed ? '✓ PASSED' : '✗ FAILED'}`);
  if (!qualityCheck.passed) {
    console.log(`    Failures: ${qualityCheck.failures.join(', ')}`);
  }
  
  // 优化 Prompt
  console.log(`  Optimizing prompts...`);
  const optimization = await optimizePrompts(feedback, iteration);
  timeBudget.checkpoint('optimization_completed');
  
  // 生成泛化性报告
  console.log(`  Generating generalization report...`);
  const genIterationResults: GenIterationResult[] = [{
    iteration,
    personas: personas.map(p => ({
      name: p.name,
      criticalness: p.personality.criticalness,
      position: p.targetJob.position,
      background: `${p.background.currentRole} at ${p.background.currentCompany}, ${p.background.yearsOfExperience} years exp`,
      satisfaction: feedback.find(f => f.personaId === p.id)?.overallSatisfaction || 5,
      wouldRecommend: feedback.find(f => f.personaId === p.id)?.wouldRecommend || false,
    })),
  }];
  const generalizationReport = await generateGeneralizationReport(
    iteration,
    genIterationResults,
    `当前策略: 挑剔度 ${band.min}-${band.max}, 问题生成使用 ReAct Agent`
  );
  console.log(`  Generalization score: ${generalizationReport.score.overall.toFixed(1)}/10`);
  if (generalizationReport.score.issues.length > 0) {
    console.log(`  ⚠️ Generalization issues: ${generalizationReport.score.issues.map(i => i.description).join(', ')}`);
  }
  timeBudget.checkpoint('generalization_report_generated');
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`  Iteration completed in ${duration}s`);
  
  return {
    iteration,
    criticalnessBand: { min: band.min, max: band.max },
    personas,
    simulations,
    feedback,
    optimization,
    generalizationReport,
    metrics,
    qualityGatesPassed: qualityCheck.passed,
    duration,
  };
}

/**
 * 运行渐进式 Agent Loop
 */
export async function runProgressiveAgentLoop(
  config: Partial<ProgressiveConfig> = {}
): Promise<ProgressiveAgentLoopResult> {
  const fullConfig: ProgressiveConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           PROGRESSIVE AGENT LOOP (ReAct Enhanced)                ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Target Satisfaction: ${fullConfig.targetSatisfaction}/10                                      ║`);
  console.log(`║  Target Recommendation Rate: ${fullConfig.targetRecommendationRate}%                              ║`);
  console.log(`║  Criticalness Bands: ${fullConfig.criticalnessBands.map(b => `${b.min}-${b.max}`).join(', ')}                  ║`);
  console.log(`║  Max Iterations: ${fullConfig.maxIterations}                                              ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const startTime = Date.now();
  const iterations: ProgressiveIterationResult[] = [];
  let existingPersonas = loadExistingPersonas();
  let converged = false;
  let convergenceReason = '';
  
  // 按挑剔度区间迭代
  for (let i = 1; i <= fullConfig.maxIterations; i++) {
    // 选择当前迭代的挑剔度区间
    const bandIndex = (i - 1) % fullConfig.criticalnessBands.length;
    const band = fullConfig.criticalnessBands[bandIndex];
    
    // 运行迭代
    const result = await runProgressiveIteration(i, band, existingPersonas, fullConfig);
    iterations.push(result);
    existingPersonas = [...existingPersonas, ...result.personas];
    
    // 检查收敛
    if (i >= fullConfig.minIterations) {
      const convergenceCheck = checkConvergence(iterations, fullConfig);
      if (convergenceCheck.converged) {
        converged = true;
        convergenceReason = convergenceCheck.reason;
        console.log(`\n✅ CONVERGED: ${convergenceReason}`);
        break;
      }
    }
    
    // 演化 Persona 生成器
    if (i < fullConfig.maxIterations && result.feedback.length > 0) {
      const feedbackSummary = result.feedback.map(f => f.rawFeedback).join('\n\n');
      await evolvePersonaGenerator(feedbackSummary, i);
    }
  }
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  
  // 计算最终指标
  const allFeedback = iterations.flatMap(i => i.feedback);
  const finalSatisfaction = allFeedback.reduce((sum, f) => sum + f.overallSatisfaction, 0) / allFeedback.length;
  const finalRecommendationRate = (allFeedback.filter(f => f.wouldRecommend).length / allFeedback.length) * 100;
  
  // 按挑剔度区间计算满意度
  const satisfactionByBand: Record<string, number> = {};
  for (const band of fullConfig.criticalnessBands) {
    const bandIterations = iterations.filter(
      i => i.criticalnessBand.min === band.min && i.criticalnessBand.max === band.max
    );
    if (bandIterations.length > 0) {
      const bandFeedback = bandIterations.flatMap(i => i.feedback);
      satisfactionByBand[`${band.min}-${band.max}`] = 
        bandFeedback.reduce((sum, f) => sum + f.overallSatisfaction, 0) / bandFeedback.length;
    }
  }
  
  const targetMet = finalSatisfaction >= fullConfig.targetSatisfaction && 
                    finalRecommendationRate >= fullConfig.targetRecommendationRate;
  
  // 生成总结
  const summary = generateSummary(iterations, fullConfig, targetMet, converged, convergenceReason);
  
  const result: ProgressiveAgentLoopResult = {
    totalIterations: iterations.length,
    converged,
    targetMet,
    finalMetrics: {
      averageSatisfaction: finalSatisfaction,
      recommendationRate: finalRecommendationRate,
      satisfactionByBand,
    },
    iterations,
    totalDuration,
    completedAt: new Date().toISOString(),
    summary,
  };
  
  // 保存结果
  const filepath = saveResult(result);
  
  // 打印总结
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    PROGRESSIVE LOOP COMPLETE                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Iterations: ${iterations.length.toString().padEnd(47)}║`);
  console.log(`║  Converged: ${converged ? 'Yes' : 'No'}                                                    ║`);
  console.log(`║  Target Met: ${targetMet ? '✓ YES' : '✗ NO'}                                                 ║`);
  console.log(`║  Final Satisfaction: ${finalSatisfaction.toFixed(1)}/10                                     ║`);
  console.log(`║  Final Recommendation Rate: ${finalRecommendationRate.toFixed(0)}%                               ║`);
  console.log(`║  Duration: ${Math.round(totalDuration / 60)} minutes                                           ║`);
  console.log(`║  Results saved to: ${filepath.slice(-40).padEnd(45)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n');
  console.log('Satisfaction by Criticalness Band:');
  for (const [band, satisfaction] of Object.entries(satisfactionByBand)) {
    console.log(`  ${band}: ${satisfaction.toFixed(1)}/10`);
  }
  console.log('\n');
  
  return result;
}

/**
 * 生成总结报告
 */
function generateSummary(
  iterations: ProgressiveIterationResult[],
  config: ProgressiveConfig,
  targetMet: boolean,
  converged: boolean,
  convergenceReason: string
): string {
  const lines: string[] = [];
  
  lines.push('# Progressive Agent Loop Summary');
  lines.push('');
  lines.push(`## Result: ${targetMet ? '✅ TARGET MET' : '❌ TARGET NOT MET'}`);
  lines.push('');
  lines.push(`- **Converged**: ${converged ? 'Yes' : 'No'}${convergenceReason ? ` (${convergenceReason})` : ''}`);
  lines.push(`- **Total Iterations**: ${iterations.length}`);
  lines.push(`- **Target Satisfaction**: ${config.targetSatisfaction}/10`);
  lines.push(`- **Target Recommendation Rate**: ${config.targetRecommendationRate}%`);
  lines.push('');
  
  lines.push('## Iteration Summary');
  lines.push('');
  lines.push('| Iteration | Band | Satisfaction | Recommendation | Quality Gates |');
  lines.push('|-----------|------|--------------|----------------|---------------|');
  
  for (const iter of iterations) {
    lines.push(`| ${iter.iteration} | ${iter.criticalnessBand.min}-${iter.criticalnessBand.max} | ${iter.metrics.averageSatisfaction.toFixed(1)}/10 | ${iter.metrics.recommendationRate.toFixed(0)}% | ${iter.qualityGatesPassed ? '✓' : '✗'} |`);
  }
  
  lines.push('');
  lines.push('## Key Insights');
  lines.push('');
  
  // 找出最佳和最差的迭代
  const sortedByScore = [...iterations].sort((a, b) => 
    b.metrics.averageSatisfaction - a.metrics.averageSatisfaction
  );
  
  if (sortedByScore.length > 0) {
    const best = sortedByScore[0];
    const worst = sortedByScore[sortedByScore.length - 1];
    
    lines.push(`- **Best Performance**: Iteration ${best.iteration} (Band ${best.criticalnessBand.min}-${best.criticalnessBand.max}) with ${best.metrics.averageSatisfaction.toFixed(1)}/10 satisfaction`);
    lines.push(`- **Worst Performance**: Iteration ${worst.iteration} (Band ${worst.criticalnessBand.min}-${worst.criticalnessBand.max}) with ${worst.metrics.averageSatisfaction.toFixed(1)}/10 satisfaction`);
  }
  
  // 模块评分
  const allModuleRatings: Record<string, number[]> = {};
  for (const iter of iterations) {
    for (const [module, rating] of Object.entries(iter.metrics.moduleRatings)) {
      if (!allModuleRatings[module]) allModuleRatings[module] = [];
      allModuleRatings[module].push(rating);
    }
  }
  
  lines.push('');
  lines.push('## Module Performance');
  lines.push('');
  
  for (const [module, ratings] of Object.entries(allModuleRatings)) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    lines.push(`- **${module}**: ${avg.toFixed(1)}/10`);
  }
  
  return lines.join('\n');
}

// 导出
export { DEFAULT_CONFIG as PROGRESSIVE_DEFAULT_CONFIG };
