/**
 * Multi-Grader Evaluation System
 * 
 * 多维度评估系统：
 * 1. 规则检查（快速，确定性）
 * 2. LLM-as-Judge（慢，但能捕捉细微问题）
 * 3. 相似度检查（防止重复）
 */

import { invokeLLM } from '../../_core/llm';
import { 
  Grader, 
  RuleGrader, 
  LLMGrader, 
  SimilarityGrader, 
  MultiGraderConfig, 
  GradeResult 
} from './types';

/**
 * 执行规则检查
 */
async function executeRuleGrader(
  grader: RuleGrader,
  output: unknown,
  context: unknown
): Promise<{ score: number; feedback?: string }> {
  try {
    const score = grader.check(output, context);
    return {
      score: Math.max(0, Math.min(1, score)),
      feedback: score >= 0.8 ? 'Passed' : 'Needs improvement',
    };
  } catch (error) {
    console.error(`[MultiGrader] Rule grader "${grader.name}" failed:`, error);
    return { score: 0.5, feedback: 'Error during evaluation' };
  }
}

/**
 * 执行 LLM 评估
 */
async function executeLLMGrader(
  grader: LLMGrader,
  output: unknown,
  context: unknown
): Promise<{ score: number; feedback?: string }> {
  try {
    const prompt = grader.prompt
      .replace('{{output}}', JSON.stringify(output, null, 2))
      .replace('{{context}}', JSON.stringify(context, null, 2));

    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `You are an expert evaluator. Score the output from 0 to 1 (0 = terrible, 1 = perfect).
Return JSON format: { "score": number, "feedback": "brief explanation" }`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'evaluation_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              score: { type: 'number', description: 'Score from 0 to 1' },
              feedback: { type: 'string', description: 'Brief explanation' },
            },
            required: ['score', 'feedback'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const result = JSON.parse(content);
      return {
        score: Math.max(0, Math.min(1, result.score)),
        feedback: result.feedback,
      };
    }
  } catch (error) {
    console.error(`[MultiGrader] LLM grader "${grader.name}" failed:`, error);
  }
  
  return { score: 0.5, feedback: 'LLM evaluation failed' };
}

/**
 * 计算文本相似度（简单的 Jaccard 相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  // Calculate intersection
  const intersection = words1.filter(x => set2.has(x));
  const intersectionSet = new Set(intersection);
  
  // Calculate union
  const unionSet = new Set([...words1, ...words2]);
  
  return intersectionSet.size / unionSet.size;
}

/**
 * 执行相似度检查
 */
async function executeSimilarityGrader(
  grader: SimilarityGrader,
  output: unknown,
  _context: unknown
): Promise<{ score: number; feedback?: string }> {
  try {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    
    let maxSimilarity = 0;
    let mostSimilarTo = '';
    
    for (const compareText of grader.compareWith) {
      const similarity = calculateSimilarity(outputStr, compareText);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarTo = compareText.slice(0, 50) + '...';
      }
    }
    
    // 如果相似度超过阈值，说明太相似了（不好）
    // 所以分数 = 1 - (相似度超过阈值的部分)
    const score = maxSimilarity > grader.threshold 
      ? Math.max(0, 1 - (maxSimilarity - grader.threshold) * 2)
      : 1;
    
    return {
      score,
      feedback: maxSimilarity > grader.threshold 
        ? `Too similar to existing content (${(maxSimilarity * 100).toFixed(1)}% similar to "${mostSimilarTo}")`
        : 'Sufficiently unique',
    };
  } catch (error) {
    console.error(`[MultiGrader] Similarity grader "${grader.name}" failed:`, error);
    return { score: 0.5, feedback: 'Error during similarity check' };
  }
}

/**
 * Multi-Grader 主类
 */
export class MultiGrader {
  private config: MultiGraderConfig;

  constructor(config: MultiGraderConfig) {
    this.config = config;
  }

  /**
   * 执行所有评估
   */
  async evaluate(output: unknown, context: unknown): Promise<GradeResult> {
    const details: GradeResult['details'] = [];
    
    for (const grader of this.config.graders) {
      let result: { score: number; feedback?: string };
      
      switch (grader.type) {
        case 'rule':
          result = await executeRuleGrader(grader, output, context);
          break;
        case 'llm_judge':
          result = await executeLLMGrader(grader, output, context);
          break;
        case 'similarity':
          result = await executeSimilarityGrader(grader, output, context);
          break;
        default:
          result = { score: 0.5, feedback: 'Unknown grader type' };
      }
      
      details.push({
        graderName: grader.name,
        score: result.score,
        feedback: result.feedback,
      });
    }
    
    // 计算总分
    const overallScore = this.aggregateScores(details);
    
    return { overallScore, details };
  }

  /**
   * 聚合分数
   */
  private aggregateScores(details: GradeResult['details']): number {
    if (details.length === 0) return 0;
    
    switch (this.config.aggregation) {
      case 'min':
        return Math.min(...details.map(d => d.score));
        
      case 'weighted':
        if (!this.config.weights) {
          return details.reduce((sum, d) => sum + d.score, 0) / details.length;
        }
        let totalWeight = 0;
        let weightedSum = 0;
        for (const detail of details) {
          const weight = this.config.weights[detail.graderName] || 1;
          weightedSum += detail.score * weight;
          totalWeight += weight;
        }
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
        
      case 'average':
      default:
        return details.reduce((sum, d) => sum + d.score, 0) / details.length;
    }
  }
}

// ==================== 预定义的 Graders ====================

/**
 * 问题生成模块的 Graders
 */
export const questionGenerationGraders: Grader[] = [
  {
    type: 'rule',
    name: 'has_question',
    description: 'Check if output contains a valid question',
    check: (output: unknown) => {
      if (!output || typeof output !== 'object') return 0;
      const q = (output as { question?: string }).question;
      return q && q.length > 10 && q.includes('?') ? 1 : 0;
    },
  },
  {
    type: 'rule',
    name: 'appropriate_length',
    description: 'Check if question has appropriate length',
    check: (output: unknown) => {
      if (!output || typeof output !== 'object') return 0;
      const q = (output as { question?: string }).question;
      if (!q) return 0;
      // 问题长度在 20-500 字符之间
      if (q.length < 20) return 0.3;
      if (q.length > 500) return 0.7;
      return 1;
    },
  },
  {
    type: 'llm_judge',
    name: 'relevance_quality',
    description: 'LLM evaluates question relevance and quality',
    prompt: `Evaluate this interview question:
{{output}}

Context (job info, user background):
{{context}}

Score based on:
1. Relevance to the position (0-0.4)
2. Appropriate difficulty (0-0.3)
3. Clear and professional wording (0-0.3)`,
  },
];

/**
 * Hint 系统的 Graders
 */
export const hintSystemGraders: Grader[] = [
  {
    type: 'rule',
    name: 'has_hint',
    description: 'Check if output contains a valid hint',
    check: (output: unknown) => {
      if (!output || typeof output !== 'object') return 0;
      const h = (output as { hint?: string }).hint;
      return h && h.length > 10 ? 1 : 0;
    },
  },
  {
    type: 'rule',
    name: 'not_direct_answer',
    description: 'Check that hint does not give away the answer',
    check: (output: unknown) => {
      if (!output || typeof output !== 'object') return 0;
      const h = (output as { hint?: string }).hint?.toLowerCase() || '';
      // 如果包含"答案是"、"应该说"等直接给答案的词，扣分
      const directAnswerPatterns = ['the answer is', 'you should say', '答案是', '应该说'];
      const hasDirectAnswer = directAnswerPatterns.some(p => h.includes(p));
      return hasDirectAnswer ? 0.3 : 1;
    },
  },
  {
    type: 'llm_judge',
    name: 'helpfulness',
    description: 'LLM evaluates hint helpfulness',
    prompt: `Evaluate this interview hint:
{{output}}

Context (question, user's attempt):
{{context}}

Score based on:
1. Guides thinking without giving answer (0-0.5)
2. Actionable and specific (0-0.3)
3. Encouraging tone (0-0.2)`,
  },
];

/**
 * 下一题决策的 Graders
 */
export const nextQuestionGraders: Grader[] = [
  {
    type: 'rule',
    name: 'valid_decision',
    description: 'Check if decision type is valid',
    check: (output: unknown) => {
      if (!output || typeof output !== 'object') return 0;
      const type = (output as { questionType?: string }).questionType;
      const validTypes = ['follow_up', 'new_topic', 'deep_dive', 'closing'];
      return validTypes.includes(type || '') ? 1 : 0;
    },
  },
  {
    type: 'rule',
    name: 'has_reasoning',
    description: 'Check if decision includes reasoning',
    check: (output: unknown) => {
      if (!output || typeof output !== 'object') return 0;
      const r = (output as { reasoning?: string }).reasoning;
      return r && r.length > 20 ? 1 : 0.3;
    },
  },
  {
    type: 'llm_judge',
    name: 'decision_quality',
    description: 'LLM evaluates decision appropriateness',
    prompt: `Evaluate this next question decision:
{{output}}

Context (conversation history, interview progress):
{{context}}

Score based on:
1. Appropriate decision type for the situation (0-0.4)
2. Good topic coverage strategy (0-0.3)
3. Considers user's previous response quality (0-0.3)`,
  },
];

/**
 * 创建 Multi-Grader 的工厂函数
 */
export function createMultiGrader(
  moduleName: string,
  customGraders?: Grader[]
): MultiGrader {
  let graders: Grader[];
  
  switch (moduleName) {
    case 'question_generation':
      graders = customGraders || questionGenerationGraders;
      break;
    case 'hint_system':
      graders = customGraders || hintSystemGraders;
      break;
    case 'next_question':
      graders = customGraders || nextQuestionGraders;
      break;
    default:
      graders = customGraders || [];
  }
  
  return new MultiGrader({
    graders,
    aggregation: 'weighted',
    weights: {
      // 规则检查权重较低（基础检查）
      has_question: 0.5,
      appropriate_length: 0.3,
      has_hint: 0.5,
      not_direct_answer: 0.8,
      valid_decision: 0.5,
      has_reasoning: 0.3,
      // LLM 评估权重较高（质量检查）
      relevance_quality: 1.0,
      helpfulness: 1.0,
      decision_quality: 1.0,
    },
  });
}
