/**
 * Enhanced Question Generator
 * 
 * Addresses feedback from high-criticalness users:
 * 1. Adds technical depth for senior roles
 * 2. Implements "Skeptic Mode" for challenging assumptions
 * 3. Creates cohesive narrative arcs
 * 4. Generates contextually relevant transitions
 */

import { invokeLLM } from '../_core/llm';
import type { GeneratedQuestion, UserProfile, InterviewPlan } from './interviewGenerator';

export interface EnhancedQuestionOptions {
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'executive';
  technicalDepth: 'shallow' | 'moderate' | 'deep' | 'expert';
  skepticMode: boolean;
  narrativeArc: boolean;
  previousAnswers?: Array<{
    question: string;
    answer: string;
    weakPoints?: string[];
  }>;
}

export interface SkepticChallenge {
  type: 'validity' | 'scale' | 'context' | 'mechanism' | 'trade-off';
  challenge: string;
  expectedDepth: string;
}

export interface EnhancedQuestion extends GeneratedQuestion {
  skepticChallenges?: SkepticChallenge[];
  technicalDrillDowns?: string[];
  narrativeTransition?: string;
  weakPointTarget?: string;
}

/**
 * Determine seniority level from job title
 * 
 * 注意：我们的目标用户是 30 岁以下的求职者，不包括 VP/Director/C-level
 * 因此 'executive' 级别在此场景下不应该出现，但保留以便向后兼容
 */
export function determineSeniorityLevel(position: string): EnhancedQuestionOptions['seniorityLevel'] {
  const positionLower = position.toLowerCase();
  
  // 目标用户约束：这些职位不应该出现在我们的目标用户中
  // 如果出现，降级为 'senior' 而不是 'executive'
  const executiveKeywords = ['vp', 'vice president', 'cto', 'cio', 'ceo', 'chief', 'director', 'head of', 'principal', 'distinguished', 'fellow'];
  const seniorKeywords = ['senior', 'staff', 'lead', 'architect', 'manager'];
  const midKeywords = ['mid', 'ii', 'iii', 'level 2', 'level 3'];
  
  // 对于目标用户，将 executive 降级为 senior
  // 因为我们的目标用户是 30 岁以下的求职者
  if (executiveKeywords.some(k => positionLower.includes(k))) {
    // 返回 'senior' 而不是 'executive'，因为我们的目标用户不包括高管
    return 'senior';
  }
  if (seniorKeywords.some(k => positionLower.includes(k))) {
    return 'senior';
  }
  if (midKeywords.some(k => positionLower.includes(k))) {
    return 'mid';
  }
  return 'junior';
}

/**
 * Determine technical depth based on role and company
 */
export function determineTechnicalDepth(
  position: string, 
  company: string
): EnhancedQuestionOptions['technicalDepth'] {
  const seniorityLevel = determineSeniorityLevel(position);
  const positionLower = position.toLowerCase();
  
  // Tech companies require deeper technical depth
  const techCompanies = ['google', 'meta', 'amazon', 'apple', 'microsoft', 'netflix', 'stripe', 'openai', 'anthropic'];
  const isTechCompany = techCompanies.some(c => company.toLowerCase().includes(c));
  
  // Technical roles require deeper depth
  const technicalRoles = ['engineer', 'developer', 'architect', 'scientist', 'researcher', 'ml', 'ai', 'data'];
  const isTechnicalRole = technicalRoles.some(r => positionLower.includes(r));
  
  if (seniorityLevel === 'executive') {
    return isTechnicalRole ? 'expert' : 'deep';
  }
  if (seniorityLevel === 'senior') {
    return isTechCompany || isTechnicalRole ? 'deep' : 'moderate';
  }
  if (seniorityLevel === 'mid') {
    return isTechnicalRole ? 'moderate' : 'shallow';
  }
  return 'shallow';
}

/**
 * Generate skeptic challenges for a question
 */
export async function generateSkepticChallenges(
  question: string,
  previousAnswer?: string,
  options?: EnhancedQuestionOptions
): Promise<SkepticChallenge[]> {
  if (!options?.skepticMode) {
    return [];
  }
  
  const prompt = `You are a highly skeptical interviewer. Generate challenges for this interview question/answer.

QUESTION: ${question}
${previousAnswer ? `CANDIDATE'S ANSWER: ${previousAnswer}` : ''}

Generate 2-3 skeptic challenges that:
1. Question the validity of claims or metrics
2. Challenge the scale or context of achievements
3. Demand the underlying mechanism or implementation details
4. Explore trade-offs and alternatives not mentioned

Return JSON:
{
  "challenges": [
    {
      "type": "validity|scale|context|mechanism|trade-off",
      "challenge": "The specific challenge question",
      "expectedDepth": "What kind of detailed answer we expect"
    }
  ]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'skeptic_challenges',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              challenges: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['validity', 'scale', 'context', 'mechanism', 'trade-off'] },
                    challenge: { type: 'string' },
                    expectedDepth: { type: 'string' },
                  },
                  required: ['type', 'challenge', 'expectedDepth'],
                  additionalProperties: false,
                },
              },
            },
            required: ['challenges'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      return data.challenges;
    }
  } catch (error) {
    console.error('[EnhancedQuestionGenerator] Error generating skeptic challenges:', error);
  }
  
  return [];
}

/**
 * Generate technical drill-down questions based on seniority
 */
export async function generateTechnicalDrillDowns(
  topic: string,
  technicalDepth: EnhancedQuestionOptions['technicalDepth'],
  domain?: string
): Promise<string[]> {
  const depthInstructions: Record<string, string> = {
    shallow: 'Basic understanding, definitions, simple use cases',
    moderate: 'Implementation details, common patterns, trade-offs',
    deep: 'Architecture decisions, scaling considerations, edge cases, performance optimization',
    expert: 'System design at scale, novel approaches, industry-leading practices, research-level insights',
  };

  const prompt = `Generate technical drill-down questions for this topic.

TOPIC: ${topic}
${domain ? `DOMAIN: ${domain}` : ''}
DEPTH LEVEL: ${technicalDepth}
DEPTH EXPECTATIONS: ${depthInstructions[technicalDepth]}

Generate 3-4 increasingly deep technical questions that:
1. Start from the stated depth level
2. Progressively challenge the candidate's expertise
3. Include specific technical terminology and concepts
4. Require concrete examples or implementation details

Return JSON:
{
  "drillDowns": ["question1", "question2", "question3", "question4"]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'drill_downs',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              drillDowns: { type: 'array', items: { type: 'string' } },
            },
            required: ['drillDowns'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      return data.drillDowns;
    }
  } catch (error) {
    console.error('[EnhancedQuestionGenerator] Error generating drill-downs:', error);
  }
  
  return [];
}

/**
 * Analyze previous answer for weak points
 */
export async function analyzeAnswerWeakPoints(
  question: string,
  answer: string,
  seniorityLevel: EnhancedQuestionOptions['seniorityLevel']
): Promise<string[]> {
  const seniorityExpectations: Record<string, string> = {
    junior: 'Basic understanding, willingness to learn, foundational knowledge',
    mid: 'Solid implementation skills, some design thinking, clear communication',
    senior: 'Deep technical expertise, leadership examples, system-level thinking',
    executive: 'Strategic vision, organizational impact, industry-level insights, quantifiable results at scale',
  };

  const prompt = `Analyze this interview answer for weak points that should be challenged.

QUESTION: ${question}
ANSWER: ${answer}
SENIORITY LEVEL: ${seniorityLevel}
EXPECTATIONS: ${seniorityExpectations[seniorityLevel]}

Identify 2-3 weak points where the answer:
1. Lacks specificity or concrete details
2. Makes claims without supporting evidence
3. Misses important considerations for this seniority level
4. Uses generic language instead of precise terminology
5. Avoids discussing trade-offs or alternatives

Return JSON:
{
  "weakPoints": ["weak point 1", "weak point 2", "weak point 3"]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'weak_points',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              weakPoints: { type: 'array', items: { type: 'string' } },
            },
            required: ['weakPoints'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      return data.weakPoints;
    }
  } catch (error) {
    console.error('[EnhancedQuestionGenerator] Error analyzing weak points:', error);
  }
  
  return [];
}

/**
 * Generate narrative transition based on previous answer's weak point
 */
export async function generateNarrativeTransition(
  previousQuestion: string,
  previousAnswer: string,
  weakPoint: string,
  nextTopic: string
): Promise<string> {
  const prompt = `Generate a natural, challenging transition from one interview question to the next.

PREVIOUS QUESTION: ${previousQuestion}
CANDIDATE'S ANSWER: ${previousAnswer}
IDENTIFIED WEAK POINT: ${weakPoint}
NEXT TOPIC: ${nextTopic}

Generate a transition that:
1. Acknowledges a specific detail from the candidate's answer (NOT generic praise)
2. Subtly challenges or questions the weak point identified
3. Naturally leads into the next topic
4. Maintains professional but skeptical tone
5. Does NOT use generic phrases like "That's a great answer" or "Building on that"

Return JSON:
{
  "transition": "The transition text"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'transition',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              transition: { type: 'string' },
            },
            required: ['transition'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      return data.transition;
    }
  } catch (error) {
    console.error('[EnhancedQuestionGenerator] Error generating transition:', error);
  }
  
  return '';
}

/**
 * Enhance a basic question with skeptic mode and technical depth
 */
export async function enhanceQuestion(
  baseQuestion: GeneratedQuestion,
  options: EnhancedQuestionOptions,
  context?: {
    company?: string;
    position?: string;
    previousAnswer?: string;
    previousQuestion?: string;
    weakPoint?: string;
  }
): Promise<EnhancedQuestion> {
  const enhanced: EnhancedQuestion = { ...baseQuestion };
  
  // Generate skeptic challenges if enabled
  if (options.skepticMode) {
    enhanced.skepticChallenges = await generateSkepticChallenges(
      baseQuestion.question,
      context?.previousAnswer,
      options
    );
  }
  
  // Generate technical drill-downs for technical questions
  if (baseQuestion.type === 'technical' && options.technicalDepth !== 'shallow') {
    enhanced.technicalDrillDowns = await generateTechnicalDrillDowns(
      baseQuestion.category,
      options.technicalDepth,
      context?.position
    );
  }
  
  // Generate narrative transition if we have context
  if (options.narrativeArc && context?.previousAnswer && context?.weakPoint) {
    enhanced.narrativeTransition = await generateNarrativeTransition(
      context.previousQuestion || '',
      context.previousAnswer,
      context.weakPoint,
      baseQuestion.category
    );
    enhanced.weakPointTarget = context.weakPoint;
  }
  
  return enhanced;
}

/**
 * Create an enhanced interview plan with skeptic mode and technical depth
 */
export async function createEnhancedInterviewPlan(
  basePlan: InterviewPlan,
  userProfile?: UserProfile
): Promise<InterviewPlan & { enhancedQuestions: EnhancedQuestion[] }> {
  const seniorityLevel = determineSeniorityLevel(basePlan.position);
  const technicalDepth = determineTechnicalDepth(basePlan.position, basePlan.company);
  
  // Enable skeptic mode for senior+ roles
  const skepticMode = seniorityLevel === 'senior' || seniorityLevel === 'executive';
  
  // Enable narrative arc for all interviews
  const narrativeArc = true;
  
  const options: EnhancedQuestionOptions = {
    seniorityLevel,
    technicalDepth,
    skepticMode,
    narrativeArc,
  };
  
  console.log(`[EnhancedQuestionGenerator] Creating enhanced plan:`, {
    position: basePlan.position,
    seniorityLevel,
    technicalDepth,
    skepticMode,
  });
  
  // Enhance each question
  const enhancedQuestions: EnhancedQuestion[] = [];
  for (const question of basePlan.questions) {
    const enhanced = await enhanceQuestion(question, options, {
      company: basePlan.company,
      position: basePlan.position,
    });
    enhancedQuestions.push(enhanced);
  }
  
  return {
    ...basePlan,
    enhancedQuestions,
  };
}

/**
 * Generate a follow-up question targeting a weak point
 */
export async function generateWeakPointFollowUp(
  previousQuestion: string,
  previousAnswer: string,
  weakPoint: string,
  options: EnhancedQuestionOptions
): Promise<EnhancedQuestion> {
  const prompt = `Generate a follow-up interview question that directly challenges a weak point in the candidate's answer.

PREVIOUS QUESTION: ${previousQuestion}
CANDIDATE'S ANSWER: ${previousAnswer}
WEAK POINT TO TARGET: ${weakPoint}
SENIORITY LEVEL: ${options.seniorityLevel}
TECHNICAL DEPTH: ${options.technicalDepth}

Generate a follow-up question that:
1. Directly addresses the identified weak point
2. Demands specific evidence, metrics, or implementation details
3. Cannot be answered with generic statements
4. Is appropriate for the seniority level
5. Maintains a professional but challenging tone

Return JSON:
{
  "question": "The follow-up question",
  "type": "technical|behavioral|case",
  "category": "The topic category",
  "difficulty": "Easy|Medium|Hard",
  "expectedAnswer": "What a strong answer would include"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'follow_up',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              type: { type: 'string', enum: ['technical', 'behavioral', 'case'] },
              category: { type: 'string' },
              difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
              expectedAnswer: { type: 'string' },
            },
            required: ['question', 'type', 'category', 'difficulty', 'expectedAnswer'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      
      const enhanced: EnhancedQuestion = {
        question: data.question,
        type: data.type,
        category: data.category,
        difficulty: data.difficulty,
        source: 'generated',
        weakPointTarget: weakPoint,
      };
      
      // Add skeptic challenges if enabled
      if (options.skepticMode) {
        enhanced.skepticChallenges = await generateSkepticChallenges(
          data.question,
          undefined,
          options
        );
      }
      
      return enhanced;
    }
  } catch (error) {
    console.error('[EnhancedQuestionGenerator] Error generating follow-up:', error);
  }
  
  // Fallback
  return {
    question: `Can you elaborate more specifically on ${weakPoint}?`,
    type: 'behavioral',
    category: 'Follow-up',
    difficulty: 'Medium',
    source: 'generated',
    weakPointTarget: weakPoint,
  };
}

export default {
  determineSeniorityLevel,
  determineTechnicalDepth,
  generateSkepticChallenges,
  generateTechnicalDrillDowns,
  analyzeAnswerWeakPoints,
  generateNarrativeTransition,
  enhanceQuestion,
  createEnhancedInterviewPlan,
  generateWeakPointFollowUp,
};
