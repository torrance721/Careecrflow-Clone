/**
 * 对抗生成循环 (Adversarial Loop)
 * 
 * 核心理念：通过不断提升用户"挑剔度"来发现系统问题并改进
 * 通过测试不是终点，而是提升难度的起点
 * 
 * 流程：
 * 1. 读取当前迭代配置
 * 2. 生成对应信任度的 Persona
 * 3. 运行话题练习模拟
 * 4. 评估结果
 * 5. 通过 → 降低信任度，继续迭代
 *    失败 → 应用改进，重试
 * 6. 达到停止条件时输出报告
 */

import * as fs from 'fs';
import * as path from 'path';
import { generatePersonas, loadExistingPersonas, MockPersona } from './personaGenerator';
import { 
  runBatchTopicPracticeSimulation,
  TopicPracticeSimulationResult 
} from './topicPracticeSimulator';
import {
  aggregateMetrics,
  checkTopicPracticeQualityGates,
  generateEvaluationReport,
  TopicPracticeMetrics,
} from './topicPracticeMetrics';

// ==================== 配置类型 ====================

interface ImprovementConfig {
  enabled: boolean;
  version: number;
  description: string;
  appliedAt: string | null;
}

interface IterationConfig {
  currentIteration: number;
  currentTrustLevel: number;
  trustLevelStep: number;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  minTrustLevel: number;
  maxIterations: number;
  qualityGates: {
    minSatisfaction: number;
    minRecommendationRate: number;
  };
  improvements: {
    openingQuestion: ImprovementConfig;
    cumulativeContext: ImprovementConfig;
    followUpDepth: ImprovementConfig;
    feedbackSpecificity: ImprovementConfig;
    recommendationReason: ImprovementConfig;
  };
  history: IterationHistoryEntry[];
  lastUpdated: string;
}

interface IterationHistoryEntry {
  iteration: number;
  trustLevel: number;
  passed: boolean;
  metrics: {
    satisfaction: number;
    recommendationRate: number;
  };
  improvementsApplied: string[];
  timestamp: string;
}

interface AdversarialLoopResult {
  iteration: number;
  trustLevel: number;
  passed: boolean;
  metrics: TopicPracticeMetrics;
  personas: MockPersona[];
  simulations: TopicPracticeSimulationResult[];
  improvementsApplied: string[];
  nextAction: 'continue' | 'stop' | 'manual_intervention';
  stopReason?: string;
  suggestions: string[];
}

// ==================== 配置管理 ====================

const CONFIG_PATH = '/home/ubuntu/UHWeb/data/iteration-config.json';
const RESULTS_DIR = '/home/ubuntu/UHWeb/data/adversarial-loop-results';

function loadConfig(): IterationConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`配置文件不存在: ${CONFIG_PATH}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config: IterationConfig): void {
  config.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function ensureResultsDir(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function saveResult(result: AdversarialLoopResult): string {
  ensureResultsDir();
  const filename = `adversarial_${result.iteration}_trust${result.trustLevel}_${Date.now()}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  return filepath;
}

// ==================== 信任度调整 ====================

/**
 * 计算新的信任度（通过后降低）
 */
function calculateNewTrustLevel(config: IterationConfig): number {
  const newLevel = config.currentTrustLevel - config.trustLevelStep;
  return Math.max(config.minTrustLevel, newLevel);
}

/**
 * 计算新的步长（递减）
 */
function calculateNewStep(config: IterationConfig): number {
  return Math.max(0.5, config.trustLevelStep * 0.8);
}

/**
 * 信任度转换为挑剔度
 */
function trustToCriticalness(trustLevel: number): { min: number; max: number } {
  // 信任度 1-3 → 挑剔度 8-10
  // 信任度 4-6 → 挑剔度 5-7
  // 信任度 7-10 → 挑剔度 1-4
  if (trustLevel <= 3) {
    return { min: 8, max: 10 };
  } else if (trustLevel <= 6) {
    return { min: 5, max: 7 };
  } else {
    return { min: 1, max: 4 };
  }
}

// ==================== 改进分析与应用 ====================

/**
 * 分析反馈并确定需要应用的改进
 */
function analyzeAndApplyImprovements(
  simulations: TopicPracticeSimulationResult[],
  config: IterationConfig
): string[] {
  const appliedImprovements: string[] = [];
  
  // 收集所有反馈
  const allComments = simulations.flatMap(s => [
    s.overallFeedback.comments,
    ...s.topics.map(t => t.feedback?.comments || '')
  ]).join(' ').toLowerCase();
  
  const allSuggestions = simulations.flatMap(s => s.overallFeedback.improvementSuggestions);
  
  // 检查是否需要应用累积上下文改进
  if (!config.improvements.cumulativeContext.enabled) {
    const needsCumulativeContext = 
      allComments.includes('不连贯') ||
      allComments.includes('没有利用') ||
      allComments.includes('前面的信息') ||
      allSuggestions.some(s => s.includes('累积') || s.includes('上下文'));
    
    if (needsCumulativeContext) {
      config.improvements.cumulativeContext.enabled = true;
      config.improvements.cumulativeContext.version++;
      config.improvements.cumulativeContext.appliedAt = new Date().toISOString();
      appliedImprovements.push('cumulativeContext');
      console.log('  [改进] 启用累积上下文机制');
    }
  }
  
  // 检查是否需要应用追问深度改进
  if (!config.improvements.followUpDepth.enabled) {
    const needsFollowUpDepth = 
      allComments.includes('重复') ||
      allComments.includes('笼统') ||
      allComments.includes('没有针对性') ||
      allSuggestions.some(s => s.includes('追问') || s.includes('深入'));
    
    if (needsFollowUpDepth) {
      config.improvements.followUpDepth.enabled = true;
      config.improvements.followUpDepth.version++;
      config.improvements.followUpDepth.appliedAt = new Date().toISOString();
      appliedImprovements.push('followUpDepth');
      console.log('  [改进] 启用追问深度优化');
    }
  }
  
  // 检查是否需要应用反馈具体性改进
  if (!config.improvements.feedbackSpecificity.enabled) {
    const needsFeedbackSpecificity = 
      allComments.includes('反馈太笼统') ||
      allComments.includes('缺乏针对性') ||
      allComments.includes('没有引用') ||
      allSuggestions.some(s => s.includes('具体') || s.includes('引用'));
    
    if (needsFeedbackSpecificity) {
      config.improvements.feedbackSpecificity.enabled = true;
      config.improvements.feedbackSpecificity.version++;
      config.improvements.feedbackSpecificity.appliedAt = new Date().toISOString();
      appliedImprovements.push('feedbackSpecificity');
      console.log('  [改进] 启用反馈具体性优化');
    }
  }
  
  // 检查是否需要应用推荐理由改进
  if (!config.improvements.recommendationReason.enabled) {
    const needsRecommendationReason = 
      allComments.includes('推荐理由') ||
      allComments.includes('不够具体') ||
      allComments.includes('缺乏个性化') ||
      allSuggestions.some(s => s.includes('推荐') && s.includes('理由'));
    
    if (needsRecommendationReason) {
      config.improvements.recommendationReason.enabled = true;
      config.improvements.recommendationReason.version++;
      config.improvements.recommendationReason.appliedAt = new Date().toISOString();
      appliedImprovements.push('recommendationReason');
      console.log('  [改进] 启用推荐理由优化');
    }
  }
  
  return appliedImprovements;
}

/**
 * 检查是否需要人工干预
 */
function checkNeedsManualIntervention(
  simulations: TopicPracticeSimulationResult[],
  config: IterationConfig
): { needs: boolean; reason: string } {
  // 所有改进都已启用但仍然失败
  const allImprovementsEnabled = Object.values(config.improvements).every(i => i.enabled);
  if (allImprovementsEnabled && config.consecutiveFailures >= config.maxConsecutiveFailures) {
    return { 
      needs: true, 
      reason: '所有自动改进已应用但仍未通过质量门控，需要修改代码结构' 
    };
  }
  
  // 检查是否有需要代码修改的建议
  const allSuggestions = simulations.flatMap(s => s.overallFeedback.improvementSuggestions);
  const structuralKeywords = ['架构', '重构', '新功能', '接口', 'API'];
  const needsStructuralChange = allSuggestions.some(s => 
    structuralKeywords.some(k => s.includes(k))
  );
  
  if (needsStructuralChange && config.consecutiveFailures >= 2) {
    return {
      needs: true,
      reason: '用户反馈建议需要结构性修改'
    };
  }
  
  return { needs: false, reason: '' };
}

// ==================== 主循环 ====================

/**
 * 运行单次对抗生成迭代
 */
async function runAdversarialIteration(config: IterationConfig): Promise<AdversarialLoopResult> {
  const startTime = Date.now();
  
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║           对抗生成迭代 ${config.currentIteration}                                    ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════╣`);
  console.log(`║  当前信任度: ${config.currentTrustLevel.toFixed(1)}/10                                      ║`);
  console.log(`║  调整步长: ${config.trustLevelStep.toFixed(1)}                                           ║`);
  console.log(`║  连续失败: ${config.consecutiveFailures}/${config.maxConsecutiveFailures}                                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  
  // 1. 生成 Persona
  console.log(`\n[Step 1] 生成 Persona (信任度 ${config.currentTrustLevel.toFixed(1)})...`);
  const criticalness = trustToCriticalness(config.currentTrustLevel);
  const existingPersonas = loadExistingPersonas();
  
  const personas = await generatePersonas({
    iteration: config.currentIteration,
    existingPersonas,
    targetCriticalness: criticalness,
  }, 2); // 每次生成 2 个 Persona
  
  console.log(`  生成了 ${personas.length} 个 Persona:`);
  for (const p of personas) {
    console.log(`    - ${p.name}: 信任度 ${p.personality.trustLevel}/10, 挑剔度 ${p.personality.criticalness}/10`);
  }
  
  // 2. 运行模拟
  console.log(`\n[Step 2] 运行话题练习模拟...`);
  const simulations = await runBatchTopicPracticeSimulation(personas, 2);
  console.log(`  完成 ${simulations.length} 个模拟`);
  
  // 3. 计算指标
  console.log(`\n[Step 3] 计算评估指标...`);
  const metrics = aggregateMetrics(simulations);
  
  // 4. 检查质量门控
  const qualityGates = checkTopicPracticeQualityGates(metrics);
  const passed = qualityGates.passed;
  
  console.log(`\n[Step 4] 质量门控检查: ${passed ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`  - 职位推荐满意度: ${metrics.jobRecommendationSatisfaction.toFixed(1)}/10 (目标 ≥ ${config.qualityGates.minSatisfaction})`);
  console.log(`  - 反馈时机满意度: ${metrics.feedbackTimingSatisfaction.toFixed(1)}/10`);
  console.log(`  - 整体满意度: ${metrics.overallSatisfaction.toFixed(1)}/10`);
  console.log(`  - 推荐率: ${metrics.wouldRecommendRate.toFixed(0)}% (目标 ≥ ${config.qualityGates.minRecommendationRate}%)`);
  
  // 5. 决定下一步行动
  let nextAction: 'continue' | 'stop' | 'manual_intervention' = 'continue';
  let stopReason: string | undefined;
  let improvementsApplied: string[] = [];
  
  if (passed) {
    // 通过 → 降低信任度
    console.log(`\n[Step 5] 通过质量门控，准备提升难度...`);
    
    const newTrustLevel = calculateNewTrustLevel(config);
    const newStep = calculateNewStep(config);
    
    if (newTrustLevel <= config.minTrustLevel && config.currentTrustLevel <= config.minTrustLevel) {
      // 已达到最低信任度且仍然通过
      nextAction = 'stop';
      stopReason = `信任度已达最低 (${config.minTrustLevel})，系统足够强大`;
    } else {
      console.log(`  信任度: ${config.currentTrustLevel.toFixed(1)} → ${newTrustLevel.toFixed(1)}`);
      console.log(`  步长: ${config.trustLevelStep.toFixed(1)} → ${newStep.toFixed(1)}`);
      
      config.currentTrustLevel = newTrustLevel;
      config.trustLevelStep = newStep;
      config.consecutiveFailures = 0;
    }
  } else {
    // 未通过 → 分析并应用改进
    console.log(`\n[Step 5] 未通过质量门控，分析改进点...`);
    
    config.consecutiveFailures++;
    
    // 检查是否需要人工干预
    const manualCheck = checkNeedsManualIntervention(simulations, config);
    if (manualCheck.needs) {
      nextAction = 'manual_intervention';
      stopReason = manualCheck.reason;
    } else {
      // 应用自动改进
      improvementsApplied = analyzeAndApplyImprovements(simulations, config);
      
      if (improvementsApplied.length === 0 && config.consecutiveFailures >= config.maxConsecutiveFailures) {
        // 没有新改进可应用且连续失败
        config.currentTrustLevel = Math.min(10, config.currentTrustLevel + 1);
        config.consecutiveFailures = 0;
        console.log(`  连续失败 ${config.maxConsecutiveFailures} 次，降低难度: 信任度 → ${config.currentTrustLevel.toFixed(1)}`);
      }
    }
  }
  
  // 检查最大迭代次数
  if (config.currentIteration >= config.maxIterations) {
    nextAction = 'stop';
    stopReason = `达到最大迭代次数 (${config.maxIterations})`;
  }
  
  // 6. 记录历史
  config.history.push({
    iteration: config.currentIteration,
    trustLevel: config.currentTrustLevel,
    passed,
    metrics: {
      satisfaction: metrics.overallSatisfaction,
      recommendationRate: metrics.wouldRecommendRate,
    },
    improvementsApplied,
    timestamp: new Date().toISOString(),
  });
  
  // 7. 更新配置
  config.currentIteration++;
  saveConfig(config);
  
  // 8. 收集建议
  const suggestions = simulations.flatMap(s => s.overallFeedback.improvementSuggestions);
  
  const result: AdversarialLoopResult = {
    iteration: config.currentIteration - 1,
    trustLevel: config.currentTrustLevel,
    passed,
    metrics,
    personas,
    simulations,
    improvementsApplied,
    nextAction,
    stopReason,
    suggestions: Array.from(new Set(suggestions)).slice(0, 5),
  };
  
  // 保存结果
  const filepath = saveResult(result);
  console.log(`\n结果已保存: ${filepath}`);
  
  return result;
}

/**
 * 运行完整的对抗生成循环
 */
export async function runAdversarialLoop(): Promise<void> {
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║           对抗生成循环开始                                        ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  
  let config = loadConfig();
  let shouldContinue = true;
  
  while (shouldContinue) {
    const result = await runAdversarialIteration(config);
    
    // 重新加载配置（可能被更新）
    config = loadConfig();
    
    // 输出迭代报告
    console.log(`\n${'='.repeat(70)}`);
    console.log(`迭代 ${result.iteration} 完成`);
    console.log(`${'='.repeat(70)}`);
    console.log(`状态: ${result.passed ? '✅ 通过' : '❌ 未通过'}`);
    console.log(`下一步: ${result.nextAction}`);
    if (result.stopReason) {
      console.log(`停止原因: ${result.stopReason}`);
    }
    if (result.improvementsApplied.length > 0) {
      console.log(`应用的改进: ${result.improvementsApplied.join(', ')}`);
    }
    
    // 决定是否继续
    if (result.nextAction === 'stop') {
      shouldContinue = false;
      console.log(`\n🏁 对抗生成循环结束: ${result.stopReason}`);
    } else if (result.nextAction === 'manual_intervention') {
      shouldContinue = false;
      console.log(`\n⚠️ 需要人工干预: ${result.stopReason}`);
      console.log(`\n建议的改进方向:`);
      for (const suggestion of result.suggestions) {
        console.log(`  - ${suggestion}`);
      }
    }
    
    // 输出当前状态
    console.log(`\n当前配置状态:`);
    console.log(`  - 迭代: ${config.currentIteration}`);
    console.log(`  - 信任度: ${config.currentTrustLevel.toFixed(1)}`);
    console.log(`  - 连续失败: ${config.consecutiveFailures}`);
    console.log(`  - 已启用改进: ${Object.entries(config.improvements).filter(([_, v]) => v.enabled).map(([k]) => k).join(', ') || '无'}`);
  }
  
  // 输出最终报告
  console.log(`\n${'='.repeat(70)}`);
  console.log(`对抗生成循环最终报告`);
  console.log(`${'='.repeat(70)}`);
  console.log(`总迭代次数: ${config.currentIteration - 1}`);
  console.log(`最终信任度: ${config.currentTrustLevel.toFixed(1)}`);
  console.log(`\n历史记录:`);
  for (const entry of config.history) {
    console.log(`  迭代 ${entry.iteration}: 信任度 ${entry.trustLevel.toFixed(1)}, ${entry.passed ? '✅' : '❌'}, 满意度 ${entry.metrics.satisfaction.toFixed(1)}`);
  }
}

// ==================== CLI 入口 ====================

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.error(`\n⚠️ 未捕获的异常:`, error.message);
  console.log(`继续运行...`);
});

process.on('unhandledRejection', (reason) => {
  console.error(`\n⚠️ 未处理的 Promise 拒绝:`, reason);
  console.log(`继续运行...`);
});

if (isMainModule) {
  console.log(`\n开始运行对抗生成循环...`);
  console.log(`配置文件: ${CONFIG_PATH}`);
  console.log(`结果目录: ${RESULTS_DIR}\n`);
  
  // 自动重试机制
  const runWithRetry = async (maxRetries = 5) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await runAdversarialLoop();
        console.log(`\n✅ 对抗生成循环完成！`);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`\n❌ 尝试 ${attempt}/${maxRetries} 失败:`, errorMessage);
        
        // 检查是否是网络错误（可重试）
        const isNetworkError = errorMessage.includes('ECONNRESET') || 
                               errorMessage.includes('ETIMEDOUT') ||
                               errorMessage.includes('socket') ||
                               errorMessage.includes('network') ||
                               errorMessage.includes('aborted');
        
        if (isNetworkError && attempt < maxRetries) {
          const waitTime = attempt * 10; // 递增等待时间
          console.log(`⏳ 等待 ${waitTime} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          continue;
        }
        
        if (attempt === maxRetries) {
          console.error(`\n❌ 所有重试尝试都失败了`);
          process.exit(1);
        }
      }
    }
  }
  
  runWithRetry()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
