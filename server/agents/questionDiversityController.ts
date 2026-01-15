/**
 * Question Diversity Controller
 * 
 * 解决高挑剔度用户反馈的问题重复问题：
 * 1. 跟踪已使用的问题模式
 * 2. 强制问题多样性
 * 3. 防止连续使用相同的追问模式
 */

import { invokeLLM } from '../_core/llm';

export interface QuestionPattern {
  pattern: string;  // e.g., "Can you walk me through...", "Tell me about..."
  category: 'follow_up' | 'clarification' | 'deep_dive' | 'challenge' | 'pivot';
  usageCount: number;
  lastUsedIndex: number;
}

export interface DiversityContext {
  usedPatterns: QuestionPattern[];
  usedTopics: string[];
  questionHistory: string[];
  totalQuestions: number;
}

// 常见的问题模式
const QUESTION_PATTERNS = [
  { pattern: 'walk me through', category: 'follow_up' as const },
  { pattern: 'tell me about', category: 'follow_up' as const },
  { pattern: 'can you explain', category: 'clarification' as const },
  { pattern: 'how did you', category: 'deep_dive' as const },
  { pattern: 'what was your', category: 'deep_dive' as const },
  { pattern: 'why did you', category: 'challenge' as const },
  { pattern: 'what would happen', category: 'challenge' as const },
  { pattern: 'how would you', category: 'challenge' as const },
  { pattern: 'let\'s shift to', category: 'pivot' as const },
  { pattern: 'moving on to', category: 'pivot' as const },
  { pattern: 'now let\'s discuss', category: 'pivot' as const },
];

/**
 * 检测问题中使用的模式
 */
export function detectQuestionPattern(question: string): QuestionPattern | null {
  const questionLower = question.toLowerCase();
  
  for (const p of QUESTION_PATTERNS) {
    if (questionLower.includes(p.pattern)) {
      return {
        pattern: p.pattern,
        category: p.category,
        usageCount: 1,
        lastUsedIndex: 0,
      };
    }
  }
  
  return null;
}

/**
 * 检查问题是否违反多样性规则
 */
export function checkDiversityViolation(
  newQuestion: string,
  context: DiversityContext
): { isViolation: boolean; reason: string; suggestion: string } {
  const newPattern = detectQuestionPattern(newQuestion);
  
  if (!newPattern) {
    return { isViolation: false, reason: '', suggestion: '' };
  }
  
  // 检查是否连续使用相同模式
  const recentQuestions = context.questionHistory.slice(-3);
  let consecutiveCount = 0;
  
  for (const q of recentQuestions) {
    const qPattern = detectQuestionPattern(q);
    if (qPattern && qPattern.pattern === newPattern.pattern) {
      consecutiveCount++;
    }
  }
  
  if (consecutiveCount >= 2) {
    return {
      isViolation: true,
      reason: `Pattern "${newPattern.pattern}" used ${consecutiveCount + 1} times consecutively`,
      suggestion: getAlternativePattern(newPattern.category),
    };
  }
  
  // 检查模式在整个面试中的使用频率
  const existingPattern = context.usedPatterns.find(p => p.pattern === newPattern.pattern);
  if (existingPattern && existingPattern.usageCount >= 3) {
    return {
      isViolation: true,
      reason: `Pattern "${newPattern.pattern}" already used ${existingPattern.usageCount} times`,
      suggestion: getAlternativePattern(newPattern.category),
    };
  }
  
  return { isViolation: false, reason: '', suggestion: '' };
}

/**
 * 获取替代的问题模式
 */
function getAlternativePattern(category: QuestionPattern['category']): string {
  const alternatives: Record<QuestionPattern['category'], string[]> = {
    follow_up: [
      'I\'d like to understand more about...',
      'Could you elaborate on...',
      'What specifically happened when...',
      'Help me understand the details of...',
    ],
    clarification: [
      'What do you mean by...',
      'Could you clarify...',
      'I want to make sure I understand...',
      'When you say X, do you mean...',
    ],
    deep_dive: [
      'Let\'s dig deeper into...',
      'I\'m curious about the specifics of...',
      'What were the technical details of...',
      'Walk me through the implementation of...',
    ],
    challenge: [
      'What if the situation was different...',
      'How would you handle it if...',
      'What are the trade-offs of...',
      'What could have gone wrong with...',
    ],
    pivot: [
      'Switching gears a bit...',
      'On a different note...',
      'Let\'s explore another area...',
      'I\'d like to hear about a different experience...',
    ],
  };
  
  const options = alternatives[category];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 更新多样性上下文
 */
export function updateDiversityContext(
  context: DiversityContext,
  question: string,
  questionIndex: number
): DiversityContext {
  const pattern = detectQuestionPattern(question);
  
  const newContext = {
    ...context,
    questionHistory: [...context.questionHistory, question],
  };
  
  if (pattern) {
    const existingIndex = newContext.usedPatterns.findIndex(p => p.pattern === pattern.pattern);
    if (existingIndex >= 0) {
      newContext.usedPatterns[existingIndex].usageCount++;
      newContext.usedPatterns[existingIndex].lastUsedIndex = questionIndex;
    } else {
      newContext.usedPatterns.push({
        ...pattern,
        lastUsedIndex: questionIndex,
      });
    }
  }
  
  return newContext;
}

/**
 * 重写问题以增加多样性
 */
export async function rewriteForDiversity(
  question: string,
  context: DiversityContext,
  language: 'en' | 'zh'
): Promise<string> {
  const violation = checkDiversityViolation(question, context);
  
  if (!violation.isViolation) {
    return question;
  }
  
  const isZh = language === 'zh';
  
  const prompt = isZh
    ? `重写以下面试问题，使用不同的表达方式：

原问题：${question}

问题：${violation.reason}
建议使用的模式：${violation.suggestion}

之前使用过的问题模式：
${context.usedPatterns.map(p => `- "${p.pattern}" (使用 ${p.usageCount} 次)`).join('\n')}

要求：
1. 保持问题的核心意图不变
2. 使用建议的模式或其他新颖的表达方式
3. 让问题听起来自然，不像是机器生成的
4. 不要使用已经频繁使用的模式

只返回重写后的问题，不要其他内容。`
    : `Rewrite this interview question using a different phrasing:

Original question: ${question}

Issue: ${violation.reason}
Suggested pattern: ${violation.suggestion}

Previously used patterns:
${context.usedPatterns.map(p => `- "${p.pattern}" (used ${p.usageCount} times)`).join('\n')}

Requirements:
1. Keep the core intent of the question
2. Use the suggested pattern or another novel phrasing
3. Make it sound natural, not machine-generated
4. Avoid patterns that have been used frequently

Return only the rewritten question, nothing else.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content.trim();
    }
  } catch (error) {
    console.error('[QuestionDiversityController] Error rewriting question:', error);
  }
  
  // Fallback: 使用建议的模式替换
  const pattern = detectQuestionPattern(question);
  if (pattern) {
    return question.replace(new RegExp(pattern.pattern, 'i'), violation.suggestion);
  }
  
  return question;
}

/**
 * 创建初始多样性上下文
 */
export function createDiversityContext(totalQuestions: number): DiversityContext {
  return {
    usedPatterns: [],
    usedTopics: [],
    questionHistory: [],
    totalQuestions,
  };
}

/**
 * 检查问题是否与目标职位相关
 */
export async function checkJobRelevance(
  question: string,
  targetPosition: string,
  targetCompany: string
): Promise<{ isRelevant: boolean; reason: string; suggestedTopic?: string }> {
  // 定义职位类型和相关主题
  const positionKeywords: Record<string, string[]> = {
    'designer': ['design', 'user experience', 'ux', 'ui', 'prototype', 'figma', 'user research', 'wireframe', 'visual', 'interaction', 'accessibility', 'usability'],
    'engineer': ['code', 'programming', 'architecture', 'system', 'api', 'database', 'deployment', 'testing', 'debugging', 'performance', 'scalability'],
    'product': ['roadmap', 'prioritization', 'stakeholder', 'metrics', 'user story', 'feature', 'market', 'customer', 'strategy', 'backlog'],
    'data': ['analytics', 'sql', 'python', 'machine learning', 'statistics', 'visualization', 'pipeline', 'etl', 'model', 'prediction'],
    'marketing': ['campaign', 'brand', 'content', 'social media', 'seo', 'conversion', 'audience', 'messaging', 'growth'],
    'sales': ['pipeline', 'quota', 'negotiation', 'client', 'deal', 'revenue', 'prospecting', 'closing'],
    'consultant': ['client', 'analysis', 'recommendation', 'framework', 'presentation', 'stakeholder', 'problem-solving', 'case study'],
  };
  
  // 不相关的主题（对于特定职位）
  const irrelevantTopics: Record<string, string[]> = {
    'designer': ['data architecture', 'devops', 'kubernetes', 'microservices', 'database optimization', 'backend infrastructure', 's3', 'aws', 'terraform'],
    'product': ['code review', 'deployment pipeline', 'database schema', 'api design'],
    'marketing': ['system architecture', 'code optimization', 'database design'],
    'sales': ['technical architecture', 'code review', 'system design'],
  };
  
  const positionLower = targetPosition.toLowerCase();
  const questionLower = question.toLowerCase();
  
  // 确定职位类型
  let positionType = '';
  for (const [type, keywords] of Object.entries(positionKeywords)) {
    if (positionLower.includes(type)) {
      positionType = type;
      break;
    }
  }
  
  if (!positionType) {
    // 无法确定职位类型，默认相关
    return { isRelevant: true, reason: '' };
  }
  
  // 检查是否包含不相关主题
  const irrelevant = irrelevantTopics[positionType] || [];
  for (const topic of irrelevant) {
    if (questionLower.includes(topic)) {
      // 获取相关主题建议
      const relevantKeywords = positionKeywords[positionType] || [];
      const suggestedTopic = relevantKeywords[Math.floor(Math.random() * relevantKeywords.length)];
      
      return {
        isRelevant: false,
        reason: `Question about "${topic}" is not relevant for ${targetPosition} role`,
        suggestedTopic,
      };
    }
  }
  
  return { isRelevant: true, reason: '' };
}

/**
 * 重写问题以符合职位相关性
 */
export async function rewriteForJobRelevance(
  question: string,
  targetPosition: string,
  targetCompany: string,
  suggestedTopic: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const prompt = `Rewrite this interview question to be relevant for a ${targetPosition} role at ${targetCompany}.

Original question: ${question}

The question is about a topic not relevant to this role. Please rewrite it to focus on: ${suggestedTopic}

Recent conversation context:
${conversationHistory.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 200)}...`).join('\n')}

Requirements:
1. Keep the question challenging and specific
2. Focus on ${suggestedTopic} or related topics for ${targetPosition}
3. Build on the candidate's previous answers if possible
4. Make it sound natural and conversational

Return only the rewritten question.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content.trim();
    }
  } catch (error) {
    console.error('[QuestionDiversityController] Error rewriting for job relevance:', error);
  }
  
  // Fallback: 返回一个通用的相关问题
  return `Tell me about a time when you demonstrated ${suggestedTopic} skills in your role as ${targetPosition}.`;
}

/**
 * 检查是否需要主题轮换
 */
export function shouldRotateTopic(context: DiversityContext): boolean {
  // 每 3 个问题强制轮换主题
  if (context.questionHistory.length > 0 && context.questionHistory.length % 3 === 0) {
    return true;
  }
  
  // 检查最近 3 个问题是否都在同一主题
  const recentQuestions = context.questionHistory.slice(-3);
  if (recentQuestions.length < 3) return false;
  
  // 简单检查：如果最近 3 个问题都包含相同的关键词，则需要轮换
  const commonKeywords = extractCommonKeywords(recentQuestions);
  return commonKeywords.length > 0;
}

/**
 * 提取共同关键词
 */
function extractCommonKeywords(questions: string[]): string[] {
  const keywordSets = questions.map(q => {
    const words = q.toLowerCase().split(/\s+/);
    return new Set(words.filter(w => w.length > 4)); // 只考虑较长的词
  });
  
  if (keywordSets.length === 0) return [];
  
  const firstSet = keywordSets[0];
  const common: string[] = [];
  
  for (const word of Array.from(firstSet)) {
    if (keywordSets.every(set => set.has(word))) {
      common.push(word);
    }
  }
  
  return common;
}

/**
 * 获取下一个应该探索的主题
 */
export function getNextTopic(
  targetPosition: string,
  usedTopics: string[]
): string {
  const positionLower = targetPosition.toLowerCase();
  
  // 根据职位类型定义应该覆盖的主题
  const topicsByPosition: Record<string, string[]> = {
    'designer': ['user research methodology', 'design process', 'stakeholder management', 'design systems', 'usability testing', 'cross-functional collaboration', 'design critique'],
    'engineer': ['system design', 'code quality', 'debugging approach', 'technical leadership', 'performance optimization', 'team collaboration', 'learning new technologies'],
    'product': ['prioritization framework', 'stakeholder alignment', 'metrics definition', 'user research', 'roadmap planning', 'cross-functional leadership', 'handling ambiguity'],
    'data': ['data quality', 'analysis methodology', 'stakeholder communication', 'model evaluation', 'business impact', 'technical challenges', 'data ethics'],
    'consultant': ['client management', 'problem structuring', 'recommendation development', 'presentation skills', 'team dynamics', 'handling pushback', 'time management'],
  };
  
  let positionType = 'engineer'; // 默认
  for (const type of Object.keys(topicsByPosition)) {
    if (positionLower.includes(type)) {
      positionType = type;
      break;
    }
  }
  
  const topics = topicsByPosition[positionType] || topicsByPosition['engineer'];
  const unusedTopics = topics.filter(t => !usedTopics.includes(t));
  
  if (unusedTopics.length > 0) {
    return unusedTopics[0];
  }
  
  // 所有主题都用过了，返回使用最少的
  return topics[0];
}
