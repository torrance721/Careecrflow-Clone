/**
 * 多维度评估器
 * 
 * 为高保真面试生成完整评估：
 * 1. 各维度评分（对标公司标准）
 * 2. 能力雷达图数据
 * 3. 竞争力分析
 * 4. 录用可能性预测
 * 5. 针对该公司的行动计划
 */

import { invokeLLM } from '../../_core/llm';
import type { 
  FullInterviewConfig,
  FullInterviewState,
  FullInterviewAssessment,
  TopicFeedback
} from './types';
import { generateTopicFeedback } from './topicFeedbackGenerator';

/**
 * 生成完整面试评估
 */
export async function generateFullAssessment(
  state: FullInterviewState,
  topicFeedbacks: TopicFeedback[]
): Promise<FullInterviewAssessment> {
  const { config, completedTopics } = state;
  
  // 汇总所有话题的表现
  const topicSummaries = completedTopics.map((topic, index) => {
    const feedback = topicFeedbacks[index];
    return {
      topic: topic.name,
      status: topic.status,
      score: feedback?.score || 0,
      strengths: feedback?.performanceAnalysis.strengths || [],
      gaps: feedback?.performanceAnalysis.gaps || []
    };
  });

  // 计算各维度评分
  const dimensionScores = await calculateDimensionScores(
    topicSummaries,
    config.company,
    config.position
  );

  // 生成能力雷达图数据
  const radarData = await generateRadarData(
    dimensionScores,
    config.company
  );

  // 竞争力分析
  const competitiveness = await analyzeCompetitiveness(
    dimensionScores,
    config.company,
    config.position
  );

  // 录用可能性预测
  const hiringPrediction = await predictHiringProbability(
    dimensionScores,
    competitiveness,
    config.company
  );

  // 行动计划
  const actionPlan = await generateActionPlan(
    topicFeedbacks,
    dimensionScores,
    config.company,
    config.position
  );

  // 整体评语
  const overallComment = await generateOverallComment(
    state,
    topicFeedbacks,
    competitiveness,
    hiringPrediction
  );

  return {
    config,
    topicFeedbacks,
    dimensionScores,
    radarData,
    competitiveness,
    hiringPrediction,
    actionPlan,
    overallComment
  };
}

/**
 * 计算各维度评分
 */
async function calculateDimensionScores(
  topicSummaries: Array<{
    topic: string;
    status: string;
    score: number;
    strengths: string[];
    gaps: string[];
  }>,
  company: string,
  position: string
): Promise<FullInterviewAssessment['dimensionScores']> {
  const prompt = `作为 ${company} 的面试评估专家，请根据候选人在各话题的表现，计算多维度评分。

## 候选人表现
${topicSummaries.map(t => `
### ${t.topic}
- 状态: ${t.status}
- 得分: ${t.score}/10
- 优点: ${t.strengths.join(', ')}
- 不足: ${t.gaps.join(', ')}
`).join('\n')}

## 评估维度（针对 ${position} 职位）
请评估以下维度，每个维度满分 10 分：
1. 技术能力 (Technical Skills)
2. 问题解决 (Problem Solving)
3. 沟通表达 (Communication)
4. 团队协作 (Teamwork)
5. 学习能力 (Learning Ability)
6. 文化匹配 (Culture Fit)

返回 JSON 数组：
[
  {
    "dimension": "维度名称",
    "score": 1-10,
    "maxScore": 10,
    "comment": "评分理由"
  }
]`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'dimension_scores',
          strict: true,
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dimension: { type: 'string' },
                score: { type: 'number' },
                maxScore: { type: 'number' },
                comment: { type: 'string' }
              },
              required: ['dimension', 'score', 'maxScore', 'comment'],
              additionalProperties: false
            }
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[calculateDimensionScores] Error:', error);
  }

  // 默认评分
  return [
    { dimension: '技术能力', score: 6, maxScore: 10, comment: '待评估' },
    { dimension: '问题解决', score: 6, maxScore: 10, comment: '待评估' },
    { dimension: '沟通表达', score: 6, maxScore: 10, comment: '待评估' },
    { dimension: '团队协作', score: 6, maxScore: 10, comment: '待评估' },
    { dimension: '学习能力', score: 6, maxScore: 10, comment: '待评估' },
    { dimension: '文化匹配', score: 6, maxScore: 10, comment: '待评估' }
  ];
}

/**
 * 生成能力雷达图数据
 */
async function generateRadarData(
  dimensionScores: FullInterviewAssessment['dimensionScores'],
  company: string
): Promise<FullInterviewAssessment['radarData']> {
  // 获取该公司的基准数据（模拟）
  const companyBenchmarks: Record<string, Record<string, number>> = {
    'Google': {
      '技术能力': 8.5,
      '问题解决': 8.5,
      '沟通表达': 7.5,
      '团队协作': 7.5,
      '学习能力': 8.0,
      '文化匹配': 7.0
    },
    'Meta': {
      '技术能力': 8.0,
      '问题解决': 8.0,
      '沟通表达': 7.5,
      '团队协作': 8.0,
      '学习能力': 7.5,
      '文化匹配': 7.5
    },
    'Amazon': {
      '技术能力': 7.5,
      '问题解决': 8.0,
      '沟通表达': 7.0,
      '团队协作': 7.5,
      '学习能力': 7.5,
      '文化匹配': 8.0
    }
  };

  const defaultBenchmark = {
    '技术能力': 7.0,
    '问题解决': 7.0,
    '沟通表达': 7.0,
    '团队协作': 7.0,
    '学习能力': 7.0,
    '文化匹配': 7.0
  };

  const benchmarks = companyBenchmarks[company] || defaultBenchmark;

  return dimensionScores.map(d => ({
    label: d.dimension,
    value: d.score,
    benchmark: benchmarks[d.dimension] || 7.0
  }));
}

/**
 * 分析竞争力
 */
async function analyzeCompetitiveness(
  dimensionScores: FullInterviewAssessment['dimensionScores'],
  company: string,
  position: string
): Promise<FullInterviewAssessment['competitiveness']> {
  const avgScore = dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length;
  
  // 简单的百分位计算（实际应该基于历史数据）
  let percentile: number;
  if (avgScore >= 8.5) percentile = 90;
  else if (avgScore >= 8.0) percentile = 80;
  else if (avgScore >= 7.5) percentile = 70;
  else if (avgScore >= 7.0) percentile = 60;
  else if (avgScore >= 6.5) percentile = 50;
  else if (avgScore >= 6.0) percentile = 40;
  else percentile = 30;

  const prompt = `根据以下评分数据，为候选人生成竞争力分析。

## 评分数据
${dimensionScores.map(d => `- ${d.dimension}: ${d.score}/10`).join('\n')}

## 目标
- 公司: ${company}
- 职位: ${position}
- 预估百分位: ${percentile}%

请生成一段 50-100 字的竞争力分析，说明候选人的优势和需要提升的地方。

直接返回分析文本。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return {
        percentile,
        analysis: content
      };
    }
  } catch (error) {
    console.error('[analyzeCompetitiveness] Error:', error);
  }

  return {
    percentile,
    analysis: `基于本次面试表现，您的综合能力优于约 ${percentile}% 的候选人。`
  };
}

/**
 * 预测录用可能性
 */
async function predictHiringProbability(
  dimensionScores: FullInterviewAssessment['dimensionScores'],
  competitiveness: FullInterviewAssessment['competitiveness'],
  company: string
): Promise<FullInterviewAssessment['hiringPrediction']> {
  const avgScore = dimensionScores.reduce((sum, d) => sum + d.score, 0) / dimensionScores.length;
  
  // 基于平均分和百分位计算录用概率
  let probability: number;
  if (avgScore >= 8.5) probability = 85;
  else if (avgScore >= 8.0) probability = 70;
  else if (avgScore >= 7.5) probability = 55;
  else if (avgScore >= 7.0) probability = 40;
  else if (avgScore >= 6.5) probability = 25;
  else probability = 15;

  // 生成关键因素
  const keyFactors = dimensionScores.map(d => ({
    factor: d.dimension,
    impact: d.score >= 7.5 ? 'positive' as const : d.score >= 6.0 ? 'neutral' as const : 'negative' as const,
    weight: getFactorWeight(d.dimension, company)
  }));

  return {
    probability,
    keyFactors
  };
}

/**
 * 获取因素权重
 */
function getFactorWeight(dimension: string, company: string): number {
  const companyWeights: Record<string, Record<string, number>> = {
    'Google': {
      '技术能力': 0.25,
      '问题解决': 0.25,
      '沟通表达': 0.15,
      '团队协作': 0.15,
      '学习能力': 0.15,
      '文化匹配': 0.05
    },
    'Amazon': {
      '技术能力': 0.20,
      '问题解决': 0.20,
      '沟通表达': 0.15,
      '团队协作': 0.15,
      '学习能力': 0.10,
      '文化匹配': 0.20 // Amazon 重视 LP
    }
  };

  const defaultWeights: Record<string, number> = {
    '技术能力': 0.20,
    '问题解决': 0.20,
    '沟通表达': 0.15,
    '团队协作': 0.15,
    '学习能力': 0.15,
    '文化匹配': 0.15
  };

  const weights = companyWeights[company] || defaultWeights;
  return weights[dimension] || 0.15;
}

/**
 * 生成行动计划
 */
async function generateActionPlan(
  topicFeedbacks: TopicFeedback[],
  dimensionScores: FullInterviewAssessment['dimensionScores'],
  company: string,
  position: string
): Promise<FullInterviewAssessment['actionPlan']> {
  // 找出需要提升的维度
  const weakDimensions = dimensionScores
    .filter(d => d.score < 7)
    .sort((a, b) => a.score - b.score);

  // 汇总所有改进建议
  const allSuggestions = topicFeedbacks.flatMap(f => [
    ...f.improvementSuggestions.immediate,
    ...f.improvementSuggestions.longTerm
  ]);

  const prompt = `作为职业导师，请为候选人生成针对 ${company} ${position} 职位的行动计划。

## 需要提升的维度
${weakDimensions.map(d => `- ${d.dimension}: ${d.score}/10 - ${d.comment}`).join('\n') || '无明显短板'}

## 面试中的改进建议
${allSuggestions.slice(0, 10).map(s => `- ${s}`).join('\n')}

## 要求
生成 3-5 个具体的行动项，包括：
1. 优先级（high/medium/low）
2. 具体行动
3. 预期效果
4. 建议时间框架

返回 JSON 数组：
[
  {
    "priority": "high" | "medium" | "low",
    "action": "具体行动",
    "expectedImpact": "预期效果",
    "suggestedTimeframe": "建议时间"
  }
]`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'action_plan',
          strict: true,
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                action: { type: 'string' },
                expectedImpact: { type: 'string' },
                suggestedTimeframe: { type: 'string' }
              },
              required: ['priority', 'action', 'expectedImpact', 'suggestedTimeframe'],
              additionalProperties: false
            }
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[generateActionPlan] Error:', error);
  }

  // 默认行动计划
  return [
    {
      priority: 'high',
      action: '针对薄弱维度进行专项练习',
      expectedImpact: '提升面试通过率',
      suggestedTimeframe: '1-2 周'
    },
    {
      priority: 'medium',
      action: '研究目标公司的面试风格和文化',
      expectedImpact: '更好地展示文化匹配',
      suggestedTimeframe: '1 周'
    }
  ];
}

/**
 * 生成整体评语
 */
async function generateOverallComment(
  state: FullInterviewState,
  topicFeedbacks: TopicFeedback[],
  competitiveness: FullInterviewAssessment['competitiveness'],
  hiringPrediction: FullInterviewAssessment['hiringPrediction']
): Promise<string> {
  const { config, completedTopics, endReason } = state;
  
  const avgScore = topicFeedbacks.reduce((sum, f) => sum + f.score, 0) / topicFeedbacks.length;

  const prompt = `作为面试评估专家，请为候选人生成一段整体评语。

## 面试信息
- 公司: ${config.company}
- 职位: ${config.position}
- 完成话题数: ${completedTopics.length}
- 结束原因: ${endReason || 'completed'}

## 表现数据
- 平均得分: ${avgScore.toFixed(1)}/10
- 竞争力百分位: ${competitiveness.percentile}%
- 录用可能性: ${hiringPrediction.probability}%

## 要求
1. 100-150 字
2. 客观、专业、鼓励性
3. 突出亮点和改进方向
4. 给出下一步建议

直接返回评语文本。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateOverallComment] Error:', error);
  }

  return `本次 ${config.company} ${config.position} 模拟面试完成。您的整体表现处于中等偏上水平，展示了良好的基础能力。建议针对面试中暴露的不足进行专项练习，相信通过持续努力，您一定能够获得理想的 offer。`;
}

/**
 * 为所有完成的话题生成反馈
 */
export async function generateAllTopicFeedbacks(
  state: FullInterviewState
): Promise<TopicFeedback[]> {
  const feedbacks: TopicFeedback[] = [];
  
  for (const topic of state.completedTopics) {
    const feedback = await generateTopicFeedback(topic, state.config.position);
    feedbacks.push(feedback);
  }
  
  return feedbacks;
}
