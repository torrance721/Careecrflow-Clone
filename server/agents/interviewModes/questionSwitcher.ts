/**
 * 问题切换器
 * 
 * 处理用户请求换题的各种场景：
 * - want_easier: 换更简单的题
 * - want_harder: 换更难的题
 * - want_specific: 换具体的面试考题
 * - switch_topic: 换话题
 */

import { invokeLLM } from '../../_core/llm';
import type { TopicContext } from './types';

export interface SwitchQuestionParams {
  currentTopic: TopicContext;
  targetPosition: string;
  switchType: 'easier' | 'harder' | 'specific' | 'topic';
  resumeText?: string;
}

export interface SwitchQuestionResult {
  newQuestion: string;
  newTopic?: TopicContext;  // 如果是换话题，返回新话题
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'behavioral' | 'technical' | 'system_design' | 'coding' | 'case_study';
}

/**
 * 判断是否是技术岗位
 */
function isTechnicalPosition(position: string): boolean {
  const techKeywords = [
    'engineer', 'developer', 'programmer', 'swe', 'sde',
    '工程师', '开发', '程序员', '架构师',
    'backend', 'frontend', 'fullstack', 'devops', 'data',
    '后端', '前端', '全栈', '运维', '数据'
  ];
  const lowerPosition = position.toLowerCase();
  return techKeywords.some(kw => lowerPosition.includes(kw));
}

/**
 * 生成更简单的问题
 */
async function generateEasierQuestion(params: SwitchQuestionParams): Promise<string> {
  const { currentTopic, targetPosition, resumeText } = params;
  
  const lastQuestion = currentTopic.messages
    .filter(m => m.role === 'assistant')
    .pop()?.content || currentTopic.name;

  const prompt = `你是面试官，候选人觉得当前问题太难了，需要换一个**更简单**的问题。

当前职位：${targetPosition}
当前话题：${currentTopic.name}
考核能力：${currentTopic.targetSkills.join('、')}
原问题：${lastQuestion.slice(0, 200)}
${resumeText ? `候选人简历：${resumeText.slice(0, 500)}` : ''}

请生成一个**更简单**的问题，要求：
1. 同一话题，但难度降低
2. 更基础、更常见的场景
3. 不需要太深的技术细节
4. 让候选人更容易开始回答

简单问题示例：
- 原问题"设计一个分布式缓存系统" → 简化为"你用过哪些缓存技术？在什么场景下使用的？"
- 原问题"如何优化百万级数据的查询" → 简化为"说说你做过的数据库优化经验"
- 原问题"实现一个 LRU 缓存" → 简化为"什么是 LRU？它的应用场景是什么？"

直接返回新问题，不要任何前缀或解释。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });
    const content = response.choices[0]?.message?.content;
    return (typeof content === 'string' ? content : null) || '能说说你在这方面的基础经验吗？';
  } catch (error) {
    console.error('[generateEasierQuestion] Error:', error);
    return '能说说你在这方面的基础经验吗？';
  }
}

/**
 * 生成更难的问题
 */
async function generateHarderQuestion(params: SwitchQuestionParams): Promise<string> {
  const { currentTopic, targetPosition, resumeText } = params;
  
  const lastQuestion = currentTopic.messages
    .filter(m => m.role === 'assistant')
    .pop()?.content || currentTopic.name;

  const prompt = `你是面试官，候选人觉得当前问题太简单了，需要换一个**更有挑战性**的问题。

当前职位：${targetPosition}
当前话题：${currentTopic.name}
考核能力：${currentTopic.targetSkills.join('、')}
原问题：${lastQuestion.slice(0, 200)}
${resumeText ? `候选人简历：${resumeText.slice(0, 500)}` : ''}

请生成一个**更难**的问题，要求：
1. 同一话题，但难度提升
2. 涉及更复杂的场景或边界情况
3. 需要更深的技术理解
4. 可以是系统设计、性能优化、架构决策等

难题示例：
- 原问题"你用过什么缓存" → 升级为"如何设计一个支持多数据中心的分布式缓存系统？"
- 原问题"说说你的项目经验" → 升级为"如果让你重新设计这个系统，你会做哪些不同的决策？为什么？"
- 原问题"什么是 LRU" → 升级为"实现一个线程安全的 LRU 缓存，支持 O(1) 的读写操作"

直接返回新问题，不要任何前缀或解释。`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });
    const content = response.choices[0]?.message?.content;
    return (typeof content === 'string' ? content : null) || '能深入讲讲这个系统的架构设计和技术决策吗？';
  } catch (error) {
    console.error('[generateHarderQuestion] Error:', error);
    return '能深入讲讲这个系统的架构设计和技术决策吗？';
  }
}

/**
 * 生成具体的面试考题
 */
async function generateSpecificQuestion(params: SwitchQuestionParams): Promise<string> {
  const { currentTopic, targetPosition, resumeText } = params;
  const isTechnical = isTechnicalPosition(targetPosition);

  const technicalPrompt = `你是资深技术面试官，候选人要求一个**具体的技术面试题**，而不是泛泛的经验讨论。

当前职位：${targetPosition}
当前话题：${currentTopic.name}
考核能力：${currentTopic.targetSkills.join('、')}
${resumeText ? `候选人简历：${resumeText.slice(0, 500)}` : ''}

请生成一个**具体的技术面试题**，可以是以下类型之一：

1. **系统设计题**
   - "设计一个短链接服务，支持百万级 QPS"
   - "设计一个实时排行榜系统"
   - "设计一个分布式任务调度系统"

2. **算法/数据结构题**
   - "实现一个 LRU 缓存，要求 O(1) 的读写"
   - "设计一个支持通配符的字符串匹配算法"
   - "实现一个线程安全的生产者-消费者队列"

3. **技术方案题**
   - "如何优化一个响应时间超过 5 秒的 API？"
   - "如何设计一个灰度发布系统？"
   - "如何处理分布式系统中的数据一致性问题？"

4. **场景分析题**
   - "线上服务突然出现大量超时，你会如何排查？"
   - "数据库 CPU 突然飙升到 100%，如何定位问题？"

要求：
- 问题必须具体、有明确的技术点
- 不要问"说说你的经验"这种开放式问题
- 直接返回问题，不要任何前缀

直接返回问题本身。`;

  const behavioralPrompt = `你是资深面试官，候选人要求一个**具体的面试题**，而不是泛泛的讨论。

当前职位：${targetPosition}
当前话题：${currentTopic.name}
考核能力：${currentTopic.targetSkills.join('、')}
${resumeText ? `候选人简历：${resumeText.slice(0, 500)}` : ''}

请生成一个**具体的行为面试题**，可以是以下类型：

1. **情景模拟题**
   - "假设你的团队成员对你的方案有不同意见，你会如何处理？"
   - "如果项目截止日期临近但进度落后，你会采取什么措施？"

2. **案例分析题**
   - "描述一个你成功说服他人接受你观点的经历"
   - "讲述一个你在压力下做出重要决策的例子"

3. **能力考察题**
   - "你如何确保跨部门项目的顺利推进？"
   - "描述你如何处理与难相处的同事的合作"

要求：
- 问题必须具体、有明确的考察点
- 使用 STAR 方法可以回答的问题
- 直接返回问题，不要任何前缀

直接返回问题本身。`;

  const prompt = isTechnical ? technicalPrompt : behavioralPrompt;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }]
    });
    const content = response.choices[0]?.message?.content;
    return (typeof content === 'string' ? content : null) || 
      (isTechnical 
        ? '请设计一个支持高并发的消息队列系统，说说你的整体架构设计。'
        : '描述一个你在团队中解决冲突的经历，你是如何处理的？');
  } catch (error) {
    console.error('[generateSpecificQuestion] Error:', error);
    return isTechnical 
      ? '请设计一个支持高并发的消息队列系统，说说你的整体架构设计。'
      : '描述一个你在团队中解决冲突的经历，你是如何处理的？';
  }
}

/**
 * 主函数：根据切换类型生成新问题
 */
export async function switchQuestion(params: SwitchQuestionParams): Promise<SwitchQuestionResult> {
  const { switchType, currentTopic } = params;
  
  let newQuestion: string;
  let difficulty: 'easy' | 'medium' | 'hard' = currentTopic.difficulty || 'medium';
  let questionType: SwitchQuestionResult['questionType'] = 'behavioral';

  switch (switchType) {
    case 'easier':
      newQuestion = await generateEasierQuestion(params);
      difficulty = 'easy';
      break;
    
    case 'harder':
      newQuestion = await generateHarderQuestion(params);
      difficulty = 'hard';
      break;
    
    case 'specific':
      newQuestion = await generateSpecificQuestion(params);
      // 具体题目通常是中等或困难
      difficulty = isTechnicalPosition(params.targetPosition) ? 'medium' : 'medium';
      questionType = isTechnicalPosition(params.targetPosition) ? 'technical' : 'behavioral';
      break;
    
    default:
      // switch_topic 由其他逻辑处理
      newQuestion = '让我们换个话题。';
      break;
  }

  return {
    newQuestion,
    difficulty,
    questionType
  };
}

/**
 * 生成换题的过渡语
 */
export function generateTransitionMessage(switchType: 'easier' | 'harder' | 'specific', isZh: boolean = true): string {
  const transitions = {
    easier: {
      zh: '好的，我们换一个更基础的问题：',
      en: 'Sure, let me ask something more basic: '
    },
    harder: {
      zh: '好的，来一个更有挑战性的问题：',
      en: 'Alright, here\'s a more challenging one: '
    },
    specific: {
      zh: '好的，给你一道具体的面试题：',
      en: 'Sure, here\'s a specific interview question: '
    }
  };

  return isZh ? transitions[switchType].zh : transitions[switchType].en;
}
