/**
 * Strategy Generalization Evaluator
 * 
 * 评估策略的泛化能力，避免硬编码规则导致的泛化性问题。
 * 
 * 核心原则：
 * 1. 避免硬编码规则 - 任何固定数字、固定列表都是泛化性差的信号
 * 2. 基于信号决策 - 决策应该基于动态信号，而不是预定义规则
 * 3. 上下文驱动 - 行为应该从当前上下文自然延伸
 */

import { invokeLLM } from '../../_core/llm';

// ==================== 泛化性问题模式 ====================

/**
 * 泛化性差的代码模式
 */
export const POOR_GENERALIZATION_PATTERNS = [
  {
    pattern: 'hardcoded_number',
    description: '硬编码的数字阈值',
    examples: [
      'if (count >= 3)',
      'questionHistory.length % 3 === 0',
      'usageCount >= 3',
      'slice(-3)',
    ],
    betterApproach: '使用动态信号（如回答质量、重复度）来决定阈值',
  },
  {
    pattern: 'hardcoded_list',
    description: '硬编码的分类列表',
    examples: [
      "irrelevantTopics['designer'] = ['devops', 'kubernetes']",
      "positionKeywords['engineer'] = ['code', 'api']",
      "QUESTION_PATTERNS = [...]",
    ],
    betterApproach: '让 LLM 基于上下文动态判断相关性',
  },
  {
    pattern: 'fixed_rule',
    description: '固定的业务规则',
    examples: [
      'if (seniorityLevel === "executive") totalQuestions = 10',
      'if (criticalness >= 7) useAggressiveMode = true',
    ],
    betterApproach: '基于用户反馈和对话质量动态调整',
  },
  {
    pattern: 'category_mapping',
    description: '固定的分类映射',
    examples: [
      "positionType === 'designer' ? designerTopics : engineerTopics",
      "role === 'admin' ? adminFeatures : userFeatures",
    ],
    betterApproach: '让 LLM 基于具体情况动态生成适合的内容',
  },
];

// ==================== 泛化性评分 ====================

export interface GeneralizationScore {
  overall: number;  // 0-10
  dimensions: {
    crossCriticalnessVariance: number;  // 跨挑剔度方差（越低越好）
    crossPositionVariance: number;       // 跨职位方差
    crossBackgroundVariance: number;     // 跨背景方差
    robustness: number;                  // 鲁棒性（边缘情况表现）
  };
  issues: GeneralizationIssue[];
  recommendations: string[];
}

export interface GeneralizationIssue {
  type: 'hardcoded_number' | 'hardcoded_list' | 'fixed_rule' | 'category_mapping' | 'high_variance';
  description: string;
  location?: string;
  severity: 'low' | 'medium' | 'high';
  suggestedFix: string;
}

export interface IterationResult {
  personas: Array<{
    name: string;
    criticalness: number;
    position: string;
    background: string;
    satisfaction: number;
    wouldRecommend: boolean;
  }>;
  iteration: number;
}

/**
 * 计算策略泛化能力评分
 */
export function calculateGeneralizationScore(results: IterationResult[]): GeneralizationScore {
  const allPersonas = results.flatMap(r => r.personas);
  
  if (allPersonas.length === 0) {
    return {
      overall: 0,
      dimensions: {
        crossCriticalnessVariance: 10,
        crossPositionVariance: 10,
        crossBackgroundVariance: 10,
        robustness: 0,
      },
      issues: [],
      recommendations: ['需要更多数据来评估泛化能力'],
    };
  }
  
  // 1. 计算跨挑剔度方差
  const byCriticalness = groupBy(allPersonas, p => Math.floor(p.criticalness));
  const criticalnessMeans = Object.values(byCriticalness).map(group => 
    group.reduce((sum, p) => sum + p.satisfaction, 0) / group.length
  );
  const crossCriticalnessVariance = calculateVariance(criticalnessMeans);
  
  // 2. 计算跨职位方差
  const byPosition = groupBy(allPersonas, p => extractPositionType(p.position));
  const positionMeans = Object.values(byPosition).map(group =>
    group.reduce((sum, p) => sum + p.satisfaction, 0) / group.length
  );
  const crossPositionVariance = calculateVariance(positionMeans);
  
  // 3. 计算跨背景方差
  const byBackground = groupBy(allPersonas, p => extractBackgroundType(p.background));
  const backgroundMeans = Object.values(byBackground).map(group =>
    group.reduce((sum, p) => sum + p.satisfaction, 0) / group.length
  );
  const crossBackgroundVariance = calculateVariance(backgroundMeans);
  
  // 4. 计算鲁棒性（边缘情况表现）
  const edgeCases = allPersonas.filter(p => 
    p.criticalness >= 9 || p.criticalness <= 2
  );
  const robustness = edgeCases.length > 0
    ? edgeCases.reduce((sum, p) => sum + p.satisfaction, 0) / edgeCases.length
    : 5; // 没有边缘情况数据时给中等分
  
  // 识别问题
  const issues: GeneralizationIssue[] = [];
  
  if (crossCriticalnessVariance > 4) {
    issues.push({
      type: 'high_variance',
      description: `跨挑剔度满意度方差过高 (${crossCriticalnessVariance.toFixed(2)})`,
      severity: 'high',
      suggestedFix: '策略对不同挑剔度用户的适应性不足，需要更动态的调整机制',
    });
  }
  
  if (crossPositionVariance > 3) {
    issues.push({
      type: 'high_variance',
      description: `跨职位满意度方差过高 (${crossPositionVariance.toFixed(2)})`,
      severity: 'medium',
      suggestedFix: '问题生成可能过度依赖职位类型的硬编码规则',
    });
  }
  
  if (robustness < 5) {
    issues.push({
      type: 'high_variance',
      description: `边缘情况表现差 (${robustness.toFixed(2)}/10)`,
      severity: 'high',
      suggestedFix: '策略在极端挑剔度用户上表现不佳，需要更鲁棒的设计',
    });
  }
  
  // 计算总分
  // 方差越低越好，转换为 0-10 分（方差 0 = 10分，方差 10+ = 0分）
  const varianceScore = (v: number) => Math.max(0, 10 - v);
  
  const overall = (
    varianceScore(crossCriticalnessVariance) * 0.4 +
    varianceScore(crossPositionVariance) * 0.2 +
    varianceScore(crossBackgroundVariance) * 0.2 +
    robustness * 0.2
  );
  
  // 生成建议
  const recommendations: string[] = [];
  
  if (crossCriticalnessVariance > 2) {
    recommendations.push('考虑使用基于用户反馈的动态调整，而不是基于挑剔度的固定规则');
  }
  
  if (crossPositionVariance > 2) {
    recommendations.push('问题生成应该基于候选人的回答内容，而不是职位类型的预定义列表');
  }
  
  if (robustness < 7) {
    recommendations.push('增加对极端情况的测试覆盖，确保策略在边缘情况下也能工作');
  }
  
  return {
    overall,
    dimensions: {
      crossCriticalnessVariance,
      crossPositionVariance,
      crossBackgroundVariance,
      robustness,
    },
    issues,
    recommendations,
  };
}

// ==================== 代码泛化性检查 ====================

/**
 * 检查代码片段的泛化性问题
 */
export async function checkCodeGeneralization(code: string): Promise<GeneralizationIssue[]> {
  const issues: GeneralizationIssue[] = [];
  
  // 检查硬编码数字
  const hardcodedNumbers = code.match(/(?:>=|<=|===|==|>|<)\s*\d+/g) || [];
  for (const match of hardcodedNumbers) {
    const num = parseInt(match.replace(/[^\d]/g, ''));
    if (num > 0 && num < 100) { // 排除明显的常量如 0, 100, 1000
      issues.push({
        type: 'hardcoded_number',
        description: `发现硬编码数字阈值: ${match}`,
        severity: 'medium',
        suggestedFix: '考虑使用动态信号来决定阈值，而不是固定数字',
      });
    }
  }
  
  // 检查硬编码列表
  const hardcodedLists = code.match(/\[[^\]]*'[^']*'[^\]]*\]/g) || [];
  for (const match of hardcodedLists) {
    if (match.split(',').length > 3) {
      issues.push({
        type: 'hardcoded_list',
        description: `发现硬编码列表: ${match.slice(0, 50)}...`,
        severity: 'medium',
        suggestedFix: '考虑让 LLM 基于上下文动态生成，而不是从预定义列表中选择',
      });
    }
  }
  
  // 检查固定的分类映射
  const categoryMappings = code.match(/Record<[^>]+,\s*[^>]+>/g) || [];
  for (const match of categoryMappings) {
    issues.push({
      type: 'category_mapping',
      description: `发现固定分类映射: ${match}`,
      severity: 'low',
      suggestedFix: '考虑是否可以用动态判断替代固定映射',
    });
  }
  
  return issues;
}

/**
 * 使用 LLM 评估策略的泛化性
 */
export async function evaluateStrategyGeneralization(
  strategyDescription: string,
  currentResults: IterationResult[]
): Promise<{
  score: number;
  analysis: string;
  improvements: string[];
}> {
  const prompt = `你是一个策略泛化性评估专家。请评估以下策略的泛化能力。

策略描述：
${strategyDescription}

当前迭代结果：
${JSON.stringify(currentResults.slice(-3), null, 2)}

泛化性差的信号：
1. 硬编码的数字阈值（如"3题后切换"）
2. 硬编码的分类列表（如"Designer不能问DevOps"）
3. 固定的业务规则（如"高级别用户用激进模式"）
4. 不同用户群体的满意度方差过大

请评估：
1. 这个策略的泛化能力评分（0-10）
2. 存在哪些泛化性问题
3. 如何改进以提高泛化能力

以 JSON 格式返回：
{
  "score": number,
  "analysis": "详细分析",
  "improvements": ["改进建议1", "改进建议2", ...]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'generalization_evaluation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              analysis: { type: 'string' },
              improvements: { type: 'array', items: { type: 'string' } },
            },
            required: ['score', 'analysis', 'improvements'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[GeneralizationEvaluator] Error evaluating strategy:', error);
  }

  return {
    score: 5,
    analysis: '无法完成评估',
    improvements: [],
  };
}

// ==================== 上下文感知的问题生成 ====================

/**
 * 基于上下文信号决定是否应该切换主题
 */
export async function shouldSwitchTopic(
  conversationHistory: Array<{ role: string; content: string }>,
  currentTopic: string
): Promise<{ shouldSwitch: boolean; reason: string; suggestedNextTopic?: string }> {
  const recentMessages = conversationHistory.slice(-6);
  
  const prompt = `分析以下面试对话，判断是否应该切换到新的主题。

当前主题：${currentTopic}

最近对话：
${recentMessages.map(m => `${m.role}: ${m.content.slice(0, 300)}...`).join('\n\n')}

判断标准（基于信号，不是固定规则）：
1. 候选人的回答是否变得重复或浅显？
2. 当前主题是否已经充分探索？
3. 候选人是否在回答中暗示了其他值得探索的领域？
4. 对话是否陷入了循环？

以 JSON 格式返回：
{
  "shouldSwitch": boolean,
  "reason": "决策原因",
  "suggestedNextTopic": "如果需要切换，建议的下一个主题（基于候选人的回答内容）"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'topic_switch_decision',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              shouldSwitch: { type: 'boolean' },
              reason: { type: 'string' },
              suggestedNextTopic: { type: 'string' },
            },
            required: ['shouldSwitch', 'reason', 'suggestedNextTopic'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[GeneralizationEvaluator] Error deciding topic switch:', error);
  }

  return { shouldSwitch: false, reason: '无法判断' };
}

/**
 * 基于上下文生成下一个问题（不依赖硬编码规则）
 */
export async function generateContextAwareQuestion(
  conversationHistory: Array<{ role: string; content: string }>,
  candidateProfile: {
    position: string;
    company: string;
    background: string;
  },
  interviewProgress: {
    currentQuestion: number;
    totalQuestions: number;
    coveredTopics: string[];
  }
): Promise<{ question: string; topic: string; rationale: string }> {
  const recentMessages = conversationHistory.slice(-4);
  
  const prompt = `你是一位专业的面试官。基于候选人的回答，生成下一个自然延伸的问题。

候选人信息：
- 目标职位：${candidateProfile.position} at ${candidateProfile.company}
- 背景：${candidateProfile.background}

面试进度：${interviewProgress.currentQuestion}/${interviewProgress.totalQuestions}
已覆盖主题：${interviewProgress.coveredTopics.join(', ') || '无'}

最近对话：
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

要求：
1. 问题应该从候选人的回答中自然延伸，而不是从预定义列表中选择
2. 如果候选人提到了某个有趣的点，深入探索它
3. 如果当前主题已经充分探索，基于候选人展示的能力切换到相关主题
4. 问题应该具有挑战性，但与候选人的经历相关

以 JSON 格式返回：
{
  "question": "下一个问题",
  "topic": "这个问题探索的主题",
  "rationale": "为什么选择这个问题（基于候选人的回答）"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'context_aware_question',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              topic: { type: 'string' },
              rationale: { type: 'string' },
            },
            required: ['question', 'topic', 'rationale'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[GeneralizationEvaluator] Error generating question:', error);
  }

  return {
    question: 'Tell me more about your experience.',
    topic: 'general',
    rationale: 'Fallback question',
  };
}

// ==================== 辅助函数 ====================

function groupBy<T>(array: T[], keyFn: (item: T) => string | number): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = String(keyFn(item));
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function extractPositionType(position: string): string {
  const positionLower = position.toLowerCase();
  if (positionLower.includes('engineer') || positionLower.includes('developer')) return 'engineering';
  if (positionLower.includes('design')) return 'design';
  if (positionLower.includes('product')) return 'product';
  if (positionLower.includes('data') || positionLower.includes('analyst')) return 'data';
  if (positionLower.includes('marketing')) return 'marketing';
  if (positionLower.includes('sales')) return 'sales';
  return 'other';
}

function extractBackgroundType(background: string): string {
  const bgLower = background.toLowerCase();
  if (bgLower.includes('startup')) return 'startup';
  if (bgLower.includes('enterprise') || bgLower.includes('corporate')) return 'enterprise';
  if (bgLower.includes('freelance') || bgLower.includes('consultant')) return 'freelance';
  if (bgLower.includes('academic') || bgLower.includes('research')) return 'academic';
  return 'other';
}

// ==================== 泛化性报告生成 ====================

export interface GeneralizationReport {
  iteration: number;
  timestamp: string;
  score: GeneralizationScore;
  strategyEvaluation?: {
    score: number;
    analysis: string;
    improvements: string[];
  };
  codeIssues: GeneralizationIssue[];
  summary: string;
}

/**
 * 生成泛化性报告
 */
export async function generateGeneralizationReport(
  iteration: number,
  results: IterationResult[],
  strategyDescription?: string,
  codeToCheck?: string
): Promise<GeneralizationReport> {
  const score = calculateGeneralizationScore(results);
  
  let strategyEvaluation;
  if (strategyDescription) {
    strategyEvaluation = await evaluateStrategyGeneralization(strategyDescription, results);
  }
  
  let codeIssues: GeneralizationIssue[] = [];
  if (codeToCheck) {
    codeIssues = await checkCodeGeneralization(codeToCheck);
  }
  
  // 生成摘要
  const summary = generateSummary(score, strategyEvaluation, codeIssues);
  
  return {
    iteration,
    timestamp: new Date().toISOString(),
    score,
    strategyEvaluation,
    codeIssues,
    summary,
  };
}

function generateSummary(
  score: GeneralizationScore,
  strategyEvaluation?: { score: number; analysis: string; improvements: string[] },
  codeIssues?: GeneralizationIssue[]
): string {
  const parts: string[] = [];
  
  parts.push(`泛化能力总分: ${score.overall.toFixed(1)}/10`);
  
  if (score.dimensions.crossCriticalnessVariance > 2) {
    parts.push(`⚠️ 跨挑剔度方差过高 (${score.dimensions.crossCriticalnessVariance.toFixed(2)})`);
  }
  
  if (score.dimensions.robustness < 6) {
    parts.push(`⚠️ 边缘情况鲁棒性不足 (${score.dimensions.robustness.toFixed(1)}/10)`);
  }
  
  if (strategyEvaluation && strategyEvaluation.score < 7) {
    parts.push(`⚠️ 策略泛化性评分: ${strategyEvaluation.score}/10`);
  }
  
  if (codeIssues && codeIssues.length > 0) {
    const highSeverity = codeIssues.filter(i => i.severity === 'high').length;
    if (highSeverity > 0) {
      parts.push(`⚠️ 发现 ${highSeverity} 个高严重度的泛化性问题`);
    }
  }
  
  if (score.recommendations.length > 0) {
    parts.push(`建议: ${score.recommendations[0]}`);
  }
  
  return parts.join(' | ');
}
