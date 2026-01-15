/**
 * 话题反馈生成器
 * 
 * 生成专业的单话题反馈，展示 UHired 的专业能力：
 * 1. 问题来源说明（来自哪个公司真实面试）
 * 2. 考核能力说明（面试官想评估什么）
 * 3. 具体表现分析（你提到了A、B，缺少C）
 * 4. 改进建议（下次可以用STAR结构）
 * 5. 公司匹配推荐
 */

import { invokeLLM } from '../../_core/llm';
import { recommendJobs, JobRecommendationOutput, RecommendedJob } from '../react/jobRecommendationAgent';
import { generateFeedback, FeedbackGenerationOutput } from '../react/feedbackGenerationAgent';
import type { TopicContext, TopicFeedback, CompanyMatch } from './types';

/**
 * 生成单话题反馈（使用 FeedbackGenerationAgent）
 */
export async function generateTopicFeedback(
  topicContext: TopicContext,
  targetPosition: string,
  resumeSummary?: string
): Promise<TopicFeedback> {
  // 尝试使用 FeedbackGenerationAgent 生成深度反馈
  try {
    const agentFeedback = await generateFeedback({
      resumeSummary,
      collectedInfo: topicContext.collectedInfo,
      completedTopics: [topicContext],
      targetPosition,
      conversationHistory: topicContext.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    });
    
    if (agentFeedback.dimensions.length > 0) {
      // 将 Agent 输出转换为 TopicFeedback 格式
      return convertAgentFeedbackToTopicFeedback(topicContext, agentFeedback);
    }
  } catch (error) {
    console.error('[generateTopicFeedback] FeedbackGenerationAgent error:', error);
  }
  
  // 回退到原来的 LLM 方式
  return generateTopicFeedbackFallback(topicContext, targetPosition);
}

/**
 * 将 FeedbackGenerationAgent 输出转换为 TopicFeedback 格式
 */
function convertAgentFeedbackToTopicFeedback(
  topicContext: TopicContext,
  agentFeedback: FeedbackGenerationOutput
): TopicFeedback {
  // 提取优势和不足
  const strengths = agentFeedback.strengths.length > 0 
    ? agentFeedback.strengths 
    : agentFeedback.dimensions.filter(d => d.score >= 7).map(d => d.feedback);
  
  const gaps = agentFeedback.improvements.length > 0
    ? agentFeedback.improvements
    : agentFeedback.dimensions.filter(d => d.score < 7).map(d => d.improvement);
  
  // 生成详细分析（引用用户原话）
  const detailsWithQuotes = agentFeedback.dimensions
    .filter(d => d.userQuote)
    .map(d => `**${d.name}**: ${d.feedback}${d.userQuote ? `\n> "你提到: ${d.userQuote}"` : ''}`)
    .join('\n\n');
  
  return {
    topicId: topicContext.id,
    questionSource: {
      description: `这是一个常见的 ${agentFeedback.jobFunction} 面试问题`,
      frequency: 'high'
    },
    targetAbility: {
      primary: topicContext.targetSkills[0] || agentFeedback.jobFunction,
      secondary: topicContext.targetSkills.slice(1),
      rationale: agentFeedback.overallAssessment
    },
    performanceAnalysis: {
      strengths: strengths.slice(0, 3),
      gaps: gaps.slice(0, 3),
      details: detailsWithQuotes || agentFeedback.overallAssessment
    },
    improvementSuggestions: {
      immediate: agentFeedback.actionItems.slice(0, 2),
      longTerm: agentFeedback.improvements.slice(0, 2),
      resources: []
    },
    score: agentFeedback.overallScore
  };
}

/**
 * 回退方案：使用 LLM 生成反馈
 */
async function generateTopicFeedbackFallback(
  topicContext: TopicContext,
  targetPosition: string
): Promise<TopicFeedback> {
  const collectedInfoSummary = topicContext.collectedInfo
    .map(info => `- ${info.type}: ${info.summary} (深度: ${info.depth}/5)`)
    .join('\n');

  const conversationSummary = topicContext.messages
    .map(m => `${m.role === 'user' ? '候选人' : '面试官'}: ${m.content}`)
    .join('\n\n');

  const prompt = `你是一位资深面试官和职业导师。请为候选人生成专业、有价值的面试反馈。

## 面试信息
- 目标职位: ${targetPosition}
- 话题: ${topicContext.name}
- 考核能力: ${topicContext.targetSkills.join(', ')}
- 话题来源: ${topicContext.source || '通用面试问题'}

## 已收集的信息
${collectedInfoSummary || '信息较少'}

## 完整对话
${conversationSummary}

## 反馈要求

请生成以下内容：

### 1. 问题来源说明
- 说明这个问题来自哪类公司的真实面试
- 说明问题的出现频率（高频/中频/低频）

### 2. 考核能力说明
- 主要考核什么能力
- 为什么面试官会问这个问题
- 这个能力在实际工作中的重要性

### 3. 表现分析
- 候选人做得好的点（具体引用回答内容）
- 候选人缺少的点（具体指出）
- 整体分析

### 4. 改进建议
- 立即可做的改进（如回答结构、表达方式）
- 长期提升方向（如技能积累、经验拓展）
- 推荐的学习资源（可选）

### 5. 评分
- 给出 1-10 分的评分，并说明理由

返回 JSON 格式：
{
  "questionSource": {
    "company": "公司名称（如 Google、Meta，或 null）",
    "description": "问题来源描述",
    "frequency": "high" | "medium" | "low"
  },
  "targetAbility": {
    "primary": "主要考核能力",
    "secondary": ["次要能力1", "次要能力2"],
    "rationale": "为什么考核这个能力"
  },
  "performanceAnalysis": {
    "strengths": ["做得好的点1", "做得好的点2"],
    "gaps": ["缺少的点1", "缺少的点2"],
    "details": "详细分析"
  },
  "improvementSuggestions": {
    "immediate": ["立即改进1", "立即改进2"],
    "longTerm": ["长期提升1", "长期提升2"],
    "resources": ["推荐资源1"]
  },
  "score": 7
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'topic_feedback',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              questionSource: {
                type: 'object',
                properties: {
                  company: { type: ['string', 'null'] },
                  description: { type: 'string' },
                  frequency: { type: 'string', enum: ['high', 'medium', 'low'] }
                },
                required: ['description', 'frequency'],
                additionalProperties: false
              },
              targetAbility: {
                type: 'object',
                properties: {
                  primary: { type: 'string' },
                  secondary: { type: 'array', items: { type: 'string' } },
                  rationale: { type: 'string' }
                },
                required: ['primary', 'secondary', 'rationale'],
                additionalProperties: false
              },
              performanceAnalysis: {
                type: 'object',
                properties: {
                  strengths: { type: 'array', items: { type: 'string' } },
                  gaps: { type: 'array', items: { type: 'string' } },
                  details: { type: 'string' }
                },
                required: ['strengths', 'gaps', 'details'],
                additionalProperties: false
              },
              improvementSuggestions: {
                type: 'object',
                properties: {
                  immediate: { type: 'array', items: { type: 'string' } },
                  longTerm: { type: 'array', items: { type: 'string' } },
                  resources: { type: 'array', items: { type: 'string' } }
                },
                required: ['immediate', 'longTerm'],
                additionalProperties: false
              },
              score: { type: 'number' }
            },
            required: ['questionSource', 'targetAbility', 'performanceAnalysis', 'improvementSuggestions', 'score'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response?.choices?.[0]?.message?.content;
    if (content && typeof content === 'string') {
      const parsed = JSON.parse(content);
      return {
        topicId: topicContext.id,
        ...parsed
      };
    }
  } catch (error) {
    console.error('[TopicFeedbackGenerator] Error:', error);
  }

  // 默认反馈
  return {
    topicId: topicContext.id,
    questionSource: {
      description: '常见面试问题',
      frequency: 'medium'
    },
    targetAbility: {
      primary: topicContext?.targetSkills?.[0] || '综合能力',
      secondary: topicContext?.targetSkills?.slice(1) || [],
      rationale: '这是评估候选人能力的重要维度'
    },
    performanceAnalysis: {
      strengths: ['积极参与面试'],
      gaps: ['可以提供更多具体细节'],
      details: '建议在回答中加入更多具体的例子和数据'
    },
    improvementSuggestions: {
      immediate: ['使用 STAR 结构组织回答'],
      longTerm: ['积累更多项目经验']
    },
    score: 6
  };
}

/**
 * 生成公司匹配推荐（使用 ReAct Agent）
 */
export async function generateCompanyMatches(
  completedTopics: TopicContext[],
  targetPosition: string
): Promise<CompanyMatch[]> {
  const allCollectedInfo = completedTopics.flatMap(t => t.collectedInfo);
  
  try {
    // 使用 JobRecommendationAgent 获取真实职位推荐
    const jobRecommendations = await recommendJobs({
      collectedInfo: allCollectedInfo,
      completedTopics,
      targetPosition
    });
    
    // 将职位推荐转换为 CompanyMatch 格式
    if (jobRecommendations.recommendations && jobRecommendations.recommendations.length > 0) {
      const matches = convertToCompanyMatches(jobRecommendations);
      if (matches.length > 0) {
        return matches;
      }
    }
    
    // 如果没有推荐，记录日志并回退
    console.log('[generateCompanyMatches] No recommendations from JobRecommendationAgent, falling back to LLM');
  } catch (error) {
    // 捕获所有错误，确保不会导致进程崩溃
    console.error('[generateCompanyMatches] JobRecommendationAgent error (falling back to LLM):', error instanceof Error ? error.message : error);
  }
  
  // 回退到原来的 LLM 方式
  try {
    return await generateCompanyMatchesFallback(completedTopics, targetPosition);
  } catch (fallbackError) {
    console.error('[generateCompanyMatches] Fallback also failed:', fallbackError instanceof Error ? fallbackError.message : fallbackError);
    // Return default recommendations
    return [
      {
        company: 'Tech Company',
        matchScore: 70,
        reasons: ['Position match'],
        keySkills: ['Technical ability', 'Communication skills'],
        preparationTips: ['Learn about company products', 'Prepare technical questions']
      }
    ];
  }
}

/**
 * 将 JobRecommendationOutput 转换为 CompanyMatch[]
 */
function convertToCompanyMatches(output: JobRecommendationOutput): CompanyMatch[] {
  const companyMap = new Map<string, CompanyMatch>();
  
  for (const job of output.recommendations) {
    const existing = companyMap.get(job.company);
    if (existing) {
      // 合并同一公司的多个职位，但保留匹配度最高的职位信息
      if (job.matchScore > existing.matchScore) {
        existing.matchScore = job.matchScore;
        existing.jobTitle = job.title;
        existing.linkedinUrl = job.linkedinUrl;
      }
      existing.reasons = Array.from(new Set([...existing.reasons, ...job.recommendationReasons]));
      existing.keySkills = Array.from(new Set([...existing.keySkills, ...job.matchedSkills]));
      existing.preparationTips = Array.from(new Set([...existing.preparationTips, ...job.applicationTips]));
    } else {
      companyMap.set(job.company, {
        company: job.company,
        jobTitle: job.title,
        linkedinUrl: job.linkedinUrl,
        matchScore: job.matchScore,
        reasons: job.recommendationReasons,
        keySkills: job.matchedSkills,
        preparationTips: job.applicationTips
      });
    }
  }
  
  return Array.from(companyMap.values())
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}

/**
 * 回退方案：使用 LLM 生成公司推荐
 */
async function generateCompanyMatchesFallback(
  completedTopics: TopicContext[],
  targetPosition: string
): Promise<CompanyMatch[]> {
  const allCollectedInfo = completedTopics.flatMap(t => t.collectedInfo);
  
  const skillsSummary = allCollectedInfo
    .filter(info => info.type === 'skill_claim')
    .map(info => info.summary)
    .join(', ');

  const experienceSummary = allCollectedInfo
    .filter(info => info.type === 'project_experience')
    .map(info => info.summary)
    .join('; ');

  const prompt = `As a career advisor, please recommend matching companies based on the candidate's demonstrated abilities.

## Candidate Information
- Target Position: ${targetPosition}
- Demonstrated Skills: ${skillsSummary || 'To be evaluated'}
- Project Experience: ${experienceSummary || 'To be evaluated'}

## Requirements
1. Recommend 3-5 matching companies
2. Explain matching reasons
3. Describe key skills valued by each company
4. Provide preparation tips

Return JSON array in English:
[
  {
    "company": "Company Name",
    "matchScore": 0-100,
    "reasons": ["reason1", "reason2"],
    "keySkills": ["skill1", "skill2"],
    "preparationTips": ["tip1", "tip2"]
  }
]`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'company_matches',
          strict: true,
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                company: { type: 'string' },
                matchScore: { type: 'number' },
                reasons: { type: 'array', items: { type: 'string' } },
                keySkills: { type: 'array', items: { type: 'string' } },
                preparationTips: { type: 'array', items: { type: 'string' } }
              },
              required: ['company', 'matchScore', 'reasons', 'keySkills', 'preparationTips'],
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
    console.error('[generateCompanyMatchesFallback] Error:', error);
  }

  // Default recommendations
  return [
    {
      company: 'Tech Company',
      matchScore: 70,
      reasons: ['Position match'],
      keySkills: ['Technical ability', 'Communication skills'],
      preparationTips: ['Learn about company products', 'Prepare technical questions']
    }
  ];
}

/**
 * 获取完整的职位推荐结果（包含真实职位链接）
 */
export async function getJobRecommendations(
  completedTopics: TopicContext[],
  targetPosition: string,
  resumeSummary?: string,
  preferredLocation?: string,
  preferredWorkType?: 'remote' | 'onsite' | 'hybrid'
): Promise<JobRecommendationOutput> {
  const allCollectedInfo = completedTopics.flatMap(t => t.collectedInfo);
  
  return recommendJobs({
    collectedInfo: allCollectedInfo,
    completedTopics,
    targetPosition,
    resumeSummary,
    preferredLocation,
    preferredWorkType
  });
}

/**
 * 生成话题结束时的过渡语
 */
export function generateTopicTransition(
  feedback: TopicFeedback,
  hasMoreTopics: boolean
): string {
  const scoreComment = feedback.score >= 8 
    ? '表现很不错！' 
    : feedback.score >= 6 
      ? '有一些亮点，也有提升空间。' 
      : '这个话题有些挑战，但没关系，这正是练习的意义。';

  if (hasMoreTopics) {
    return `${scoreComment}

关于这个话题，我有一些反馈想分享给你。

如果你准备好了，我们可以继续下一个话题。或者，你也可以：
- 说"换个话题"来跳过
- 说"结束面试"来获取整体评估

你想怎么做？`;
  } else {
    return `${scoreComment}

这是我们今天讨论的最后一个话题。让我为你生成一份完整的评估报告...`;
  }
}

/**
 * 生成鼓励性反馈（当用户放弃话题时）
 */
export function generateEncouragementFeedback(
  topicContext: TopicContext,
  targetPosition: string
): TopicFeedback {
  return {
    topicId: topicContext.id,
    questionSource: {
      description: '这是一个常见的面试话题',
      frequency: 'medium'
    },
    targetAbility: {
      primary: topicContext.targetSkills[0] || '相关能力',
      secondary: [],
      rationale: '这个能力在实际工作中很重要，但不是唯一的评估维度'
    },
    performanceAnalysis: {
      strengths: ['诚实地表达了自己的情况'],
      gaps: ['这个领域可能需要更多积累'],
      details: '没关系，面试是一个学习的过程。知道自己的短板是进步的第一步。'
    },
    improvementSuggestions: {
      immediate: [
        '可以准备 1-2 个相关的小项目或学习经历',
        '即使经验有限，也可以分享你的学习过程和思考'
      ],
      longTerm: [
        `针对 ${targetPosition} 职位，建议深入学习 ${topicContext.targetSkills.join('、')}`,
        '可以通过实际项目来积累经验'
      ],
      resources: [
        '在线课程平台（Coursera、Udemy）',
        '技术博客和文档'
      ]
    },
    score: 4
  };
}
