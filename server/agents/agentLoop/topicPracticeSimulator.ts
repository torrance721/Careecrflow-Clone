/**
 * Topic Practice Simulator
 * 
 * 模拟话题练习模式的完整流程：
 * 1. 选择话题开始练习
 * 2. 根据 Persona 的 trustLevel 决定回答风格
 * 3. 根据需要请求提示
 * 4. 评估反馈和职位推荐质量
 * 5. 提供满意度反馈
 */

import { invokeLLM } from '../../_core/llm';
import { MockPersona, TARGET_USER_CONSTRAINTS } from './personaGenerator';
import { generateTopicFeedback, generateCompanyMatches } from '../interviewModes/topicFeedbackGenerator';
import type { TopicContext, CollectedInfoPoint, TopicFeedback, CompanyMatch } from '../interviewModes/types';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 辅助函数 ====================

/**
 * 从模拟数据构建 TopicContext
 */
function buildTopicContextFromSimulation(
  topicName: string,
  messages: TopicPracticeMessage[],
  persona: MockPersona
): TopicContext {
  // 从消息中提取用户回答作为信息点
  const userMessages = messages.filter(m => m.role === 'user' && m.content !== '给我提示' && m.content !== '我想看看反馈');
  
  const collectedInfo: CollectedInfoPoint[] = userMessages.map((m, i) => ({
    type: 'project_experience' as const,
    summary: m.content.slice(0, 200),
    depth: Math.min(3 + i, 5),
    needsFollowUp: false
  }));
  
  return {
    id: `topic_${Date.now()}`,
    name: topicName,
    status: 'collected',
    startedAt: messages[0]?.timestamp || new Date().toISOString(),
    endedAt: new Date().toISOString(),
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp
    })),
    collectedInfo,
    targetSkills: [topicName, '沟通能力', '问题解决']
  };
}

/**
 * 格式化反馈用于显示
 */
function formatFeedbackForDisplay(feedback: TopicFeedback): string {
  return `## ${feedback.questionSource.description}\n\n` +
    `**考核能力**: ${feedback.targetAbility.primary}\n\n` +
    `**你的优势**:\n${feedback.performanceAnalysis.strengths.map(s => `- ${s}`).join('\n')}\n\n` +
    `**改进建议**:\n${feedback.performanceAnalysis.gaps.map(g => `- ${g}`).join('\n')}\n\n` +
    `**详细分析**: ${feedback.performanceAnalysis.details}\n\n` +
    `**评分**: ${feedback.score}/10`;
}

/**
 * 格式化推荐用于显示
 */
function formatRecommendationsForDisplay(matches: CompanyMatch[]): string {
  if (!matches || matches.length === 0) {
    return '## 职位推荐\n\n暂无匹配的职位推荐';
  }
  
  return `## 职位推荐\n\n` +
    matches.map((m, i) => {
      // 安全地处理可能为 undefined 的数组
      const reasons = Array.isArray(m.reasons) ? m.reasons.join(', ') : '职位匹配';
      const keySkills = Array.isArray(m.keySkills) ? m.keySkills.join(', ') : '待评估';
      const preparationTips = Array.isArray(m.preparationTips) ? m.preparationTips.join(', ') : '了解公司产品';
      
      return `### ${i + 1}. ${m.company || '未知公司'} (匹配度: ${m.matchScore || 70}%)\n` +
        `**推荐理由**: ${reasons}\n` +
        `**关键技能**: ${keySkills}\n` +
        `**准备建议**: ${preparationTips}`;
    }).join('\n\n');
}

// ==================== 类型定义 ====================

export interface TopicPracticeAction {
  type: 'answer' | 'request_hint' | 'switch_topic' | 'end_interview' | 'view_feedback' | 'wait' | 'think';
  content?: string;
  duration: number; // milliseconds
  timestamp: string;
  thought?: string; // 用户内心想法
}

export interface TopicPracticeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: TopicPracticeAction[];
  metadata?: {
    topicName?: string;
    roundNumber?: number;
    hintRequested?: boolean;
    feedbackReceived?: boolean;
    trustLevel?: number;
  };
}

export interface TopicPracticeFeedback {
  topicName: string;
  feedbackQuality: number; // 1-10
  recommendationQuality: number; // 1-10
  timingAppropriate: boolean; // 结束时机是否合适
  overallSatisfaction: number; // 1-10
  comments: string;
}

export interface TopicPracticeSimulationResult {
  persona: MockPersona;
  sessionId: string;
  topics: Array<{
    name: string;
    rounds: number;
    hintsUsed: number;
    feedback: TopicPracticeFeedback | null;
  }>;
  messages: TopicPracticeMessage[];
  overallFeedback: {
    satisfaction: number; // 1-10
    wouldRecommend: boolean;
    comments: string;
    improvementSuggestions: string[];
  };
  metrics: {
    totalDuration: number;
    topicsCompleted: number;
    hintsRequested: number;
    abandonedTopics: number;
    averageFeedbackQuality: number;
    averageRecommendationQuality: number;
  };
  timestamp: string;
}

// ==================== 信任度行为配置 ====================

function getTrustLevelBehavior(trustLevel: number) {
  if (trustLevel <= 3) {
    return TARGET_USER_CONSTRAINTS.trustLevelBehaviors.low;
  } else if (trustLevel <= 6) {
    return TARGET_USER_CONSTRAINTS.trustLevelBehaviors.medium;
  } else {
    return TARGET_USER_CONSTRAINTS.trustLevelBehaviors.high;
  }
}

// ==================== 模拟器实现 ====================

/**
 * 模拟用户在话题练习中的回答
 */
async function simulateTopicAnswer(
  persona: MockPersona,
  topic: string,
  question: string,
  roundNumber: number,
  previousMessages: TopicPracticeMessage[]
): Promise<{ answer: string; thought: string; wantsHint: boolean; wantsToEnd: boolean }> {
  const trustBehavior = getTrustLevelBehavior(persona.personality.trustLevel);
  
  // 低信任度用户更容易想结束
  const shouldEndEarly = trustBehavior.likelyToAbandon && 
                         roundNumber >= trustBehavior.maxRoundsBeforeFeedback;
  
  // 根据信任度调整回答长度
  const responseGuidance = trustBehavior.responseLength === 'brief' 
    ? '回答简短，只说关键点，不展开细节'
    : trustBehavior.responseLength === 'medium'
    ? '回答中等长度，有一些细节但不过于详细'
    : '回答详细，包含具体例子和数据';

  const prompt = `你正在扮演一个求职者，在 UHired 平台进行话题练习。

## 你的角色
${JSON.stringify(persona, null, 2)}

## 当前情况
- 话题：${topic}
- 当前问题：${question}
- 已进行轮次：${roundNumber}
- 你的信任度：${persona.personality.trustLevel}/10 (${persona.personality.trustLevel <= 3 ? '低' : persona.personality.trustLevel <= 6 ? '中' : '高'})

## 你的回答风格
${responseGuidance}

## 之前的对话
${previousMessages.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 200)}...`).join('\n')}

## 任务
1. 生成一个符合你角色的回答
2. 说出你的内心想法（对系统的评价、是否觉得有用等）
3. 决定是否需要提示
4. 决定是否想结束这个话题

${shouldEndEarly ? '注意：你已经回答了 ' + roundNumber + ' 轮，作为低信任度用户，你可能想看看反馈了。' : ''}

返回 JSON：
{
  "answer": "你的回答内容",
  "thought": "你的内心想法（对系统的评价）",
  "wantsHint": true/false,
  "wantsToEnd": true/false
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'topic_answer',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              answer: { type: 'string' },
              thought: { type: 'string' },
              wantsHint: { type: 'boolean' },
              wantsToEnd: { type: 'boolean' },
            },
            required: ['answer', 'thought', 'wantsHint', 'wantsToEnd'],
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
    console.error('[TopicPracticeSimulator] Error generating answer:', error);
  }

  // 默认回答
  return {
    answer: '我在之前的项目中有一些相关经验...',
    thought: '这个问题有点难回答',
    wantsHint: roundNumber > 1,
    wantsToEnd: shouldEndEarly,
  };
}

/**
 * 评估反馈和推荐质量
 */
async function evaluateFeedbackQuality(
  persona: MockPersona,
  topicName: string,
  feedback: string,
  recommendations: string
): Promise<TopicPracticeFeedback> {
  const prompt = `你正在扮演一个求职者，评估 UHired 给你的面试反馈和职位推荐。

## 你的角色
${JSON.stringify(persona, null, 2)}

## 话题
${topicName}

## 收到的反馈
${feedback}

## 收到的职位推荐
${recommendations}

## 评估标准
1. 反馈质量 (1-10)：是否专业、具体、有建设性？
2. 推荐质量 (1-10)：职位推荐是否合适、理由是否有说服力？
3. 时机是否合适：反馈是在合适的时候给出的吗？
4. 整体满意度 (1-10)
5. 具体评价

返回 JSON：
{
  "feedbackQuality": number,
  "recommendationQuality": number,
  "timingAppropriate": boolean,
  "overallSatisfaction": number,
  "comments": "具体评价..."
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'feedback_evaluation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              feedbackQuality: { type: 'number' },
              recommendationQuality: { type: 'number' },
              timingAppropriate: { type: 'boolean' },
              overallSatisfaction: { type: 'number' },
              comments: { type: 'string' },
            },
            required: ['feedbackQuality', 'recommendationQuality', 'timingAppropriate', 'overallSatisfaction', 'comments'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const parsed = JSON.parse(content);
      return {
        topicName,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('[TopicPracticeSimulator] Error evaluating feedback:', error);
  }

  return {
    topicName,
    feedbackQuality: 5,
    recommendationQuality: 5,
    timingAppropriate: true,
    overallSatisfaction: 5,
    comments: '一般',
  };
}

/**
 * 生成整体反馈
 */
async function generateOverallFeedback(
  persona: MockPersona,
  topicFeedbacks: TopicPracticeFeedback[],
  totalDuration: number
): Promise<{
  satisfaction: number;
  wouldRecommend: boolean;
  comments: string;
  improvementSuggestions: string[];
}> {
  const avgFeedbackQuality = topicFeedbacks.reduce((sum, f) => sum + f.feedbackQuality, 0) / topicFeedbacks.length || 0;
  const avgRecommendationQuality = topicFeedbacks.reduce((sum, f) => sum + f.recommendationQuality, 0) / topicFeedbacks.length || 0;

  const prompt = `你正在扮演一个求职者，对 UHired 的话题练习功能进行整体评价。

## 你的角色
${JSON.stringify(persona, null, 2)}

## 使用情况
- 完成话题数：${topicFeedbacks.length}
- 总时长：${Math.round(totalDuration / 60000)} 分钟
- 平均反馈质量：${avgFeedbackQuality.toFixed(1)}/10
- 平均推荐质量：${avgRecommendationQuality.toFixed(1)}/10

## 各话题评价
${topicFeedbacks.map(f => `- ${f.topicName}: 满意度 ${f.overallSatisfaction}/10, "${f.comments}"`).join('\n')}

## 任务
给出整体评价，包括：
1. 整体满意度 (1-10)
2. 是否会推荐给朋友
3. 具体评价
4. 改进建议（至少 2 条）

返回 JSON：
{
  "satisfaction": number,
  "wouldRecommend": boolean,
  "comments": "整体评价...",
  "improvementSuggestions": ["建议1", "建议2"]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'overall_feedback',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              satisfaction: { type: 'number' },
              wouldRecommend: { type: 'boolean' },
              comments: { type: 'string' },
              improvementSuggestions: { type: 'array', items: { type: 'string' } },
            },
            required: ['satisfaction', 'wouldRecommend', 'comments', 'improvementSuggestions'],
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
    console.error('[TopicPracticeSimulator] Error generating overall feedback:', error);
  }

  return {
    satisfaction: 5,
    wouldRecommend: false,
    comments: '一般',
    improvementSuggestions: ['需要更好的反馈', '需要更准确的职位推荐'],
  };
}

// ==================== 主模拟函数 ====================

/**
 * 运行话题练习模拟
 */
export async function runTopicPracticeSimulation(
  persona: MockPersona,
  maxTopics: number = 2
): Promise<TopicPracticeSimulationResult> {
  const startTime = Date.now();
  const sessionId = `tps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const messages: TopicPracticeMessage[] = [];
  const topics: TopicPracticeSimulationResult['topics'] = [];
  const topicFeedbacks: TopicPracticeFeedback[] = [];
  
  let hintsRequested = 0;
  let abandonedTopics = 0;

  console.log(`[TopicPracticeSimulator] Starting simulation for ${persona.name}`);
  console.log(`[TopicPracticeSimulator] Trust level: ${persona.personality.trustLevel}/10`);

  // 模拟开始话题练习
  // 这里应该调用实际的 topicPracticeRouter，但为了独立测试，我们模拟 AI 响应
  
  for (let topicIndex = 0; topicIndex < maxTopics; topicIndex++) {
    const topicName = topicIndex === 0 ? '项目经验' : '技术能力';
    let roundNumber = 0;
    let topicHints = 0;
    let topicAbandoned = false;
    
    console.log(`[TopicPracticeSimulator] Starting topic: ${topicName}`);
    
    // 模拟 AI 开场问题
    const openingQuestion = `请描述一个你最近参与的、最具挑战性的${topicName === '项目经验' ? '技术项目' : '技术问题'}。`;
    messages.push({
      role: 'assistant',
      content: openingQuestion,
      timestamp: new Date().toISOString(),
      metadata: { topicName, roundNumber: 0 },
    });
    
    // 模拟对话轮次
    const trustBehavior = getTrustLevelBehavior(persona.personality.trustLevel);
    const maxRounds = trustBehavior.maxRoundsBeforeFeedback + 2; // 允许一些弹性
    
    while (roundNumber < maxRounds) {
      roundNumber++;
      
      // 模拟用户回答
      const { answer, thought, wantsHint, wantsToEnd } = await simulateTopicAnswer(
        persona,
        topicName,
        messages[messages.length - 1].content,
        roundNumber,
        messages
      );
      
      // 记录用户消息
      messages.push({
        role: 'user',
        content: wantsHint ? '给我提示' : wantsToEnd ? '我想看看反馈' : answer,
        timestamp: new Date().toISOString(),
        actions: [{
          type: wantsHint ? 'request_hint' : wantsToEnd ? 'view_feedback' : 'answer',
          content: answer,
          duration: 5000 + Math.random() * 10000,
          timestamp: new Date().toISOString(),
          thought,
        }],
        metadata: { topicName, roundNumber, hintRequested: wantsHint, trustLevel: persona.personality.trustLevel },
      });
      
      if (wantsHint) {
        hintsRequested++;
        topicHints++;
        // 模拟提示响应
        messages.push({
          role: 'assistant',
          content: '好的，让我给你一些提示。你可以从以下几个角度来回答...',
          timestamp: new Date().toISOString(),
          metadata: { topicName, roundNumber },
        });
        continue;
      }
      
      if (wantsToEnd) {
        // 用户想结束，生成反馈
        break;
      }
      
      // 模拟 AI 追问
      const followUp = `很好，能详细说说你在这个过程中具体做了什么吗？`;
      messages.push({
        role: 'assistant',
        content: followUp,
        timestamp: new Date().toISOString(),
        metadata: { topicName, roundNumber },
      });
    }
    
    // 调用真实的反馈和推荐 Agent
    const topicContext = buildTopicContextFromSimulation(topicName, messages, persona);
    const targetPosition = `${persona.targetJob.position} at ${persona.targetJob.company}`;
    
    let realFeedback = '';
    let realRecommendations = '';
    
    try {
      // 调用真实的反馈生成器
      const feedbackResult = await generateTopicFeedback(topicContext, targetPosition, persona.resumeText);
      realFeedback = formatFeedbackForDisplay(feedbackResult);
      
      // 调用真实的职位推荐
      const companyMatches = await generateCompanyMatches([topicContext], targetPosition);
      realRecommendations = formatRecommendationsForDisplay(companyMatches);
      
      console.log('[TopicPracticeSimulator] Real feedback generated for', persona.name);
      console.log('[TopicPracticeSimulator] Recommendations:', companyMatches.map(c => c.company).join(', '));
    } catch (error) {
      console.error('[TopicPracticeSimulator] Error generating real feedback:', error);
      // 回退到模拟数据
      realFeedback = `## ${topicName}反馈\n\n你展示了不错的${topicName}能力...`;
      realRecommendations = `## 职位推荐\n\n基于你的表现，推荐以下职位：\n1. ${persona.targetJob.company} - ${persona.targetJob.position}`;
    }
    
    const mockFeedback = realFeedback;
    const mockRecommendations = realRecommendations;
    
    // 评估反馈质量
    const feedback = await evaluateFeedbackQuality(
      persona,
      topicName,
      mockFeedback,
      mockRecommendations
    );
    
    topicFeedbacks.push(feedback);
    
    topics.push({
      name: topicName,
      rounds: roundNumber,
      hintsUsed: topicHints,
      feedback,
    });
    
    if (topicAbandoned) {
      abandonedTopics++;
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // 生成整体反馈
  const overallFeedback = await generateOverallFeedback(persona, topicFeedbacks, totalDuration);
  
  // 计算指标
  const avgFeedbackQuality = topicFeedbacks.reduce((sum, f) => sum + f.feedbackQuality, 0) / topicFeedbacks.length || 0;
  const avgRecommendationQuality = topicFeedbacks.reduce((sum, f) => sum + f.recommendationQuality, 0) / topicFeedbacks.length || 0;
  
  const result: TopicPracticeSimulationResult = {
    persona,
    sessionId,
    topics,
    messages,
    overallFeedback,
    metrics: {
      totalDuration,
      topicsCompleted: topics.length,
      hintsRequested,
      abandonedTopics,
      averageFeedbackQuality: avgFeedbackQuality,
      averageRecommendationQuality: avgRecommendationQuality,
    },
    timestamp: new Date().toISOString(),
  };
  
  console.log(`[TopicPracticeSimulator] Simulation complete for ${persona.name}`);
  console.log(`[TopicPracticeSimulator] Satisfaction: ${overallFeedback.satisfaction}/10`);
  console.log(`[TopicPracticeSimulator] Would recommend: ${overallFeedback.wouldRecommend}`);
  
  return result;
}

// ==================== 批量模拟 ====================

/**
 * 批量运行话题练习模拟
 */
export async function runBatchTopicPracticeSimulation(
  personas: MockPersona[],
  maxTopicsPerPersona: number = 2
): Promise<TopicPracticeSimulationResult[]> {
  const results: TopicPracticeSimulationResult[] = [];
  
  for (const persona of personas) {
    try {
      const result = await runTopicPracticeSimulation(persona, maxTopicsPerPersona);
      results.push(result);
      
      // 保存结果
      const resultsDir = '/home/ubuntu/UHWeb/data/topic-practice-simulations';
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(resultsDir, `${result.sessionId}.json`),
        JSON.stringify(result, null, 2)
      );
    } catch (error) {
      console.error(`[TopicPracticeSimulator] Error simulating ${persona.name}:`, error);
    }
  }
  
  return results;
}

// ==================== 分析函数 ====================

/**
 * 分析模拟结果，生成改进建议
 */
export function analyzeSimulationResults(results: TopicPracticeSimulationResult[]): {
  summary: {
    totalSimulations: number;
    averageSatisfaction: number;
    recommendationRate: number;
    averageFeedbackQuality: number;
    averageRecommendationQuality: number;
  };
  byTrustLevel: {
    low: { count: number; avgSatisfaction: number };
    medium: { count: number; avgSatisfaction: number };
    high: { count: number; avgSatisfaction: number };
  };
  commonIssues: string[];
  improvementPriorities: string[];
} {
  const totalSimulations = results.length;
  const avgSatisfaction = results.reduce((sum, r) => sum + r.overallFeedback.satisfaction, 0) / totalSimulations || 0;
  const recommendationRate = results.filter(r => r.overallFeedback.wouldRecommend).length / totalSimulations || 0;
  const avgFeedbackQuality = results.reduce((sum, r) => sum + r.metrics.averageFeedbackQuality, 0) / totalSimulations || 0;
  const avgRecommendationQuality = results.reduce((sum, r) => sum + r.metrics.averageRecommendationQuality, 0) / totalSimulations || 0;
  
  // 按信任度分组
  const lowTrust = results.filter(r => r.persona.personality.trustLevel <= 3);
  const mediumTrust = results.filter(r => r.persona.personality.trustLevel > 3 && r.persona.personality.trustLevel <= 6);
  const highTrust = results.filter(r => r.persona.personality.trustLevel > 6);
  
  // 收集所有改进建议
  const allSuggestions = results.flatMap(r => r.overallFeedback.improvementSuggestions);
  const suggestionCounts = new Map<string, number>();
  for (const suggestion of allSuggestions) {
    suggestionCounts.set(suggestion, (suggestionCounts.get(suggestion) || 0) + 1);
  }
  
  // 排序获取最常见的问题
  const sortedSuggestions = Array.from(suggestionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([suggestion]) => suggestion);
  
  return {
    summary: {
      totalSimulations,
      averageSatisfaction: avgSatisfaction,
      recommendationRate,
      averageFeedbackQuality: avgFeedbackQuality,
      averageRecommendationQuality: avgRecommendationQuality,
    },
    byTrustLevel: {
      low: {
        count: lowTrust.length,
        avgSatisfaction: lowTrust.reduce((sum, r) => sum + r.overallFeedback.satisfaction, 0) / lowTrust.length || 0,
      },
      medium: {
        count: mediumTrust.length,
        avgSatisfaction: mediumTrust.reduce((sum, r) => sum + r.overallFeedback.satisfaction, 0) / mediumTrust.length || 0,
      },
      high: {
        count: highTrust.length,
        avgSatisfaction: highTrust.reduce((sum, r) => sum + r.overallFeedback.satisfaction, 0) / highTrust.length || 0,
      },
    },
    commonIssues: sortedSuggestions,
    improvementPriorities: sortedSuggestions.slice(0, 3),
  };
}
