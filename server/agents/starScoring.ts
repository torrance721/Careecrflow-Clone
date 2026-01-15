/**
 * STAR Structure Scoring System
 * 
 * Evaluates interview responses against the STAR framework:
 * - Situation: Context and background
 * - Task: Specific responsibility or challenge
 * - Action: Steps taken by the candidate
 * - Result: Outcomes and impact
 * 
 * Also supports SOAR variant (Situation, Obstacle, Action, Result)
 */

import { invokeLLM } from '../_core/llm';

export interface STARScore {
  overall: number; // 0-10
  situation: {
    score: number; // 0-10
    present: boolean;
    quality: 'missing' | 'weak' | 'adequate' | 'strong' | 'excellent';
    feedback: string;
  };
  task: {
    score: number;
    present: boolean;
    quality: 'missing' | 'weak' | 'adequate' | 'strong' | 'excellent';
    feedback: string;
  };
  action: {
    score: number;
    present: boolean;
    quality: 'missing' | 'weak' | 'adequate' | 'strong' | 'excellent';
    specificity: 'vague' | 'general' | 'specific' | 'detailed';
    feedback: string;
  };
  result: {
    score: number;
    present: boolean;
    quality: 'missing' | 'weak' | 'adequate' | 'strong' | 'excellent';
    quantified: boolean;
    feedback: string;
  };
  suggestions: string[];
  structureAdherence: number; // 0-100%
}

export interface STARAnalysis {
  score: STARScore;
  summary: string;
  improvementAreas: string[];
  strengthAreas: string[];
}

/**
 * Analyze a response for STAR structure adherence
 */
export async function analyzeSTARStructure(
  question: string,
  response: string,
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'executive'
): Promise<STARAnalysis> {
  const prompt = `Analyze this interview response for STAR (Situation, Task, Action, Result) structure adherence.

QUESTION: "${question}"
RESPONSE: "${response}"
SENIORITY LEVEL: ${seniorityLevel}

Evaluate each STAR component:
1. SITUATION: Did they set the context? Is it specific enough for the seniority level?
2. TASK: Did they clearly define their responsibility? Is it appropriately scoped?
3. ACTION: Did they describe specific steps THEY took (not the team)? Are actions detailed?
4. RESULT: Did they provide outcomes? Are results quantified with metrics?

For ${seniorityLevel} level, expectations are:
${seniorityLevel === 'executive' ? '- Must include strategic context, cross-functional impact, and business metrics (revenue, cost, market share)' : ''}
${seniorityLevel === 'senior' ? '- Should include team leadership context, technical depth, and measurable outcomes' : ''}
${seniorityLevel === 'mid' ? '- Should include clear ownership, specific contributions, and concrete results' : ''}
${seniorityLevel === 'junior' ? '- Should include learning context, individual contributions, and growth indicators' : ''}

Return JSON:
{
  "situation": {
    "score": 0-10,
    "present": true/false,
    "quality": "missing|weak|adequate|strong|excellent",
    "feedback": "Specific feedback"
  },
  "task": {
    "score": 0-10,
    "present": true/false,
    "quality": "missing|weak|adequate|strong|excellent",
    "feedback": "Specific feedback"
  },
  "action": {
    "score": 0-10,
    "present": true/false,
    "quality": "missing|weak|adequate|strong|excellent",
    "specificity": "vague|general|specific|detailed",
    "feedback": "Specific feedback"
  },
  "result": {
    "score": 0-10,
    "present": true/false,
    "quality": "missing|weak|adequate|strong|excellent",
    "quantified": true/false,
    "feedback": "Specific feedback"
  },
  "suggestions": ["Improvement suggestion 1", "Improvement suggestion 2"],
  "summary": "Overall assessment",
  "strengthAreas": ["Strength 1"],
  "improvementAreas": ["Area to improve 1"]
}`;

  try {
    const llmResponse = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'star_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              situation: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  present: { type: 'boolean' },
                  quality: { type: 'string', enum: ['missing', 'weak', 'adequate', 'strong', 'excellent'] },
                  feedback: { type: 'string' },
                },
                required: ['score', 'present', 'quality', 'feedback'],
                additionalProperties: false,
              },
              task: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  present: { type: 'boolean' },
                  quality: { type: 'string', enum: ['missing', 'weak', 'adequate', 'strong', 'excellent'] },
                  feedback: { type: 'string' },
                },
                required: ['score', 'present', 'quality', 'feedback'],
                additionalProperties: false,
              },
              action: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  present: { type: 'boolean' },
                  quality: { type: 'string', enum: ['missing', 'weak', 'adequate', 'strong', 'excellent'] },
                  specificity: { type: 'string', enum: ['vague', 'general', 'specific', 'detailed'] },
                  feedback: { type: 'string' },
                },
                required: ['score', 'present', 'quality', 'specificity', 'feedback'],
                additionalProperties: false,
              },
              result: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  present: { type: 'boolean' },
                  quality: { type: 'string', enum: ['missing', 'weak', 'adequate', 'strong', 'excellent'] },
                  quantified: { type: 'boolean' },
                  feedback: { type: 'string' },
                },
                required: ['score', 'present', 'quality', 'quantified', 'feedback'],
                additionalProperties: false,
              },
              suggestions: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
              strengthAreas: { type: 'array', items: { type: 'string' } },
              improvementAreas: { type: 'array', items: { type: 'string' } },
            },
            required: ['situation', 'task', 'action', 'result', 'suggestions', 'summary', 'strengthAreas', 'improvementAreas'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmResponse.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      
      // Calculate overall score and structure adherence
      const componentScores = [
        data.situation.score,
        data.task.score,
        data.action.score,
        data.result.score,
      ];
      const overall = componentScores.reduce((a, b) => a + b, 0) / 4;
      
      const componentsPresent = [
        data.situation.present,
        data.task.present,
        data.action.present,
        data.result.present,
      ].filter(Boolean).length;
      const structureAdherence = (componentsPresent / 4) * 100;
      
      return {
        score: {
          overall,
          situation: data.situation,
          task: data.task,
          action: data.action,
          result: data.result,
          suggestions: data.suggestions,
          structureAdherence,
        },
        summary: data.summary,
        improvementAreas: data.improvementAreas,
        strengthAreas: data.strengthAreas,
      };
    }
  } catch (error) {
    console.error('[STARScoring] Error analyzing STAR structure:', error);
  }

  // Return default low scores if analysis fails
  return {
    score: {
      overall: 3,
      situation: { score: 3, present: false, quality: 'weak', feedback: 'Unable to analyze' },
      task: { score: 3, present: false, quality: 'weak', feedback: 'Unable to analyze' },
      action: { score: 3, present: false, quality: 'weak', specificity: 'vague', feedback: 'Unable to analyze' },
      result: { score: 3, present: false, quality: 'weak', quantified: false, feedback: 'Unable to analyze' },
      suggestions: ['Provide more structured responses'],
      structureAdherence: 25,
    },
    summary: 'Unable to fully analyze response structure',
    improvementAreas: ['Response structure'],
    strengthAreas: [],
  };
}

/**
 * Generate STAR-focused coaching feedback
 */
export async function generateSTARCoaching(
  analysis: STARAnalysis,
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'executive'
): Promise<string> {
  const { score } = analysis;
  
  const weakComponents: string[] = [];
  if (score.situation.score < 6) weakComponents.push('Situation');
  if (score.task.score < 6) weakComponents.push('Task');
  if (score.action.score < 6) weakComponents.push('Action');
  if (score.result.score < 6) weakComponents.push('Result');
  
  if (weakComponents.length === 0) {
    return `Excellent STAR structure! Your response clearly covered all components with ${score.structureAdherence}% adherence.`;
  }
  
  const coaching = `Your response could be strengthened in the ${weakComponents.join(', ')} component${weakComponents.length > 1 ? 's' : ''}. `;
  
  const tips: string[] = [];
  if (weakComponents.includes('Situation')) {
    tips.push('Start with specific context: when, where, what was the challenge');
  }
  if (weakComponents.includes('Task')) {
    tips.push('Clearly define YOUR specific responsibility or goal');
  }
  if (weakComponents.includes('Action')) {
    tips.push('Focus on specific steps YOU took, not what "we" did');
  }
  if (weakComponents.includes('Result')) {
    tips.push('Quantify outcomes with metrics: percentages, dollars, time saved');
  }
  
  return coaching + tips.join('. ') + '.';
}

/**
 * Create a visual STAR score display for the UI
 */
export function formatSTARScoreForDisplay(score: STARScore): string {
  const getEmoji = (s: number) => {
    if (s >= 8) return '🟢';
    if (s >= 6) return '🟡';
    if (s >= 4) return '🟠';
    return '🔴';
  };
  
  return `
STAR Structure Score: ${score.overall.toFixed(1)}/10 (${score.structureAdherence}% adherence)

${getEmoji(score.situation.score)} Situation: ${score.situation.score}/10 - ${score.situation.quality}
${getEmoji(score.task.score)} Task: ${score.task.score}/10 - ${score.task.quality}
${getEmoji(score.action.score)} Action: ${score.action.score}/10 - ${score.action.quality} (${score.action.specificity})
${getEmoji(score.result.score)} Result: ${score.result.score}/10 - ${score.result.quality}${score.result.quantified ? ' ✓ Quantified' : ' ✗ Not quantified'}
`.trim();
}

/**
 * Determine if the response needs STAR coaching
 */
export function needsSTARCoaching(score: STARScore): boolean {
  return score.overall < 7 || score.structureAdherence < 75;
}

export default {
  analyzeSTARStructure,
  generateSTARCoaching,
  formatSTARScoreForDisplay,
  needsSTARCoaching,
};
