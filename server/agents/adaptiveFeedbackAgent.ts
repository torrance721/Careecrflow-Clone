/**
 * AdaptiveFeedbackAgent - 自适应反馈 Agent
 * 
 * 根据职位级别和用户背景动态调整反馈维度，
 * 提供个性化、有针对性的面试反馈。
 * 
 * 替代原有的固定维度反馈生成。
 */

import { StreamingBaseReActAgent } from './react/streamingBaseAgent';
import { ReActConfig, Tool, ReActTrace } from './react/types';
import { invokeLLM } from '../_core/llm';

// ==================== 输入输出类型 ====================

export interface AdaptiveFeedbackInput {
  userBackground: {
    currentRole?: string;
    yearsOfExperience?: number;
    skills: string[];
    education?: string;
    targetRole?: string;
    targetLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  };
  interviewData: {
    topic: string;
    questions: Array<{
      question: string;
      answer: string;
      followUps?: string[];
    }>;
    duration: number;  // 分钟
    language: 'en' | 'zh';
  };
  targetPosition?: {
    title: string;
    company?: string;
    level?: string;
    requirements?: string[];
  };
}

export interface FeedbackDimension {
  name: string;
  nameZh: string;
  score: number;  // 0-100
  evidence: string[];  // 用户回答中的具体证据
  strengths: string[];
  improvements: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface AdaptiveFeedbackOutput {
  positionAnalysis: {
    level: string;
    levelDescription: string;
    keyCompetencies: string[];
  };
  dimensions: FeedbackDimension[];
  overallScore: number;
  summary: string;
  actionItems: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    timeframe: string;
  }>;
  encouragement: string;
}

// ==================== 工具定义 ====================

const analyzePositionLevelTool: Tool = {
  name: 'analyze_position_level',
  description: 'Analyze the target position level and determine appropriate evaluation criteria',
  parameters: {
    type: 'object',
    properties: {
      targetRole: {
        type: 'string',
        description: 'Target job role',
      },
      targetLevel: {
        type: 'string',
        description: 'Target level (entry/mid/senior/lead/executive)',
      },
      yearsOfExperience: {
        type: 'number',
        description: 'User\'s years of experience',
      },
    },
    required: ['targetRole'],
  },
  estimatedTimeMs: 500,
  execute: async (params) => {
    const { targetRole, targetLevel, yearsOfExperience } = params as {
      targetRole: string;
      targetLevel?: string;
      yearsOfExperience?: number;
    };
    
    // 推断级别
    let inferredLevel = targetLevel || 'mid';
    if (!targetLevel && yearsOfExperience !== undefined) {
      if (yearsOfExperience < 2) inferredLevel = 'entry';
      else if (yearsOfExperience < 5) inferredLevel = 'mid';
      else if (yearsOfExperience < 10) inferredLevel = 'senior';
      else inferredLevel = 'lead';
    }
    
    // 基于角色名称推断
    const roleLower = targetRole.toLowerCase();
    if (roleLower.includes('junior') || roleLower.includes('intern') || roleLower.includes('entry')) {
      inferredLevel = 'entry';
    } else if (roleLower.includes('senior') || roleLower.includes('sr.')) {
      inferredLevel = 'senior';
    } else if (roleLower.includes('lead') || roleLower.includes('principal')) {
      inferredLevel = 'lead';
    } else if (roleLower.includes('director') || roleLower.includes('vp') || roleLower.includes('head')) {
      inferredLevel = 'executive';
    }
    
    // 级别描述和关键能力
    const levelConfig: Record<string, { description: string; competencies: string[] }> = {
      entry: {
        description: 'Entry-level position focusing on learning and growth',
        competencies: ['Learning ability', 'Basic technical skills', 'Communication', 'Teamwork', 'Problem-solving basics'],
      },
      mid: {
        description: 'Mid-level position requiring independent work and collaboration',
        competencies: ['Technical proficiency', 'Project ownership', 'Cross-team collaboration', 'Mentoring juniors', 'Process improvement'],
      },
      senior: {
        description: 'Senior position requiring technical leadership and strategic thinking',
        competencies: ['Technical leadership', 'System design', 'Stakeholder management', 'Strategic planning', 'Mentorship'],
      },
      lead: {
        description: 'Lead position requiring team leadership and organizational impact',
        competencies: ['Team leadership', 'Technical vision', 'Cross-functional influence', 'Talent development', 'Business alignment'],
      },
      executive: {
        description: 'Executive position requiring organizational leadership and business strategy',
        competencies: ['Organizational leadership', 'Business strategy', 'Executive communication', 'Change management', 'P&L responsibility'],
      },
    };
    
    const config = levelConfig[inferredLevel] || levelConfig.mid;
    
    return {
      success: true,
      data: {
        level: inferredLevel,
        description: config.description,
        keyCompetencies: config.competencies,
        targetRole,
      },
      executionTimeMs: 50,
    };
  },
};

const identifyEvaluationDimensionsTool: Tool = {
  name: 'identify_evaluation_dimensions',
  description: 'Dynamically identify evaluation dimensions based on position level and interview topic',
  parameters: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        description: 'Position level',
      },
      topic: {
        type: 'string',
        description: 'Interview topic',
      },
      keyCompetencies: {
        type: 'array',
        description: 'Key competencies for the level',
      },
    },
    required: ['level', 'topic'],
  },
  estimatedTimeMs: 300,
  execute: async (params) => {
    const { level, topic, keyCompetencies } = params as {
      level: string;
      topic: string;
      keyCompetencies?: string[];
    };
    
    // 基础维度（所有级别都有）
    const baseDimensions = [
      { name: 'Communication Clarity', nameZh: '表达清晰度', weight: 0.15 },
      { name: 'Problem Understanding', nameZh: '问题理解', weight: 0.15 },
    ];
    
    // 级别特定维度
    const levelDimensions: Record<string, Array<{ name: string; nameZh: string; weight: number }>> = {
      entry: [
        { name: 'Learning Potential', nameZh: '学习潜力', weight: 0.25 },
        { name: 'Basic Technical Knowledge', nameZh: '基础技术知识', weight: 0.25 },
        { name: 'Enthusiasm & Attitude', nameZh: '热情与态度', weight: 0.20 },
      ],
      mid: [
        { name: 'Technical Depth', nameZh: '技术深度', weight: 0.25 },
        { name: 'Project Experience', nameZh: '项目经验', weight: 0.20 },
        { name: 'Collaboration Skills', nameZh: '协作能力', weight: 0.15 },
        { name: 'Problem-Solving Approach', nameZh: '问题解决方法', weight: 0.10 },
      ],
      senior: [
        { name: 'System Design Thinking', nameZh: '系统设计思维', weight: 0.20 },
        { name: 'Technical Leadership', nameZh: '技术领导力', weight: 0.20 },
        { name: 'Trade-off Analysis', nameZh: '权衡分析', weight: 0.15 },
        { name: 'Mentorship Ability', nameZh: '指导能力', weight: 0.15 },
      ],
      lead: [
        { name: 'Strategic Vision', nameZh: '战略视野', weight: 0.20 },
        { name: 'Team Building', nameZh: '团队建设', weight: 0.20 },
        { name: 'Cross-functional Influence', nameZh: '跨职能影响力', weight: 0.15 },
        { name: 'Business Alignment', nameZh: '业务对齐', weight: 0.15 },
      ],
      executive: [
        { name: 'Business Strategy', nameZh: '商业战略', weight: 0.25 },
        { name: 'Organizational Leadership', nameZh: '组织领导力', weight: 0.20 },
        { name: 'Executive Presence', nameZh: '高管气质', weight: 0.15 },
        { name: 'Change Management', nameZh: '变革管理', weight: 0.10 },
      ],
    };
    
    // 话题特定维度
    const topicDimensions: Record<string, Array<{ name: string; nameZh: string; weight: number }>> = {
      'behavioral': [
        { name: 'STAR Method Usage', nameZh: 'STAR方法运用', weight: 0.15 },
        { name: 'Self-Awareness', nameZh: '自我认知', weight: 0.10 },
      ],
      'technical': [
        { name: 'Technical Accuracy', nameZh: '技术准确性', weight: 0.20 },
        { name: 'Code Quality Mindset', nameZh: '代码质量意识', weight: 0.10 },
      ],
      'system design': [
        { name: 'Scalability Thinking', nameZh: '可扩展性思维', weight: 0.15 },
        { name: 'Requirements Clarification', nameZh: '需求澄清', weight: 0.10 },
      ],
      'product': [
        { name: 'User Empathy', nameZh: '用户同理心', weight: 0.15 },
        { name: 'Data-Driven Thinking', nameZh: '数据驱动思维', weight: 0.10 },
      ],
    };
    
    // 组合维度
    const dimensions = [...baseDimensions];
    
    // 添加级别维度
    const levelDims = levelDimensions[level] || levelDimensions.mid;
    dimensions.push(...levelDims);
    
    // 添加话题维度
    const topicLower = topic.toLowerCase();
    for (const [key, dims] of Object.entries(topicDimensions)) {
      if (topicLower.includes(key)) {
        dimensions.push(...dims);
        break;
      }
    }
    
    // 归一化权重
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const normalizedDimensions = dimensions.map(d => ({
      ...d,
      weight: d.weight / totalWeight,
    }));
    
    return {
      success: true,
      data: {
        dimensions: normalizedDimensions,
        level,
        topic,
        totalDimensions: normalizedDimensions.length,
      },
      executionTimeMs: 30,
    };
  },
};

const extractUserEvidenceTool: Tool = {
  name: 'extract_user_evidence',
  description: 'Extract evidence from user answers for each evaluation dimension',
  parameters: {
    type: 'object',
    properties: {
      answers: {
        type: 'array',
        description: 'User\'s interview answers',
      },
      dimensions: {
        type: 'array',
        description: 'Evaluation dimensions to look for',
      },
    },
    required: ['answers', 'dimensions'],
  },
  estimatedTimeMs: 500,
  execute: async (params) => {
    const { answers, dimensions } = params as {
      answers: Array<{ question: string; answer: string }>;
      dimensions: Array<{ name: string }>;
    };
    
    // 简单的关键词匹配提取证据
    const evidenceMap: Record<string, string[]> = {};
    
    for (const dim of dimensions) {
      evidenceMap[dim.name] = [];
    }
    
    // 关键词映射
    const keywordMap: Record<string, string[]> = {
      'Communication Clarity': ['explained', 'clarified', 'described', 'outlined', 'summarized'],
      'Problem Understanding': ['understood', 'analyzed', 'identified', 'recognized', 'discovered'],
      'Technical Depth': ['implemented', 'designed', 'optimized', 'architected', 'built'],
      'Learning Potential': ['learned', 'studied', 'researched', 'explored', 'curious'],
      'System Design Thinking': ['scalable', 'distributed', 'architecture', 'trade-off', 'latency'],
      'Strategic Vision': ['strategy', 'vision', 'roadmap', 'long-term', 'growth'],
      'STAR Method Usage': ['situation', 'task', 'action', 'result', 'outcome'],
    };
    
    for (const { question, answer } of answers) {
      const answerLower = answer.toLowerCase();
      
      for (const dim of dimensions) {
        const keywords = keywordMap[dim.name] || [];
        for (const keyword of keywords) {
          if (answerLower.includes(keyword)) {
            // 提取包含关键词的句子作为证据
            const sentences = answer.split(/[.!?]+/);
            for (const sentence of sentences) {
              if (sentence.toLowerCase().includes(keyword) && sentence.trim().length > 20) {
                evidenceMap[dim.name].push(sentence.trim());
                break;
              }
            }
          }
        }
      }
    }
    
    return {
      success: true,
      data: {
        evidenceMap,
        totalEvidence: Object.values(evidenceMap).flat().length,
        answersAnalyzed: answers.length,
      },
      executionTimeMs: 50,
    };
  },
};

const searchBestPracticesTool: Tool = {
  name: 'search_best_practices',
  description: 'Search for best practices and improvement suggestions for each dimension',
  parameters: {
    type: 'object',
    properties: {
      dimension: {
        type: 'string',
        description: 'Dimension to search best practices for',
      },
      level: {
        type: 'string',
        description: 'Position level',
      },
      currentScore: {
        type: 'number',
        description: 'Current score for this dimension',
      },
    },
    required: ['dimension', 'level'],
  },
  estimatedTimeMs: 200,
  execute: async (params) => {
    const { dimension, level, currentScore } = params as {
      dimension: string;
      level: string;
      currentScore?: number;
    };
    
    // 最佳实践库
    const bestPractices: Record<string, Record<string, string[]>> = {
      'Communication Clarity': {
        entry: ['Practice explaining technical concepts to non-technical friends', 'Use the "ELI5" approach'],
        mid: ['Structure answers with clear beginning, middle, and end', 'Use concrete examples'],
        senior: ['Tailor communication to audience level', 'Lead with impact, then details'],
        lead: ['Master executive summaries', 'Develop storytelling skills'],
        executive: ['Perfect the "elevator pitch"', 'Practice board-level communication'],
      },
      'Technical Depth': {
        entry: ['Focus on fundamentals: data structures, algorithms', 'Build side projects'],
        mid: ['Deep dive into your tech stack', 'Contribute to open source'],
        senior: ['Study system design patterns', 'Learn from production incidents'],
        lead: ['Understand cross-cutting concerns', 'Stay current with industry trends'],
        executive: ['Focus on technology strategy', 'Understand ROI of technical decisions'],
      },
      'System Design Thinking': {
        entry: ['Study basic design patterns', 'Understand client-server architecture'],
        mid: ['Learn about databases, caching, queues', 'Practice designing small systems'],
        senior: ['Study large-scale systems', 'Practice trade-off analysis'],
        lead: ['Focus on organizational architecture', 'Consider multi-year evolution'],
        executive: ['Think about technology portfolio', 'Consider build vs buy decisions'],
      },
    };
    
    const practices = bestPractices[dimension]?.[level] || [
      'Practice regularly with mock interviews',
      'Seek feedback from peers and mentors',
      'Study successful examples in your field',
    ];
    
    // 根据分数调整建议优先级
    const priority = currentScore !== undefined 
      ? (currentScore < 60 ? 'high' : currentScore < 80 ? 'medium' : 'low')
      : 'medium';
    
    return {
      success: true,
      data: {
        dimension,
        level,
        bestPractices: practices,
        priority,
        improvementTimeframe: priority === 'high' ? '1-2 weeks' : priority === 'medium' ? '1-2 months' : '3+ months',
      },
      executionTimeMs: 20,
    };
  },
};

const generateAdaptiveFeedbackTool: Tool = {
  name: 'generate_adaptive_feedback',
  description: 'Generate the final adaptive feedback based on all analysis',
  parameters: {
    type: 'object',
    properties: {
      positionAnalysis: {
        type: 'object',
        description: 'Position level analysis',
      },
      dimensionScores: {
        type: 'array',
        description: 'Scores for each dimension',
      },
      evidence: {
        type: 'object',
        description: 'Evidence map',
      },
      bestPractices: {
        type: 'array',
        description: 'Best practices for improvement',
      },
      language: {
        type: 'string',
        description: 'Output language (en/zh)',
      },
    },
    required: ['positionAnalysis', 'dimensionScores', 'language'],
  },
  estimatedTimeMs: 100,
  execute: async (params) => {
    const { positionAnalysis, dimensionScores, evidence, bestPractices, language } = params as {
      positionAnalysis: { level: string; description: string; keyCompetencies: string[] };
      dimensionScores: Array<{ name: string; nameZh: string; score: number; weight: number }>;
      evidence?: Record<string, string[]>;
      bestPractices?: Array<{ dimension: string; practices: string[]; priority: string }>;
      language: string;
    };
    
    // 计算总分
    const overallScore = Math.round(
      dimensionScores.reduce((sum, d) => sum + d.score * d.weight, 0)
    );
    
    // 生成维度反馈
    const dimensions: FeedbackDimension[] = dimensionScores.map(d => {
      const dimEvidence = evidence?.[d.name] || [];
      const dimPractices = bestPractices?.find(bp => bp.dimension === d.name);
      
      return {
        name: d.name,
        nameZh: d.nameZh,
        score: d.score,
        evidence: dimEvidence,
        strengths: d.score >= 70 
          ? [language === 'zh' ? '表现良好' : 'Good performance']
          : [],
        improvements: dimPractices?.practices || [],
        priority: d.score < 60 ? 'high' : d.score < 80 ? 'medium' : 'low',
      };
    });
    
    // 生成行动项
    const actionItems = dimensions
      .filter(d => d.priority === 'high' || d.priority === 'medium')
      .slice(0, 3)
      .map(d => ({
        action: language === 'zh' 
          ? `提升${d.nameZh}` 
          : `Improve ${d.name}`,
        priority: d.priority,
        timeframe: d.priority === 'high' ? '1-2 weeks' : '1-2 months',
      }));
    
    // 生成总结
    const summary = language === 'zh'
      ? `整体表现${overallScore >= 80 ? '优秀' : overallScore >= 60 ? '良好' : '需要提升'}，总分 ${overallScore}/100。`
      : `Overall performance is ${overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'needs improvement'}, score ${overallScore}/100.`;
    
    // 生成鼓励语
    const encouragement = language === 'zh'
      ? '继续保持学习的热情，每一次面试都是成长的机会！'
      : 'Keep up your enthusiasm for learning. Every interview is an opportunity for growth!';
    
    return {
      success: true,
      data: {
        positionAnalysis,
        dimensions,
        overallScore,
        summary,
        actionItems,
        encouragement,
      },
      executionTimeMs: 50,
    };
  },
};

// ==================== Agent 实现 ====================

export class AdaptiveFeedbackAgent extends StreamingBaseReActAgent<AdaptiveFeedbackInput, AdaptiveFeedbackOutput> {
  constructor() {
    const config: ReActConfig = {
      moduleName: 'adaptive_feedback',
      thinking: {
        maxSteps: 6,
        adaptiveDepth: true,
      },
      timeBudget: {
        maxTimeMs: 20000,  // 20 秒总时间
        priority: 'quality',
        warningThresholdMs: 15000,
      },
      quality: {
        minScore: 0.7,
        earlyStopOnQuality: true,
      },
      tools: [
        analyzePositionLevelTool,
        identifyEvaluationDimensionsTool,
        extractUserEvidenceTool,
        searchBestPracticesTool,
        generateAdaptiveFeedbackTool,
      ],
    };
    super(config);
  }

  protected getAgentDescription(): string {
    return '正在分析您的面试表现，生成个性化反馈...';
  }

  protected async getInitialContext(input: AdaptiveFeedbackInput): Promise<Record<string, unknown>> {
    return {
      userBackground: input.userBackground,
      interviewData: input.interviewData,
      targetPosition: input.targetPosition,
    };
  }

  protected buildSystemPrompt(input: AdaptiveFeedbackInput, _context: Record<string, unknown>): string {
    const { userBackground, interviewData, targetPosition } = input;
    
    const languageInstruction = interviewData.language === 'zh' 
      ? '请用中文回复。'
      : 'Please respond in English.';
    
    // 格式化问答
    const qaFormatted = interviewData.questions.map((q, i) => 
      `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`
    ).join('\n\n');
    
    return `You are an Adaptive Feedback Agent. Your goal is to provide personalized interview feedback based on the user's background and target position level.

${languageInstruction}

## User Background
- Current Role: ${userBackground.currentRole || 'Not specified'}
- Years of Experience: ${userBackground.yearsOfExperience || 'Not specified'}
- Skills: ${userBackground.skills.join(', ')}
- Target Role: ${userBackground.targetRole || 'Not specified'}
- Target Level: ${userBackground.targetLevel || 'Not specified'}

## Target Position
- Title: ${targetPosition?.title || userBackground.targetRole || 'Not specified'}
- Company: ${targetPosition?.company || 'Not specified'}
- Level: ${targetPosition?.level || userBackground.targetLevel || 'Not specified'}

## Interview Data
- Topic: ${interviewData.topic}
- Duration: ${interviewData.duration} minutes
- Questions & Answers:
${qaFormatted}

## Your Task
1. First, analyze the position level using analyze_position_level
2. Identify appropriate evaluation dimensions using identify_evaluation_dimensions
3. Extract evidence from user answers using extract_user_evidence
4. Search for best practices using search_best_practices (for top 3 dimensions needing improvement)
5. Generate the final adaptive feedback using generate_adaptive_feedback

## Important Guidelines
- DO NOT use hardcoded evaluation dimensions
- Adapt dimensions based on position level (entry vs senior have different criteria)
- Provide specific evidence from user's answers
- Give actionable improvement suggestions
- Be encouraging but honest

## Output Format
Your Final Answer must be a valid JSON object with this structure:
{
  "positionAnalysis": {
    "level": "senior",
    "levelDescription": "...",
    "keyCompetencies": ["..."]
  },
  "dimensions": [
    {
      "name": "...",
      "nameZh": "...",
      "score": 75,
      "evidence": ["..."],
      "strengths": ["..."],
      "improvements": ["..."],
      "priority": "medium"
    }
  ],
  "overallScore": 78,
  "summary": "...",
  "actionItems": [
    {
      "action": "...",
      "priority": "high",
      "timeframe": "1-2 weeks"
    }
  ],
  "encouragement": "..."
}`;
  }

  protected parseOutput(thought: string, _trace: ReActTrace): AdaptiveFeedbackOutput | null {
    try {
      // 尝试从思考中提取 JSON
      const jsonMatch = thought.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // 验证必要字段
        if (parsed.positionAnalysis && parsed.dimensions && Array.isArray(parsed.dimensions)) {
          return parsed as AdaptiveFeedbackOutput;
        }
      }
      
      console.warn('[AdaptiveFeedbackAgent] Could not parse output, returning default');
      return null;
    } catch (error) {
      console.error('[AdaptiveFeedbackAgent] Parse error:', error);
      return null;
    }
  }
}

// ==================== 导出工厂函数 ====================

export function createAdaptiveFeedbackAgent(): AdaptiveFeedbackAgent {
  return new AdaptiveFeedbackAgent();
}
