/**
 * 高保真面试流程控制器
 * 
 * 模拟真实公司面试流程：
 * 1. 公司定制：基于知识库模拟该公司真实面试风格
 * 2. 时间限制：可选 30/45/60 分钟
 * 3. 多话题覆盖：按该公司面试结构覆盖多个话题
 * 4. 面试官人设：模拟该公司面试官风格
 * 5. 非阻塞设计：用户随时可提前结束
 */

import { invokeLLM } from '../../_core/llm';
import type { 
  FullInterviewConfig, 
  FullInterviewState, 
  TopicContext,
  InterviewRound 
} from './types';
// 生成唯一 ID
function generateId(): string {
  return `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 公司面试风格配置
 */
interface CompanyInterviewStyle {
  /** 公司名称 */
  company: string;
  
  /** 面试风格描述 */
  styleDescription: string;
  
  /** 典型面试结构 */
  typicalStructure: {
    round: InterviewRound;
    topics: string[];
    duration: number; // 分钟
  }[];
  
  /** 面试官人设 */
  interviewerPersonas: {
    name: string;
    title: string;
    style: 'friendly' | 'neutral' | 'challenging';
    characteristics: string[];
  }[];
  
  /** 评估重点 */
  evaluationFocus: string[];
  
  /** 常见问题类型 */
  commonQuestionTypes: string[];
}

/**
 * 获取公司面试风格配置
 */
export async function getCompanyInterviewStyle(
  company: string,
  position: string
): Promise<CompanyInterviewStyle> {
  const prompt = `作为面试专家，请提供 ${company} 公司 ${position} 职位的面试风格配置。

## 要求
1. 基于该公司的真实面试风格和文化
2. 包括典型的面试结构和轮次
3. 描述面试官的典型风格
4. 列出评估重点

返回 JSON：
{
  "company": "${company}",
  "styleDescription": "该公司面试风格的整体描述",
  "typicalStructure": [
    {
      "round": "phone_screen" | "technical" | "behavioral" | "system_design" | "case_study" | "hiring_manager" | "culture_fit",
      "topics": ["话题1", "话题2"],
      "duration": 45
    }
  ],
  "interviewerPersonas": [
    {
      "name": "面试官名字",
      "title": "职位",
      "style": "friendly" | "neutral" | "challenging",
      "characteristics": ["特点1", "特点2"]
    }
  ],
  "evaluationFocus": ["评估重点1", "评估重点2"],
  "commonQuestionTypes": ["问题类型1", "问题类型2"]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'company_interview_style',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              company: { type: 'string' },
              styleDescription: { type: 'string' },
              typicalStructure: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    round: { 
                      type: 'string',
                      enum: ['phone_screen', 'technical', 'behavioral', 'system_design', 'case_study', 'hiring_manager', 'culture_fit']
                    },
                    topics: { type: 'array', items: { type: 'string' } },
                    duration: { type: 'number' }
                  },
                  required: ['round', 'topics', 'duration'],
                  additionalProperties: false
                }
              },
              interviewerPersonas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    title: { type: 'string' },
                    style: { type: 'string', enum: ['friendly', 'neutral', 'challenging'] },
                    characteristics: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['name', 'title', 'style', 'characteristics'],
                  additionalProperties: false
                }
              },
              evaluationFocus: { type: 'array', items: { type: 'string' } },
              commonQuestionTypes: { type: 'array', items: { type: 'string' } }
            },
            required: ['company', 'styleDescription', 'typicalStructure', 'interviewerPersonas', 'evaluationFocus', 'commonQuestionTypes'],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[getCompanyInterviewStyle] Error:', error);
  }

  // 默认配置
  return {
    company,
    styleDescription: '标准技术面试流程',
    typicalStructure: [
      { round: 'behavioral', topics: ['自我介绍', '项目经验', '团队协作'], duration: 30 },
      { round: 'technical', topics: ['技术能力', '问题解决', '系统设计'], duration: 45 }
    ],
    interviewerPersonas: [
      { name: 'Alex', title: 'Senior Engineer', style: 'neutral', characteristics: ['专业', '注重细节'] }
    ],
    evaluationFocus: ['技术能力', '沟通能力', '问题解决能力'],
    commonQuestionTypes: ['行为问题', '技术问题', '情景问题']
  };
}

/**
 * 初始化高保真面试
 */
export async function initializeFullInterview(
  config: FullInterviewConfig
): Promise<FullInterviewState> {
  // 获取公司面试风格
  const companyStyle = await getCompanyInterviewStyle(config.company, config.position);
  
  // 找到对应轮次的话题
  const roundConfig = companyStyle.typicalStructure.find(s => s.round === config.round);
  const topicsTocover = config.topicsTocover.length > 0 
    ? config.topicsTocover 
    : (roundConfig?.topics || ['项目经验', '技术能力', '团队协作']);

  // 选择面试官人设
  const interviewer = config.interviewerPersona || companyStyle.interviewerPersonas[0];

  return {
    config: {
      ...config,
      interviewerPersona: interviewer,
      topicsTocover
    },
    startedAt: new Date().toISOString(),
    remainingTime: config.timeLimit ? config.timeLimit * 60 : undefined,
    completedTopics: [],
    currentTopic: undefined,
    pendingTopics: topicsTocover,
    ended: false
  };
}

/**
 * 开始新话题
 */
export function startNewTopic(
  state: FullInterviewState,
  topicName?: string
): { state: FullInterviewState; topic: TopicContext } {
  // 选择话题
  const selectedTopic = topicName || state.pendingTopics[0];
  
  if (!selectedTopic) {
    throw new Error('No more topics available');
  }

  // 创建话题上下文
  const topic: TopicContext = {
    id: generateId(),
    name: selectedTopic,
    status: 'collecting',
    startedAt: new Date().toISOString(),
    messages: [],
    collectedInfo: [],
    source: `${state.config.company} ${state.config.round} 面试`,
    targetSkills: getTopicSkills(selectedTopic, state.config.position)
  };

  // 更新状态
  const newState: FullInterviewState = {
    ...state,
    currentTopic: topic,
    pendingTopics: state.pendingTopics.filter(t => t !== selectedTopic)
  };

  return { state: newState, topic };
}

/**
 * 完成当前话题
 */
export function completeTopic(
  state: FullInterviewState,
  topic: TopicContext
): FullInterviewState {
  const completedTopic: TopicContext = {
    ...topic,
    status: topic.status === 'collecting' ? 'collected' : topic.status,
    endedAt: new Date().toISOString()
  };

  return {
    ...state,
    completedTopics: [...state.completedTopics, completedTopic],
    currentTopic: undefined
  };
}

/**
 * 提前结束面试
 */
export function endInterviewEarly(
  state: FullInterviewState,
  reason: 'user_ended' | 'time_up'
): FullInterviewState {
  // 如果有当前话题，先完成它
  let finalState = state;
  if (state.currentTopic) {
    const abandonedTopic: TopicContext = {
      ...state.currentTopic,
      status: 'abandoned',
      endedAt: new Date().toISOString()
    };
    finalState = {
      ...state,
      completedTopics: [...state.completedTopics, abandonedTopic],
      currentTopic: undefined
    };
  }

  return {
    ...finalState,
    ended: true,
    endReason: reason
  };
}

/**
 * 检查是否应该结束面试
 */
export function shouldEndInterview(state: FullInterviewState): {
  shouldEnd: boolean;
  reason?: 'completed' | 'time_up';
} {
  // 所有话题都完成了
  if (state.pendingTopics.length === 0 && !state.currentTopic) {
    return { shouldEnd: true, reason: 'completed' };
  }

  // 时间到了
  if (state.remainingTime !== undefined && state.remainingTime <= 0) {
    return { shouldEnd: true, reason: 'time_up' };
  }

  return { shouldEnd: false };
}

/**
 * 更新剩余时间
 */
export function updateRemainingTime(
  state: FullInterviewState,
  elapsedSeconds: number
): FullInterviewState {
  if (state.remainingTime === undefined) {
    return state;
  }

  return {
    ...state,
    remainingTime: Math.max(0, state.remainingTime - elapsedSeconds)
  };
}

/**
 * 生成面试开场白
 */
export async function generateInterviewOpening(
  config: FullInterviewConfig
): Promise<string> {
  const interviewer = config.interviewerPersona;
  
  const prompt = `作为 ${config.company} 的面试官，请生成一段面试开场白。

## 面试信息
- 公司: ${config.company}
- 职位: ${config.position}
- 轮次: ${config.round}
- 面试官: ${interviewer?.name || 'Alex'}, ${interviewer?.title || 'Senior Engineer'}
- 面试官风格: ${interviewer?.style || 'neutral'}
${config.timeLimit ? `- 时间限制: ${config.timeLimit} 分钟` : ''}

## 要求
1. 自然、专业的开场
2. 简要介绍面试流程
3. 让候选人感到舒适
4. 提醒候选人可以随时提问或暂停
5. 控制在 100 字以内

直接返回开场白文本，不要 JSON。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateInterviewOpening] Error:', error);
  }

  // 默认开场白
  return `你好！我是 ${interviewer?.name || 'Alex'}，${config.company} 的 ${interviewer?.title || '面试官'}。

今天我们将进行 ${config.position} 职位的 ${getRoundName(config.round)} 面试${config.timeLimit ? `，大约 ${config.timeLimit} 分钟` : ''}。

面试过程中，如果你需要暂停或有任何问题，随时告诉我。准备好了吗？`;
}

/**
 * 生成话题开场问题
 */
export async function generateTopicQuestion(
  topic: TopicContext,
  config: FullInterviewConfig,
  previousTopics: TopicContext[]
): Promise<string> {
  const prompt = `作为 ${config.company} 的面试官，请针对"${topic.name}"话题生成一个开场问题。

## 面试信息
- 公司: ${config.company}
- 职位: ${config.position}
- 当前话题: ${topic.name}
- 考核能力: ${topic.targetSkills.join(', ')}

## 已完成的话题
${previousTopics.map(t => `- ${t.name}`).join('\n') || '无'}

## 要求
1. 问题要具体、开放
2. 符合 ${config.company} 的面试风格
3. 自然过渡（如果有之前的话题）
4. 控制在 50 字以内

直接返回问题文本。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[generateTopicQuestion] Error:', error);
  }

  return `让我们聊聊${topic.name}。能分享一个相关的经历吗？`;
}

/**
 * 获取话题对应的技能
 */
function getTopicSkills(topicName: string, position: string): string[] {
  const topicSkillMap: Record<string, string[]> = {
    '自我介绍': ['沟通能力', '自我认知', '职业规划'],
    '项目经验': ['项目管理', '技术能力', '问题解决'],
    '团队协作': ['协作能力', '沟通能力', '领导力'],
    '技术能力': ['专业技能', '学习能力', '问题解决'],
    '问题解决': ['分析能力', '创新思维', '执行力'],
    '系统设计': ['架构能力', '技术深度', '权衡取舍'],
    '职业规划': ['自我认知', '目标导向', '学习能力']
  };

  return topicSkillMap[topicName] || ['综合能力'];
}

/**
 * 获取轮次名称
 */
function getRoundName(round: InterviewRound): string {
  const roundNames: Record<InterviewRound, string> = {
    phone_screen: '电话筛选',
    technical: '技术面试',
    behavioral: '行为面试',
    system_design: '系统设计',
    case_study: '案例分析',
    hiring_manager: '招聘经理面试',
    culture_fit: '文化匹配面试'
  };
  return roundNames[round] || '面试';
}

/**
 * 生成时间提醒
 */
export function generateTimeReminder(remainingMinutes: number): string | null {
  if (remainingMinutes === 10) {
    return '温馨提示：我们还有大约 10 分钟。';
  }
  if (remainingMinutes === 5) {
    return '还有 5 分钟，我们可以开始收尾了。';
  }
  if (remainingMinutes === 1) {
    return '时间快到了，让我们做个简短的总结。';
  }
  return null;
}
