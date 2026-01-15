/**
 * Feedback Generator for Agent Loop
 * 
 * Generates comprehensive feedback reports from the perspective of mock personas.
 * Feedback is used to optimize prompts and improve the interview system.
 */

import { invokeLLM } from '../../_core/llm';
import { MockPersona } from './personaGenerator';
import { SimulationResult } from './interviewSimulator';
import * as fs from 'fs';
import * as path from 'path';

export interface ModuleFeedback {
  module: 'question_generation' | 'hint_system' | 'response_analysis' | 'overall_flow' | 'persona_simulation';
  rating: number; // 1-10
  strengths: string[];
  weaknesses: string[];
  specificIssues: string[];
  suggestions: string[];
}

export interface FeedbackReport {
  id: string;
  personaId: string;
  personaName: string;
  simulationId: string;
  iteration: number;
  
  // Overall assessment
  overallSatisfaction: number; // 1-10
  wouldRecommend: boolean;
  
  // Detailed feedback by module
  moduleFeedback: ModuleFeedback[];
  
  // Persona's subjective experience
  emotionalJourney: string;
  frustratingMoments: string[];
  positiveHighlights: string[];
  
  // Prioritized suggestions
  prioritizedSuggestions: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    suggestion: string;
    affectedModule: string;
    expectedImpact: string;
  }>;
  
  // Raw feedback text
  rawFeedback: string;
  
  createdAt: string;
}

const FEEDBACK_DIR = '/home/ubuntu/UHWeb/data/feedback';

/**
 * Ensure feedback directory exists
 */
function ensureFeedbackDir(): void {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

/**
 * Save feedback report to disk
 */
export function saveFeedback(feedback: FeedbackReport): void {
  ensureFeedbackDir();
  const filePath = path.join(FEEDBACK_DIR, `${feedback.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(feedback, null, 2));
}

/**
 * Generate comprehensive feedback from persona's perspective
 */
export async function generateFeedback(
  persona: MockPersona,
  simulation: SimulationResult
): Promise<FeedbackReport> {
  const { personality, feedbackStyle } = persona;
  
  // Build conversation summary
  const conversationSummary = simulation.messages
    .filter(m => m.role !== 'system')
    .map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
    .join('\n\n');
  
  const prompt = `You are ${persona.name}, a job candidate who just completed a mock interview. Generate a detailed feedback report.

YOUR PERSONA:
- Background: ${persona.background.yearsOfExperience} years as ${persona.background.currentRole}
- Criticalness level: ${personality.criticalness}/10 (${personality.criticalness >= 7 ? 'very demanding' : personality.criticalness >= 4 ? 'moderately critical' : 'easy-going'})
- Patience level: ${personality.patience}/10
- Feedback style: ${feedbackStyle}

INTERVIEW SUMMARY:
- Target: ${simulation.targetJob.position} at ${simulation.targetJob.company}
- Total questions: ${simulation.totalQuestions}
- Hints used: ${simulation.hintsUsed}
- Completed: ${simulation.completedSuccessfully ? 'Yes' : 'No'}
- Duration: ${simulation.duration} seconds

CONVERSATION:
${conversationSummary}

Generate a comprehensive feedback report as this persona would give it. Be ${personality.criticalness >= 7 ? 'very critical and demanding' : personality.criticalness >= 4 ? 'balanced but thorough' : 'generally positive but honest'}.

Return JSON:
{
  "overallSatisfaction": number (1-10),
  "wouldRecommend": boolean,
  "moduleFeedback": [
    {
      "module": "question_generation|hint_system|response_analysis|overall_flow|persona_simulation",
      "rating": number (1-10),
      "strengths": ["..."],
      "weaknesses": ["..."],
      "specificIssues": ["..."],
      "suggestions": ["..."]
    }
  ],
  "emotionalJourney": "Describe how you felt throughout the interview",
  "frustratingMoments": ["Specific moments that were frustrating"],
  "positiveHighlights": ["Specific moments that were good"],
  "prioritizedSuggestions": [
    {
      "priority": "critical|high|medium|low",
      "suggestion": "...",
      "affectedModule": "...",
      "expectedImpact": "..."
    }
  ],
  "rawFeedback": "Your overall thoughts in 2-3 paragraphs"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'feedback_report',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              overallSatisfaction: { type: 'number' },
              wouldRecommend: { type: 'boolean' },
              moduleFeedback: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    module: { type: 'string', enum: ['question_generation', 'hint_system', 'response_analysis', 'overall_flow', 'persona_simulation'] },
                    rating: { type: 'number' },
                    strengths: { type: 'array', items: { type: 'string' } },
                    weaknesses: { type: 'array', items: { type: 'string' } },
                    specificIssues: { type: 'array', items: { type: 'string' } },
                    suggestions: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['module', 'rating', 'strengths', 'weaknesses', 'specificIssues', 'suggestions'],
                  additionalProperties: false,
                },
              },
              emotionalJourney: { type: 'string' },
              frustratingMoments: { type: 'array', items: { type: 'string' } },
              positiveHighlights: { type: 'array', items: { type: 'string' } },
              prioritizedSuggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                    suggestion: { type: 'string' },
                    affectedModule: { type: 'string' },
                    expectedImpact: { type: 'string' },
                  },
                  required: ['priority', 'suggestion', 'affectedModule', 'expectedImpact'],
                  additionalProperties: false,
                },
              },
              rawFeedback: { type: 'string' },
            },
            required: ['overallSatisfaction', 'wouldRecommend', 'moduleFeedback', 'emotionalJourney', 'frustratingMoments', 'positiveHighlights', 'prioritizedSuggestions', 'rawFeedback'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const feedbackData = JSON.parse(content);
      
      const feedback: FeedbackReport = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        personaId: persona.id,
        personaName: persona.name,
        simulationId: simulation.id,
        iteration: simulation.iteration,
        ...feedbackData,
        createdAt: new Date().toISOString(),
      };
      
      // Save feedback
      saveFeedback(feedback);
      
      return feedback;
    }
  } catch (error) {
    console.error('[FeedbackGenerator] Error generating feedback:', error);
  }

  // Return minimal feedback on error
  const fallbackFeedback: FeedbackReport = {
    id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    personaId: persona.id,
    personaName: persona.name,
    simulationId: simulation.id,
    iteration: simulation.iteration,
    overallSatisfaction: 5,
    wouldRecommend: true,
    moduleFeedback: [],
    emotionalJourney: 'Unable to generate detailed feedback',
    frustratingMoments: [],
    positiveHighlights: [],
    prioritizedSuggestions: [],
    rawFeedback: 'Feedback generation failed',
    createdAt: new Date().toISOString(),
  };
  
  saveFeedback(fallbackFeedback);
  return fallbackFeedback;
}

/**
 * Load feedback reports from disk
 */
export function loadFeedback(iteration?: number): FeedbackReport[] {
  ensureFeedbackDir();
  const reports: FeedbackReport[] = [];
  
  try {
    const files = fs.readdirSync(FEEDBACK_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(FEEDBACK_DIR, file), 'utf-8');
        const report = JSON.parse(content);
        if (iteration === undefined || report.iteration === iteration) {
          reports.push(report);
        }
      }
    }
  } catch (error) {
    console.error('[FeedbackGenerator] Error loading feedback:', error);
  }
  
  return reports;
}

/**
 * Aggregate feedback from multiple reports
 */
export function aggregateFeedback(reports: FeedbackReport[]): {
  averageSatisfaction: number;
  recommendationRate: number;
  moduleRatings: Record<string, number>;
  topIssues: string[];
  topSuggestions: string[];
} {
  if (reports.length === 0) {
    return {
      averageSatisfaction: 0,
      recommendationRate: 0,
      moduleRatings: {},
      topIssues: [],
      topSuggestions: [],
    };
  }
  
  // Calculate averages
  const avgSatisfaction = reports.reduce((sum, r) => sum + r.overallSatisfaction, 0) / reports.length;
  const recRate = reports.filter(r => r.wouldRecommend).length / reports.length;
  
  // Aggregate module ratings
  const moduleRatings: Record<string, number[]> = {};
  for (const report of reports) {
    for (const mf of report.moduleFeedback) {
      if (!moduleRatings[mf.module]) {
        moduleRatings[mf.module] = [];
      }
      moduleRatings[mf.module].push(mf.rating);
    }
  }
  
  const avgModuleRatings: Record<string, number> = {};
  for (const [module, ratings] of Object.entries(moduleRatings)) {
    avgModuleRatings[module] = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }
  
  // Collect all issues and suggestions
  const allIssues: string[] = [];
  const allSuggestions: Array<{ priority: string; suggestion: string }> = [];
  
  for (const report of reports) {
    for (const mf of report.moduleFeedback) {
      allIssues.push(...mf.specificIssues);
    }
    allSuggestions.push(...report.prioritizedSuggestions);
  }
  
  // Get top issues (most mentioned)
  const issueCounts = new Map<string, number>();
  for (const issue of allIssues) {
    const normalized = issue.toLowerCase().trim();
    issueCounts.set(normalized, (issueCounts.get(normalized) || 0) + 1);
  }
  const topIssues = Array.from(issueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);
  
  // Get top suggestions (prioritized)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const topSuggestions = allSuggestions
    .sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder])
    .slice(0, 5)
    .map(s => s.suggestion);
  
  return {
    averageSatisfaction: Math.round(avgSatisfaction * 10) / 10,
    recommendationRate: Math.round(recRate * 100),
    moduleRatings: avgModuleRatings,
    topIssues,
    topSuggestions,
  };
}
