/**
 * Enhanced Closing Feedback System
 * 
 * 解决高挑剔度用户反馈的结束反馈太泛泛的问题：
 * 1. 提供具体可操作的改进建议
 * 2. 引用面试中的具体例子
 * 3. 给出明确的下一步行动
 * 4. 针对不同资历级别定制反馈
 */

import { invokeLLM } from '../_core/llm';

export interface SpecificFeedbackItem {
  category: 'strength' | 'improvement' | 'suggestion';
  title: string;
  description: string;
  specificExample?: string;  // 面试中的具体例子
  actionableAdvice: string;  // 具体可操作的建议
  priority: 'high' | 'medium' | 'low';
}

export interface EnhancedClosingFeedback {
  // 具体优势（带例子）
  strengths: SpecificFeedbackItem[];
  
  // 具体改进建议（带例子）
  improvements: SpecificFeedbackItem[];
  
  // 下一步行动计划
  nextSteps: {
    immediate: string[];  // 立即可做的
    shortTerm: string[];  // 1-2 周内
    longTerm: string[];   // 1-3 个月
  };
  
  // 针对该职位的具体建议
  positionSpecificAdvice: string;
  
  // 整体评分和解释
  overallAssessment: {
    score: number;  // 1-10
    scoreExplanation: string;
    comparedToIdeal: string;  // 与理想候选人的差距
  };
  
  // 面试技巧反馈
  interviewTechniqueFeedback: {
    starUsage: string;
    communicationClarity: string;
    technicalDepth: string;
    questionHandling: string;
  };
}

/**
 * 生成增强的结束反馈
 */
export async function generateEnhancedClosingFeedback(
  conversationHistory: Array<{ role: string; content: string }>,
  position: string,
  company: string,
  seniorityLevel: 'junior' | 'mid' | 'senior',
  language: 'en' | 'zh'
): Promise<EnhancedClosingFeedback> {
  const isZh = language === 'zh';
  
  const conversation = conversationHistory
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const prompt = isZh
    ? `分析这次面试对话，生成详细、具体、可操作的反馈。

职位：${position}
公司：${company}
候选人资历：${seniorityLevel}

对话记录：
${conversation}

要求：
1. 每个反馈点必须引用面试中的具体例子
2. 每个建议必须是可操作的，不能是泛泛的鼓励
3. 根据资历级别调整期望标准
4. 给出明确的下一步行动计划

返回 JSON：
{
  "strengths": [
    {
      "category": "strength",
      "title": "优势标题",
      "description": "详细描述",
      "specificExample": "面试中的具体例子（引用候选人的话）",
      "actionableAdvice": "如何继续发挥这个优势",
      "priority": "high|medium|low"
    }
  ],
  "improvements": [
    {
      "category": "improvement",
      "title": "改进点标题",
      "description": "详细描述问题",
      "specificExample": "面试中的具体例子（引用候选人的话）",
      "actionableAdvice": "具体如何改进（步骤、资源、练习方法）",
      "priority": "high|medium|low"
    }
  ],
  "nextSteps": {
    "immediate": ["立即可做的事情1", "立即可做的事情2"],
    "shortTerm": ["1-2周内要做的事情"],
    "longTerm": ["1-3个月的目标"]
  },
  "positionSpecificAdvice": "针对这个职位的具体建议",
  "overallAssessment": {
    "score": 7.5,
    "scoreExplanation": "评分的具体原因",
    "comparedToIdeal": "与理想候选人的差距"
  },
  "interviewTechniqueFeedback": {
    "starUsage": "STAR方法使用情况",
    "communicationClarity": "表达清晰度",
    "technicalDepth": "技术深度",
    "questionHandling": "问题处理能力"
  }
}`
    : `Analyze this interview conversation and generate detailed, specific, actionable feedback.

POSITION: ${position}
COMPANY: ${company}
CANDIDATE SENIORITY: ${seniorityLevel}

CONVERSATION:
${conversation}

Requirements:
1. Each feedback point MUST reference specific examples from the interview
2. Each suggestion MUST be actionable, not generic encouragement
3. Adjust expectations based on seniority level
4. Provide clear next steps action plan

Return JSON:
{
  "strengths": [
    {
      "category": "strength",
      "title": "Strength title",
      "description": "Detailed description",
      "specificExample": "Specific example from interview (quote candidate)",
      "actionableAdvice": "How to continue leveraging this strength",
      "priority": "high|medium|low"
    }
  ],
  "improvements": [
    {
      "category": "improvement",
      "title": "Improvement area title",
      "description": "Detailed description of the issue",
      "specificExample": "Specific example from interview (quote candidate)",
      "actionableAdvice": "Specific how to improve (steps, resources, practice methods)",
      "priority": "high|medium|low"
    }
  ],
  "nextSteps": {
    "immediate": ["Thing to do immediately 1", "Thing to do immediately 2"],
    "shortTerm": ["Things to do in 1-2 weeks"],
    "longTerm": ["Goals for 1-3 months"]
  },
  "positionSpecificAdvice": "Specific advice for this position",
  "overallAssessment": {
    "score": 7.5,
    "scoreExplanation": "Specific reasons for the score",
    "comparedToIdeal": "Gap compared to ideal candidate"
  },
  "interviewTechniqueFeedback": {
    "starUsage": "STAR method usage",
    "communicationClarity": "Communication clarity",
    "technicalDepth": "Technical depth",
    "questionHandling": "Question handling ability"
  }
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'enhanced_closing_feedback',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              strengths: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', enum: ['strength'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    specificExample: { type: 'string' },
                    actionableAdvice: { type: 'string' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  },
                  required: ['category', 'title', 'description', 'specificExample', 'actionableAdvice', 'priority'],
                  additionalProperties: false,
                },
              },
              improvements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', enum: ['improvement'] },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    specificExample: { type: 'string' },
                    actionableAdvice: { type: 'string' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  },
                  required: ['category', 'title', 'description', 'specificExample', 'actionableAdvice', 'priority'],
                  additionalProperties: false,
                },
              },
              nextSteps: {
                type: 'object',
                properties: {
                  immediate: { type: 'array', items: { type: 'string' } },
                  shortTerm: { type: 'array', items: { type: 'string' } },
                  longTerm: { type: 'array', items: { type: 'string' } },
                },
                required: ['immediate', 'shortTerm', 'longTerm'],
                additionalProperties: false,
              },
              positionSpecificAdvice: { type: 'string' },
              overallAssessment: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  scoreExplanation: { type: 'string' },
                  comparedToIdeal: { type: 'string' },
                },
                required: ['score', 'scoreExplanation', 'comparedToIdeal'],
                additionalProperties: false,
              },
              interviewTechniqueFeedback: {
                type: 'object',
                properties: {
                  starUsage: { type: 'string' },
                  communicationClarity: { type: 'string' },
                  technicalDepth: { type: 'string' },
                  questionHandling: { type: 'string' },
                },
                required: ['starUsage', 'communicationClarity', 'technicalDepth', 'questionHandling'],
                additionalProperties: false,
              },
            },
            required: ['strengths', 'improvements', 'nextSteps', 'positionSpecificAdvice', 'overallAssessment', 'interviewTechniqueFeedback'],
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
    console.error('[EnhancedClosingFeedback] Error generating feedback:', error);
  }

  // Fallback
  return {
    strengths: [{
      category: 'strength',
      title: isZh ? '结构化表达' : 'Structured Communication',
      description: isZh ? '回答有条理' : 'Answers were organized',
      specificExample: isZh ? '在回答问题时使用了清晰的结构' : 'Used clear structure when answering questions',
      actionableAdvice: isZh ? '继续使用 STAR 方法' : 'Continue using STAR method',
      priority: 'medium',
    }],
    improvements: [{
      category: 'improvement',
      title: isZh ? '技术深度' : 'Technical Depth',
      description: isZh ? '可以更深入地讨论技术细节' : 'Could discuss technical details more deeply',
      specificExample: isZh ? '在技术问题上的回答可以更详细' : 'Technical answers could be more detailed',
      actionableAdvice: isZh ? '准备更多技术案例' : 'Prepare more technical case studies',
      priority: 'high',
    }],
    nextSteps: {
      immediate: [isZh ? '回顾今天的面试问题' : 'Review today\'s interview questions'],
      shortTerm: [isZh ? '准备更多技术案例' : 'Prepare more technical cases'],
      longTerm: [isZh ? '提升技术深度' : 'Improve technical depth'],
    },
    positionSpecificAdvice: isZh ? '针对该职位，建议加强相关技术栈的学习' : 'For this position, strengthen relevant tech stack knowledge',
    overallAssessment: {
      score: 7,
      scoreExplanation: isZh ? '整体表现良好，有提升空间' : 'Good overall performance with room for improvement',
      comparedToIdeal: isZh ? '与理想候选人相比，技术深度可以加强' : 'Compared to ideal candidate, technical depth can be improved',
    },
    interviewTechniqueFeedback: {
      starUsage: isZh ? '基本使用了 STAR 方法' : 'Basic STAR method usage',
      communicationClarity: isZh ? '表达清晰' : 'Clear communication',
      technicalDepth: isZh ? '中等深度' : 'Medium depth',
      questionHandling: isZh ? '问题处理得当' : 'Good question handling',
    },
  };
}

/**
 * 格式化增强反馈用于显示
 */
export function formatEnhancedFeedback(feedback: EnhancedClosingFeedback, language: 'en' | 'zh'): string {
  const isZh = language === 'zh';
  const parts: string[] = [];
  
  // 整体评分
  parts.push(isZh ? `## 📊 整体评估` : `## 📊 Overall Assessment`);
  parts.push(`**${isZh ? '评分' : 'Score'}**: ${feedback.overallAssessment.score}/10`);
  parts.push(feedback.overallAssessment.scoreExplanation);
  parts.push('');
  
  // 优势
  parts.push(isZh ? `## ✅ 优势` : `## ✅ Strengths`);
  for (const s of feedback.strengths) {
    parts.push(`### ${s.title}`);
    parts.push(s.description);
    if (s.specificExample) {
      parts.push(`> ${isZh ? '具体例子' : 'Example'}: "${s.specificExample}"`);
    }
    parts.push(`💡 ${s.actionableAdvice}`);
    parts.push('');
  }
  
  // 改进建议
  parts.push(isZh ? `## 🔧 改进建议` : `## 🔧 Areas for Improvement`);
  for (const i of feedback.improvements) {
    parts.push(`### ${i.title} ${i.priority === 'high' ? '⚠️' : ''}`);
    parts.push(i.description);
    if (i.specificExample) {
      parts.push(`> ${isZh ? '具体例子' : 'Example'}: "${i.specificExample}"`);
    }
    parts.push(`💡 ${i.actionableAdvice}`);
    parts.push('');
  }
  
  // 下一步行动
  parts.push(isZh ? `## 📋 下一步行动` : `## 📋 Next Steps`);
  parts.push(isZh ? `### 立即可做` : `### Immediate`);
  feedback.nextSteps.immediate.forEach(s => parts.push(`- ${s}`));
  parts.push(isZh ? `### 1-2 周内` : `### Short Term (1-2 weeks)`);
  feedback.nextSteps.shortTerm.forEach(s => parts.push(`- ${s}`));
  parts.push(isZh ? `### 1-3 个月` : `### Long Term (1-3 months)`);
  feedback.nextSteps.longTerm.forEach(s => parts.push(`- ${s}`));
  parts.push('');
  
  // 面试技巧
  parts.push(isZh ? `## 🎯 面试技巧反馈` : `## 🎯 Interview Technique Feedback`);
  parts.push(`- **STAR ${isZh ? '方法' : 'Method'}**: ${feedback.interviewTechniqueFeedback.starUsage}`);
  parts.push(`- **${isZh ? '表达清晰度' : 'Communication'}**: ${feedback.interviewTechniqueFeedback.communicationClarity}`);
  parts.push(`- **${isZh ? '技术深度' : 'Technical Depth'}**: ${feedback.interviewTechniqueFeedback.technicalDepth}`);
  parts.push(`- **${isZh ? '问题处理' : 'Question Handling'}**: ${feedback.interviewTechniqueFeedback.questionHandling}`);
  
  return parts.join('\n');
}
