/**
 * Realistic Interview Simulator
 * 
 * 模拟真人用户完整体验面试流程：
 * 1. 从首页开始，输入目标职位
 * 2. 等待 AI 准备面试问题
 * 3. 完整回答每个问题
 * 4. 根据需要请求提示
 * 5. 查看评估报告
 * 6. 提供真实反馈
 */

import { invokeLLM } from '../../_core/llm';
import { MockPersona } from './personaGenerator';
import { generateHint } from '../hintGenerator';
import { 
  determineSeniorityLevel, 
  determineTechnicalDepth,
  analyzeAnswerWeakPoints,
  generateWeakPointFollowUp,
  generateNarrativeTransition,
  type EnhancedQuestionOptions,
} from '../enhancedQuestionGenerator';
import {
  generateAggressiveFollowUp,
  generateStrategicSynthesis,
  type AggressiveInterviewConfig,
} from '../aggressiveInterviewer';
import {
  analyzeSTARStructure,
  generateSTARCoaching,
  needsSTARCoaching,
  type STARAnalysis,
} from '../starScoring';
import {
  generateClosingSequence,
  generateClosingTransition,
  formatSummaryForDisplay,
} from '../interviewClosing';
import { generateInterviewResponse } from '../nextQuestionGenerator';
import {
  extractTechnicalClaims,
  generateTechnicalChallenge,
  getNaturalTransition,
  getConversationPacing,
  generateNonInterruptingFollowUp,
  type TechnicalClaim,
} from '../technicalChallenger';
import * as fs from 'fs';
import * as path from 'path';
import { 
  createDiversityContext, 
  updateDiversityContext, 
  rewriteForDiversity, 
  type DiversityContext 
} from '../questionDiversityController';
import { 
  generateEnhancedHint, 
  detectCopyPaste, 
  formatEnhancedHint, 
  getOriginalityReminder,
  type EnhancedHintResponse 
} from '../enhancedHintSystem';
import {
  shouldSwitchTopic,
  generateContextAwareQuestion,
} from './generalizationEvaluator';

// ==================== 类型定义 ====================

export interface UserAction {
  type: 'click' | 'type' | 'wait' | 'scroll' | 'think' | 'read' | 'hesitate';
  target?: string;
  value?: string;
  duration: number; // milliseconds
  timestamp: string;
  thought?: string; // 用户内心想法
}

export interface RealisticMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  userActions?: UserAction[]; // 用户在发送消息前的行为
  metadata?: {
    questionType?: string;
    responseQuality?: string;
    hintRequested?: boolean;
    hintContent?: string;
    thinkingTime?: number; // 用户思考时间
    typingTime?: number; // 用户打字时间
    editCount?: number; // 用户修改次数
    seniorityLevel?: string; // 资历级别
    skepticMode?: boolean; // 是否启用怀疑模式
    summary?: unknown; // 面试摘要
    starScore?: unknown; // STAR 评分
  };
}

export interface RealisticSimulationResult {
  id: string;
  personaId: string;
  personaName: string;
  targetJob: {
    company: string;
    position: string;
  };
  
  // 完整用户旅程
  journey: {
    // 阶段 1: 首页
    homepage: {
      arrivalTime: string;
      browseTime: number; // 浏览时间
      actions: UserAction[];
      jobInputMethod: 'typing' | 'carousel_click';
      jobInput: string;
    };
    
    // 阶段 2: 等待准备
    preparation: {
      startTime: string;
      waitTime: number;
      userPatience: 'patient' | 'impatient' | 'neutral';
      actions: UserAction[];
    };
    
    // 阶段 3: 面试对话
    interview: {
      messages: RealisticMessage[];
      hintsUsed: number;
      totalQuestions: number;
      averageResponseTime: number;
      averageThinkingTime: number;
    };
    
    // 阶段 4: 评估报告
    assessment: {
      viewTime: number;
      scrollDepth: number; // 0-100%
      sectionsRead: string[];
      actions: UserAction[];
    };
  };
  
  // 整体指标
  totalDuration: number;
  completedSuccessfully: boolean;
  dropOffPoint?: string; // 如果中途放弃，记录放弃点
  createdAt: string;
  iteration: number;
}

const REALISTIC_SIMULATIONS_DIR = '/home/ubuntu/UHWeb/data/realistic-simulations';

function ensureDir(): void {
  if (!fs.existsSync(REALISTIC_SIMULATIONS_DIR)) {
    fs.mkdirSync(REALISTIC_SIMULATIONS_DIR, { recursive: true });
  }
}

function saveRealisticSimulation(simulation: RealisticSimulationResult): void {
  ensureDir();
  const filePath = path.join(REALISTIC_SIMULATIONS_DIR, `${simulation.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(simulation, null, 2));
}

// ==================== 真人行为模拟 ====================

/**
 * 模拟用户思考时间
 */
function simulateThinkingTime(persona: MockPersona, questionComplexity: 'simple' | 'medium' | 'complex'): number {
  const baseTime = {
    simple: 3000,
    medium: 8000,
    complex: 15000,
  }[questionComplexity];
  
  // 根据性格调整
  const confidenceMultiplier = {
    low: 1.5,
    medium: 1.0,
    high: 0.7,
  }[persona.personality.confidenceLevel];
  
  // 添加随机性
  const randomFactor = 0.5 + Math.random();
  
  return Math.round(baseTime * confidenceMultiplier * randomFactor);
}

/**
 * 模拟用户打字时间
 */
function simulateTypingTime(text: string, persona: MockPersona): number {
  // 平均打字速度: 40-80 WPM
  const wordsPerMinute = persona.personality.confidenceLevel === 'high' ? 70 : 50;
  const words = text.split(/\s+/).length;
  const baseTime = (words / wordsPerMinute) * 60 * 1000;
  
  // 添加思考和修改时间
  const editTime = Math.random() * 5000;
  
  return Math.round(baseTime + editTime);
}

/**
 * 生成候选人在面试结束时的提问
 */
async function generatePersonaQuestion(
  persona: MockPersona,
  targetJob: { company: string; position: string },
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'executive'
): Promise<string> {
  const prompt = `Generate a realistic question that a ${seniorityLevel}-level candidate would ask at the end of an interview.

CANDIDATE PROFILE:
- Name: ${persona.name}
- Target Position: ${targetJob.position} at ${targetJob.company}
- Seniority: ${seniorityLevel}
- Personality: ${persona.personality.communicationStyle} communication style, ${persona.personality.confidenceLevel} confidence

Generate a question that:
1. Is appropriate for the seniority level
2. Shows genuine interest in the role/company
3. Reflects the candidate's personality
4. Is specific and thoughtful (not generic)

${seniorityLevel === 'executive' ? 'Focus on strategic direction, leadership team, or business challenges' : ''}
${seniorityLevel === 'senior' ? 'Focus on team structure, technical challenges, or growth opportunities' : ''}
${seniorityLevel === 'mid' ? 'Focus on day-to-day work, team dynamics, or career development' : ''}
${seniorityLevel === 'junior' ? 'Focus on learning opportunities, mentorship, or team culture' : ''}

Return just the question text, no JSON.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[RealisticSimulator] Error generating persona question:', error);
  }

  // Fallback questions based on seniority
  const fallbacks = {
    executive: "What are the biggest strategic challenges the company is facing in the next 12-18 months, and how does this role contribute to addressing them?",
    senior: "Can you tell me more about the team structure and how this role collaborates with other departments?",
    mid: "What does a typical day look like for someone in this role, and what are the key priorities for the first 90 days?",
    junior: "What opportunities are there for learning and professional development in this role?",
  };
  return fallbacks[seniorityLevel];
}

/**
 * 模拟用户在首页的行为
 */
async function simulateHomepageBehavior(persona: MockPersona): Promise<{
  arrivalTime: string;
  browseTime: number;
  actions: UserAction[];
  jobInputMethod: 'typing' | 'carousel_click';
  jobInput: string;
}> {
  const actions: UserAction[] = [];
  const now = new Date();
  
  // 1. 页面加载后浏览
  actions.push({
    type: 'read',
    target: 'hero_section',
    duration: 2000 + Math.random() * 3000,
    timestamp: now.toISOString(),
    thought: '这个网站看起来挺专业的',
  });
  
  // 2. 查看成功案例
  if (Math.random() > 0.3) {
    actions.push({
      type: 'scroll',
      target: 'success_stories',
      duration: 3000 + Math.random() * 2000,
      timestamp: new Date(now.getTime() + 3000).toISOString(),
      thought: '看看其他人的成功经历',
    });
    
    actions.push({
      type: 'read',
      target: 'success_story_card',
      duration: 2000 + Math.random() * 2000,
      timestamp: new Date(now.getTime() + 6000).toISOString(),
    });
  }
  
  // 3. 决定输入方式
  const jobInputMethod = Math.random() > 0.4 ? 'typing' : 'carousel_click';
  const jobInput = `${persona.targetJob.position} at ${persona.targetJob.company}`;
  
  if (jobInputMethod === 'typing') {
    // 点击输入框
    actions.push({
      type: 'click',
      target: 'job_input',
      duration: 500,
      timestamp: new Date(now.getTime() + 8000).toISOString(),
    });
    
    // 思考要输入什么
    actions.push({
      type: 'think',
      duration: 1500 + Math.random() * 2000,
      timestamp: new Date(now.getTime() + 8500).toISOString(),
      thought: `我想面试 ${persona.targetJob.position} 这个职位`,
    });
    
    // 打字
    actions.push({
      type: 'type',
      target: 'job_input',
      value: jobInput,
      duration: simulateTypingTime(jobInput, persona),
      timestamp: new Date(now.getTime() + 10000).toISOString(),
    });
  } else {
    // 等待跑马灯
    actions.push({
      type: 'wait',
      target: 'carousel',
      duration: 2000 + Math.random() * 3000,
      timestamp: new Date(now.getTime() + 8000).toISOString(),
      thought: '看看有什么推荐的职位',
    });
    
    // 点击跑马灯中的职位
    actions.push({
      type: 'click',
      target: 'carousel_item',
      value: jobInput,
      duration: 500,
      timestamp: new Date(now.getTime() + 11000).toISOString(),
    });
  }
  
  // 4. 点击开始按钮
  actions.push({
    type: 'click',
    target: 'start_button',
    duration: 500,
    timestamp: new Date(now.getTime() + 13000).toISOString(),
    thought: '开始面试吧！',
  });
  
  const browseTime = actions.reduce((sum, a) => sum + a.duration, 0);
  
  return { arrivalTime: now.toISOString(), browseTime, actions, jobInputMethod, jobInput };
}

/**
 * 模拟用户等待准备阶段的行为
 */
async function simulatePreparationBehavior(persona: MockPersona): Promise<{
  startTime: string;
  waitTime: number;
  userPatience: 'patient' | 'impatient' | 'neutral';
  actions: UserAction[];
}> {
  const actions: UserAction[] = [];
  const now = new Date();
  
  // 模拟等待时间 (10-30秒)
  const waitTime = 10000 + Math.random() * 20000;
  
  // 根据性格决定耐心程度
  const patienceRoll = Math.random();
  let userPatience: 'patient' | 'impatient' | 'neutral';
  
  if (persona.personality.confidenceLevel === 'low') {
    userPatience = patienceRoll > 0.7 ? 'impatient' : 'patient';
  } else {
    userPatience = patienceRoll > 0.5 ? 'neutral' : 'patient';
  }
  
  // 观看进度动画
  actions.push({
    type: 'read',
    target: 'thinking_animation',
    duration: waitTime * 0.3,
    timestamp: now.toISOString(),
    thought: userPatience === 'impatient' ? '怎么这么慢...' : '正在准备中...',
  });
  
  // 可能会滚动页面
  if (userPatience === 'impatient') {
    actions.push({
      type: 'scroll',
      target: 'page',
      duration: 1000,
      timestamp: new Date(now.getTime() + waitTime * 0.4).toISOString(),
      thought: '还要等多久？',
    });
  }
  
  // 继续等待
  actions.push({
    type: 'wait',
    duration: waitTime * 0.6,
    timestamp: new Date(now.getTime() + waitTime * 0.4).toISOString(),
  });
  
  return { startTime: now.toISOString(), waitTime, userPatience, actions };
}

/**
 * 生成真实的用户回答（带行为模拟）
 */
async function generateRealisticUserResponse(
  persona: MockPersona,
  currentQuestion: string,
  conversationHistory: RealisticMessage[],
  questionNumber: number
): Promise<{
  response: string;
  wantsHint: boolean;
  actions: UserAction[];
  thinkingTime: number;
  typingTime: number;
  editCount: number;
}> {
  const actions: UserAction[] = [];
  const now = new Date();
  
  // 1. 阅读问题
  const readTime = 2000 + currentQuestion.length * 20;
  actions.push({
    type: 'read',
    target: 'question',
    duration: readTime,
    timestamp: now.toISOString(),
  });
  
  // 2. 判断问题复杂度
  const complexity = currentQuestion.length > 200 ? 'complex' : 
                     currentQuestion.length > 100 ? 'medium' : 'simple';
  
  // 3. 思考
  const thinkingTime = simulateThinkingTime(persona, complexity);
  actions.push({
    type: 'think',
    duration: thinkingTime,
    timestamp: new Date(now.getTime() + readTime).toISOString(),
    thought: generateInnerThought(persona, complexity),
  });
  
  // 4. 决定是否需要提示
  const { personality, interviewBehavior } = persona;
  let wantsHint = false;
  
  if (questionNumber > 1) {
    const hintProbability = interviewBehavior.getsNervous 
      ? 0.35 
      : (personality.confidenceLevel === 'low' ? 0.25 : 0.08);
    
    // 复杂问题更可能需要提示
    const complexityBonus = complexity === 'complex' ? 0.15 : 0;
    wantsHint = Math.random() < (hintProbability + complexityBonus);
    
    if (wantsHint) {
      actions.push({
        type: 'hesitate',
        duration: 2000,
        timestamp: new Date(now.getTime() + readTime + thinkingTime).toISOString(),
        thought: '这个问题有点难，我需要一些提示...',
      });
      
      actions.push({
        type: 'click',
        target: 'hint_button',
        duration: 500,
        timestamp: new Date(now.getTime() + readTime + thinkingTime + 2000).toISOString(),
      });
    }
  }
  
  // 5. 生成回答
  const response = await generateUserResponseContent(persona, currentQuestion, conversationHistory, questionNumber);
  
  // 6. 打字
  const typingTime = simulateTypingTime(response, persona);
  actions.push({
    type: 'type',
    target: 'response_input',
    value: response,
    duration: typingTime,
    timestamp: new Date(now.getTime() + readTime + thinkingTime + (wantsHint ? 5000 : 0)).toISOString(),
  });
  
  // 7. 可能会修改
  const editCount = Math.random() > 0.6 ? Math.floor(Math.random() * 3) : 0;
  if (editCount > 0) {
    actions.push({
      type: 'type',
      target: 'response_input',
      value: '[editing]',
      duration: editCount * 2000,
      timestamp: new Date(now.getTime() + readTime + thinkingTime + typingTime).toISOString(),
      thought: '让我再改一下...',
    });
  }
  
  // 8. 发送
  actions.push({
    type: 'click',
    target: 'send_button',
    duration: 500,
    timestamp: new Date(now.getTime() + readTime + thinkingTime + typingTime + editCount * 2000).toISOString(),
  });
  
  return { response, wantsHint, actions, thinkingTime, typingTime, editCount };
}

/**
 * 生成用户内心想法
 */
function generateInnerThought(persona: MockPersona, complexity: 'simple' | 'medium' | 'complex'): string {
  const thoughts = {
    simple: [
      '这个问题比较简单，我知道怎么回答',
      '让我想想最好的例子...',
      '这个我有经验',
    ],
    medium: [
      '嗯，让我组织一下思路...',
      '我应该从哪个角度回答呢？',
      '想想我之前的项目经历...',
    ],
    complex: [
      '这个问题有点复杂，我需要好好想想',
      '我该怎么展示我的能力呢？',
      '让我想想最相关的经历...',
    ],
  };
  
  const options = thoughts[complexity];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 生成用户回答内容
 */
async function generateUserResponseContent(
  persona: MockPersona,
  currentQuestion: string,
  conversationHistory: RealisticMessage[],
  questionNumber: number
): Promise<string> {
  const { personality, interviewBehavior, background, resumeText } = persona;
  
  const lengthGuide = {
    brief: '1-2 sentences, concise',
    medium: '3-4 sentences with some detail',
    detailed: '5-7 sentences with specific examples and metrics',
  }[interviewBehavior.typicalResponseLength];
  
  const prompt = `You are simulating a real job candidate in a mock interview. Generate an authentic response.

PERSONA:
- Name: ${persona.name}
- Experience: ${background.yearsOfExperience} years as ${background.currentRole} at ${background.currentCompany}
- Skills: ${background.skills.join(', ')}
- Communication: ${personality.communicationStyle}
- Confidence: ${personality.confidenceLevel}
- Interview behavior: ${interviewBehavior.getsNervous ? 'Gets nervous' : 'Stays calm'}, ${interviewBehavior.usesExamples ? 'Uses specific examples' : 'Speaks generally'}

RESUME:
${resumeText.slice(0, 500)}

SITUATION:
${persona.situation}

QUESTION #${questionNumber}:
"${currentQuestion}"

Generate a realistic response that:
1. Matches the persona's communication style (${personality.communicationStyle})
2. Is ${lengthGuide}
3. ${interviewBehavior.usesExamples ? 'Includes a specific, measurable example' : 'Stays somewhat general'}
4. ${personality.confidenceLevel === 'low' ? 'Shows some hesitation (um, I think, maybe)' : 'Is confident and direct'}
5. Feels natural and human, not robotic
6. May include filler words if nervous

Respond ONLY with the candidate's answer. No quotes or prefixes.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[RealisticSimulator] Error generating response:', error);
  }

  return 'I have relevant experience in that area. Could you tell me more about what specific aspects you\'d like me to focus on?';
}

/**
 * 模拟用户查看评估报告的行为
 */
async function simulateAssessmentBehavior(persona: MockPersona): Promise<{
  viewTime: number;
  scrollDepth: number;
  sectionsRead: string[];
  actions: UserAction[];
}> {
  const actions: UserAction[] = [];
  const now = new Date();
  
  const sections = ['overall_score', 'strengths', 'areas_to_improve', 'recommendations', 'next_steps'];
  const sectionsRead: string[] = [];
  
  // 1. 查看总分
  actions.push({
    type: 'read',
    target: 'overall_score',
    duration: 3000 + Math.random() * 2000,
    timestamp: now.toISOString(),
    thought: '让我看看我的分数...',
  });
  sectionsRead.push('overall_score');
  
  // 2. 滚动查看各部分
  let currentTime = 5000;
  let scrollDepth = 20;
  
  for (const section of sections.slice(1)) {
    if (Math.random() > 0.2) { // 80% 概率查看每个部分
      actions.push({
        type: 'scroll',
        target: section,
        duration: 1000,
        timestamp: new Date(now.getTime() + currentTime).toISOString(),
      });
      
      const readTime = 3000 + Math.random() * 4000;
      actions.push({
        type: 'read',
        target: section,
        duration: readTime,
        timestamp: new Date(now.getTime() + currentTime + 1000).toISOString(),
      });
      
      sectionsRead.push(section);
      currentTime += readTime + 1000;
      scrollDepth += 20;
    }
  }
  
  scrollDepth = Math.min(100, scrollDepth);
  const viewTime = currentTime;
  
  return { viewTime, scrollDepth, sectionsRead, actions };
}

// ==================== 主模拟函数 ====================

/**
 * 运行真实用户流程模拟
 */
export async function runRealisticSimulation(
  persona: MockPersona,
  iteration: number,
  baseQuestions: number = 6
): Promise<RealisticSimulationResult> {
  const startTime = Date.now();
  const messages: RealisticMessage[] = [];
  let hintsUsed = 0;
  let completedSuccessfully = true;
  let dropOffPoint: string | undefined;
  
  // 根据资历级别动态调整问题数量
  const seniorityLevel = determineSeniorityLevel(persona.targetJob.position);
  let totalQuestions = baseQuestions;
  if (seniorityLevel === 'executive') {
    totalQuestions = Math.max(10, baseQuestions); // 执行级别至少 10 题
  } else if (seniorityLevel === 'senior') {
    totalQuestions = Math.max(8, baseQuestions); // 高级别至少 8 题
  }
  
  console.log(`    [Realistic] Starting simulation for ${persona.name} (${seniorityLevel}, ${totalQuestions} questions)...`);
  
  // ==================== 阶段 1: 首页 ====================
  console.log(`    [Realistic] Phase 1: Homepage...`);
  const homepage = await simulateHomepageBehavior(persona);
  
  // ==================== 阶段 2: 等待准备 ====================
  console.log(`    [Realistic] Phase 2: Preparation...`);
  const preparation = await simulatePreparationBehavior(persona);
  
  // 检查是否因等待太久而放弃
  if (preparation.userPatience === 'impatient' && preparation.waitTime > 25000) {
    if (Math.random() > 0.85) {
      completedSuccessfully = false;
      dropOffPoint = 'preparation_timeout';
      console.log(`    [Realistic] User dropped off during preparation`);
    }
  }
  
  // ==================== 阶段 3: 面试对话 ====================
  console.log(`    [Realistic] Phase 3: Interview...`);
  const { targetJob, resumeText, situation } = persona;
  
  // System message
  messages.push({
    role: 'system',
    content: `Mock interview for ${targetJob.position} at ${targetJob.company}. Resume: ${resumeText.slice(0, 200)}... Situation: ${situation}`,
    timestamp: new Date().toISOString(),
  });
  
  // 生成第一个问题
  if (completedSuccessfully) {
    try {
      const firstQuestionPrompt = `You are starting a mock interview for a ${targetJob.position} position at ${targetJob.company}.

Candidate: ${persona.background.yearsOfExperience} years as ${persona.background.currentRole}

Generate a warm, professional opening and first interview question. Make it feel natural and welcoming.`;

      const firstResponse = await invokeLLM({
        messages: [{ role: 'user', content: firstQuestionPrompt }],
      });
      
      const firstQuestion = firstResponse.choices[0]?.message?.content;
      if (firstQuestion && typeof firstQuestion === 'string') {
        messages.push({
          role: 'assistant',
          content: firstQuestion,
          timestamp: new Date().toISOString(),
          metadata: { questionType: 'opening' },
        });
      }
    } catch (error) {
      console.error('[RealisticSimulator] Error generating first question:', error);
      completedSuccessfully = false;
      dropOffPoint = 'first_question_error';
    }
  }
  
  // Q&A 循环
  let totalThinkingTime = 0;
  let totalResponseTime = 0;
  const coveredTopics: string[] = []; // 跟踪已覆盖的话题，避免重复
  
  for (let q = 1; q <= totalQuestions && completedSuccessfully; q++) {
    const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
    if (!lastAssistantMsg) break;
    
    console.log(`    [Realistic] Question ${q}/${totalQuestions}...`);
    
    // 生成用户回答（带行为模拟）
    const { 
      response: userResponse, 
      wantsHint, 
      actions,
      thinkingTime,
      typingTime,
      editCount,
    } = await generateRealisticUserResponse(
      persona,
      lastAssistantMsg.content,
      messages,
      q
    );
    
    totalThinkingTime += thinkingTime;
    totalResponseTime += thinkingTime + typingTime;
    
    // 处理提示请求
    if (wantsHint && hintsUsed < 3) {
      try {
        const hint = await generateHint({
          question: lastAssistantMsg.content,
          userResponse: '',
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          language: 'en',
        });
        
        hintsUsed++;
        messages.push({
          role: 'user',
          content: '[Requested hint]',
          timestamp: new Date().toISOString(),
          userActions: actions.filter(a => a.target === 'hint_button'),
          metadata: {
            hintRequested: true,
            hintContent: hint.hint,
          },
        });
      } catch (error) {
        console.error('[RealisticSimulator] Error getting hint:', error);
      }
    }
    
    // 添加用户回答
    messages.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date().toISOString(),
      userActions: actions,
      metadata: {
        responseQuality: userResponse.length < 100 ? 'brief' : (userResponse.length < 300 ? 'medium' : 'detailed'),
        thinkingTime,
        typingTime,
        editCount,
      },
    });
    
    // 生成下一个问题 - 使用增强模式 + 技术挑战机制
    if (q < totalQuestions) {
      try {
        // 确定资历级别和技术深度
        const seniorityLevel = determineSeniorityLevel(targetJob.position);
        const technicalDepth = determineTechnicalDepth(targetJob.position, targetJob.company);
        const skepticMode = seniorityLevel === 'senior' || seniorityLevel === 'executive';
        const useAggressiveMode = seniorityLevel === 'executive';
        
        // 获取对话节奏配置（根据挑剔度）
        const pacing = getConversationPacing(persona.personality.criticalness);
        
        // 提取技术声明用于挑战
        const technicalClaims = await extractTechnicalClaims(userResponse, lastAssistantMsg.content);
        
        const enhancedOptions: EnhancedQuestionOptions = {
          seniorityLevel,
          technicalDepth,
          skepticMode,
          narrativeArc: true,
        };
        
        let aiResponse: string;
        
        // 对于执行级别职位，使用激进面试官模式
        if (useAggressiveMode && q >= 2) {
          const aggressiveConfig: AggressiveInterviewConfig = {
            seniorityLevel: 'executive',
            minimumQuestions: totalQuestions,
            challengeIntensity: 'high',
            focusAreas: ['quantitative', 'risk', 'trade-off'],
          };
          
          // 最后一题使用战略综合问题
          if (q === totalQuestions - 1) {
            aiResponse = await generateStrategicSynthesis(
              messages.map(m => ({ role: m.role, content: m.content })),
              aggressiveConfig
            );
          } else {
            // 生成激进追问
            aiResponse = await generateAggressiveFollowUp(
              lastAssistantMsg.content,
              userResponse,
              aggressiveConfig
            );
          }
        } else if (skepticMode && q >= 2) {
          // 对于高级别职位，分析弱点并生成针对性追问
          const weakPoints = await analyzeAnswerWeakPoints(
            lastAssistantMsg.content,
            userResponse,
            seniorityLevel
          );
          
          if (weakPoints.length > 0) {
            // 生成针对弱点的追问
            const followUp = await generateWeakPointFollowUp(
              lastAssistantMsg.content,
              userResponse,
              weakPoints[0],
              enhancedOptions
            );
            
            // 生成叙事过渡
            const transition = await generateNarrativeTransition(
              lastAssistantMsg.content,
              userResponse,
              weakPoints[0],
              followUp.category
            );
            
            aiResponse = transition ? `${transition}\n\n${followUp.question}` : followUp.question;
          } else {
            // 没有明显弱点，使用上下文感知问题生成
            aiResponse = await generateContextAwareQuestionWithFallback(
              messages,
              targetJob,
              persona,
              q,
              totalQuestions,
              coveredTopics
            );
          }
        } else {
          // 标准流程 + 技术挑战机制
          // 对于高挑剔度用户，使用技术挑战机制
          if (persona.personality.criticalness >= 7 && technicalClaims.length > 0) {
            // 使用不打断的追问方式
            aiResponse = await generateNonInterruptingFollowUp(
              userResponse,
              lastAssistantMsg.content,
              technicalClaims,
              persona.personality.criticalness
            );
          } else {
            // 使用上下文感知问题生成（替代硬编码规则）
            aiResponse = await generateContextAwareQuestionWithFallback(
              messages,
              targetJob,
              persona,
              q,
              totalQuestions,
              coveredTopics
            );
            
            // 对于高挑剔度用户，替换过度赞美的语言
            if (persona.personality.criticalness >= 7) {
              for (const phrase of pacing.avoidPhrases) {
                if (aiResponse.includes(phrase)) {
                  const replacement = getNaturalTransition('acknowledge', persona.personality.criticalness);
                  aiResponse = aiResponse.replace(phrase, replacement);
                }
              }
            }
          }
        }
        
        messages.push({
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date().toISOString(),
          metadata: { 
            questionType: q === totalQuestions - 1 ? 'closing' : 'follow_up',
            seniorityLevel,
            skepticMode,
          },
        });
      } catch (error) {
        console.error('[RealisticSimulator] Error generating AI response:', error);
        completedSuccessfully = false;
        dropOffPoint = `question_${q}_error`;
      }
    } else {
      // 专业结束流程
      try {
        // 生成过渡语
        const transition = await generateClosingTransition(
          lastAssistantMsg.content,
          userResponse,
          totalQuestions
        );
        
        // 生成完整结束序列
        const closing = await generateClosingSequence(
          messages.map(m => ({ role: m.role, content: m.content })),
          targetJob.position,
          targetJob.company,
          seniorityLevel
        );
        
        // 添加过渡和候选人提问机会
        messages.push({
          role: 'assistant',
          content: `${transition}\n\n${closing.candidateQuestionsPrompt}`,
          timestamp: new Date().toISOString(),
          metadata: { questionType: 'closing_transition' },
        });
        
        // 模拟候选人提问
        const candidateQuestion = await generatePersonaQuestion(persona, targetJob, seniorityLevel);
        messages.push({
          role: 'user',
          content: candidateQuestion,
          timestamp: new Date().toISOString(),
          metadata: { questionType: 'candidate_question' },
        });
        
        // 最终结束消息（包含摘要）
        const summaryDisplay = formatSummaryForDisplay(closing.summary);
        messages.push({
          role: 'assistant',
          content: `${closing.finalMessage}\n\n---\n\n${summaryDisplay}`,
          timestamp: new Date().toISOString(),
          metadata: { 
            questionType: 'closing_final',
            summary: closing.summary,
          },
        });
      } catch (error) {
        console.error('[RealisticSimulator] Error generating closing:', error);
        messages.push({
          role: 'assistant',
          content: `Thank you for this engaging conversation. We've covered a lot of ground today, and I appreciate your thoughtful responses. Our team will be in touch with next steps.`,
          timestamp: new Date().toISOString(),
          metadata: { questionType: 'closing' },
        });
      }
    }
    
    // 小延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // ==================== 阶段 4: 评估报告 ====================
  console.log(`    [Realistic] Phase 4: Assessment...`);
  const assessment = await simulateAssessmentBehavior(persona);
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  const averageResponseTime = totalResponseTime / totalQuestions;
  const averageThinkingTime = totalThinkingTime / totalQuestions;
  
  const simulation: RealisticSimulationResult = {
    id: `realistic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    personaId: persona.id,
    personaName: persona.name,
    targetJob,
    journey: {
      homepage,
      preparation,
      interview: {
        messages,
        hintsUsed,
        totalQuestions,
        averageResponseTime,
        averageThinkingTime,
      },
      assessment,
    },
    totalDuration,
    completedSuccessfully,
    dropOffPoint,
    createdAt: new Date().toISOString(),
    iteration,
  };
  
  // 保存模拟结果
  saveRealisticSimulation(simulation);
  
  console.log(`    [Realistic] Completed in ${totalDuration}s, hints: ${hintsUsed}, success: ${completedSuccessfully}`);
  
  return simulation;
}

/**
 * 从真实模拟结果生成标准 SimulationResult（用于兼容现有反馈生成器）
 */
/**
 * 上下文感知问题生成器（带 fallback）
 * 
 * 解决 Bug B1-B3:
 * - B1: 问题重复 - 通过 coveredTopics 跟踪已覆盖话题
 * - B2: 职位不匹配 - 通过 LLM 动态判断相关性，而不是硬编码规则
 * - B3: 话题循环 - 通过 shouldSwitchTopic 动态决策
 */
async function generateContextAwareQuestionWithFallback(
  messages: RealisticMessage[],
  targetJob: { company: string; position: string },
  persona: MockPersona,
  currentQuestion: number,
  totalQuestions: number,
  coveredTopics: string[]
): Promise<string> {
  try {
    // 检查是否应该切换话题（基于信号，而不是硬编码规则）
    const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
    const currentTopic = coveredTopics.length > 0 ? coveredTopics[coveredTopics.length - 1] : 'general';
    const switchDecision = await shouldSwitchTopic(conversationHistory, currentTopic);
    
    // 生成上下文感知问题
    const result = await generateContextAwareQuestion(
      conversationHistory,
      {
        position: targetJob.position,
        company: targetJob.company,
        background: `${persona.background.yearsOfExperience} years as ${persona.background.currentRole}`,
      },
      {
        currentQuestion,
        totalQuestions,
        coveredTopics,
      }
    );
    
    // 更新已覆盖话题
    if (result.topic && !coveredTopics.includes(result.topic)) {
      coveredTopics.push(result.topic);
    }
    
    return result.question;
  } catch (error) {
    console.error('[RealisticSimulator] Context-aware question generation failed:', error);
    
    // Fallback: 使用原有的 generateInterviewResponse
    const fallbackResponse = await generateInterviewResponse({
      job: {
        company: targetJob.company,
        position: targetJob.position,
        description: `${targetJob.position} role at ${targetJob.company}`,
      },
      conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
      currentQuestion,
      totalQuestions,
      language: 'en',
      userResponse: messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '',
    });
    
    return fallbackResponse;
  }
}

export function toStandardSimulation(realistic: RealisticSimulationResult): {
  id: string;
  personaId: string;
  personaName: string;
  targetJob: { company: string; position: string };
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: string; metadata?: Record<string, unknown> }>;
  hintsUsed: number;
  totalQuestions: number;
  completedSuccessfully: boolean;
  duration: number;
  createdAt: string;
  iteration: number;
} {
  return {
    id: realistic.id,
    personaId: realistic.personaId,
    personaName: realistic.personaName,
    targetJob: realistic.targetJob,
    messages: realistic.journey.interview.messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: m.timestamp,
      metadata: m.metadata as Record<string, unknown>,
    })),
    hintsUsed: realistic.journey.interview.hintsUsed,
    totalQuestions: realistic.journey.interview.totalQuestions,
    completedSuccessfully: realistic.completedSuccessfully,
    duration: realistic.totalDuration,
    createdAt: realistic.createdAt,
    iteration: realistic.iteration,
  };
}
