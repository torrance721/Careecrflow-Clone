/**
 * Agent Loop Runner Script
 * 
 * 运行渐进式 Agent Loop 验证
 * 使用: npx tsx scripts/runAgentLoop.ts [--quick] [--full]
 */

import { runProgressiveAgentLoop, ProgressiveConfig } from '../server/agents/agentLoop';

// 解析命令行参数
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const isFull = args.includes('--full');

// 配置
const quickConfig: Partial<ProgressiveConfig> = {
  maxIterations: 3,
  minIterations: 2,
  criticalnessBands: [
    { min: 5, max: 6, personaCount: 1, weight: 0.5 },
    { min: 8, max: 9, personaCount: 1, weight: 0.5 },
  ],
  iterationTimeoutMs: 120000, // 2 minutes
};

const fullConfig: Partial<ProgressiveConfig> = {
  maxIterations: 10,
  minIterations: 5,
  criticalnessBands: [
    { min: 4, max: 5, personaCount: 2, weight: 0.2 },
    { min: 6, max: 7, personaCount: 2, weight: 0.3 },
    { min: 8, max: 9, personaCount: 2, weight: 0.3 },
    { min: 10, max: 10, personaCount: 1, weight: 0.2 },
  ],
  iterationTimeoutMs: 300000, // 5 minutes
};

async function main() {
  console.log('Starting Agent Loop...');
  console.log(`Mode: ${isQuick ? 'Quick' : isFull ? 'Full' : 'Default'}`);
  
  const config = isQuick ? quickConfig : isFull ? fullConfig : {};
  
  try {
    const result = await runProgressiveAgentLoop(config);
    
    console.log('\n=== Final Result ===');
    console.log(`Target Met: ${result.targetMet ? '✅ YES' : '❌ NO'}`);
    console.log(`Final Satisfaction: ${result.finalMetrics.averageSatisfaction.toFixed(1)}/10`);
    console.log(`Final Recommendation Rate: ${result.finalMetrics.recommendationRate.toFixed(0)}%`);
    console.log(`Total Duration: ${Math.round(result.totalDuration / 60)} minutes`);
    
    // 输出详细的满意度分布
    console.log('\nSatisfaction by Criticalness Band:');
    for (const [band, satisfaction] of Object.entries(result.finalMetrics.satisfactionByBand)) {
      const status = satisfaction >= 8 ? '✅' : satisfaction >= 6 ? '⚠️' : '❌';
      console.log(`  ${status} Band ${band}: ${satisfaction.toFixed(1)}/10`);
    }
    
    process.exit(result.targetMet ? 0 : 1);
  } catch (error) {
    console.error('Agent Loop failed:', error);
    process.exit(1);
  }
}

main();
