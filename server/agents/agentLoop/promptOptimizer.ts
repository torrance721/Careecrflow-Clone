/**
 * Prompt Optimizer for Agent Loop
 * 
 * Analyzes feedback and optimizes prompts used in the interview system.
 * Stores prompts as versioned files for tracking and rollback.
 */

import { invokeLLM } from '../../_core/llm';
import { FeedbackReport, aggregateFeedback } from './feedbackGenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface PromptVersion {
  id: string;
  module: string;
  version: number;
  prompt: string;
  changelog: string;
  metrics: {
    avgSatisfaction?: number;
    moduleRating?: number;
  };
  createdAt: string;
  iteration: number;
}

export interface OptimizationResult {
  iteration: number;
  promptUpdates: PromptVersion[];
  personaGeneratorUpdate: string;
  summary: string;
  convergenceScore: number; // 0-1, higher = more converged
  createdAt: string;
}

const PROMPTS_DIR = '/home/ubuntu/UHWeb/data/prompts';
const OPTIMIZATIONS_DIR = '/home/ubuntu/UHWeb/data/optimizations';

/**
 * Ensure directories exist
 */
function ensureDirs(): void {
  if (!fs.existsSync(PROMPTS_DIR)) {
    fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(OPTIMIZATIONS_DIR)) {
    fs.mkdirSync(OPTIMIZATIONS_DIR, { recursive: true });
  }
}

/**
 * Get current prompt for a module
 */
export function getCurrentPrompt(module: string): PromptVersion | null {
  ensureDirs();
  const moduleDir = path.join(PROMPTS_DIR, module);
  
  if (!fs.existsSync(moduleDir)) {
    return null;
  }
  
  const files = fs.readdirSync(moduleDir)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => {
      const vA = parseInt(a.replace('.json', '').split('_v')[1] || '0');
      const vB = parseInt(b.replace('.json', '').split('_v')[1] || '0');
      return vB - vA;
    });
  
  if (files.length === 0) {
    return null;
  }
  
  const content = fs.readFileSync(path.join(moduleDir, files[0]), 'utf-8');
  return JSON.parse(content);
}

/**
 * Save a new prompt version
 */
export function savePromptVersion(prompt: PromptVersion): void {
  ensureDirs();
  const moduleDir = path.join(PROMPTS_DIR, prompt.module);
  
  if (!fs.existsSync(moduleDir)) {
    fs.mkdirSync(moduleDir, { recursive: true });
  }
  
  const filename = `${prompt.module}_v${prompt.version}.json`;
  fs.writeFileSync(path.join(moduleDir, filename), JSON.stringify(prompt, null, 2));
}

/**
 * Save optimization result
 */
export function saveOptimizationResult(result: OptimizationResult): void {
  ensureDirs();
  const filename = `optimization_iter${result.iteration}.json`;
  fs.writeFileSync(path.join(OPTIMIZATIONS_DIR, filename), JSON.stringify(result, null, 2));
}

/**
 * Load optimization history
 */
export function loadOptimizationHistory(): OptimizationResult[] {
  ensureDirs();
  const results: OptimizationResult[] = [];
  
  try {
    const files = fs.readdirSync(OPTIMIZATIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(OPTIMIZATIONS_DIR, file), 'utf-8');
      results.push(JSON.parse(content));
    }
  } catch (error) {
    console.error('[PromptOptimizer] Error loading history:', error);
  }
  
  return results;
}

/**
 * Default prompts for each module
 */
const DEFAULT_PROMPTS: Record<string, string> = {
  question_generation: `Generate interview questions that are:
1. Relevant to the position and company
2. Progressive in difficulty
3. Balanced across technical and behavioral topics
4. Encouraging specific examples from candidates`,

  hint_system: `Generate helpful hints that:
1. Guide thinking without giving away answers
2. Reference relevant frameworks (STAR, etc.)
3. Suggest specific examples to consider
4. Explain why this hint is helpful`,

  response_analysis: `Analyze candidate responses for:
1. Completeness and depth
2. Use of specific examples
3. Relevance to the question
4. Areas that need follow-up`,

  next_question: `Decide the next question based on:
1. Quality of previous response
2. Topics already covered
3. Knowledge base insights
4. Interview progress`,

  persona_generator: `Generate diverse mock personas that:
1. Cover different experience levels
2. Have varied communication styles
3. Represent different industries
4. Include edge cases and challenging behaviors`,
};

/**
 * Initialize default prompts if not exist
 */
export function initializeDefaultPrompts(): void {
  for (const [module, prompt] of Object.entries(DEFAULT_PROMPTS)) {
    const current = getCurrentPrompt(module);
    if (!current) {
      savePromptVersion({
        id: `prompt_${module}_v1`,
        module,
        version: 1,
        prompt,
        changelog: 'Initial version',
        metrics: {},
        createdAt: new Date().toISOString(),
        iteration: 0,
      });
    }
  }
}

/**
 * Optimize prompts based on feedback
 */
export async function optimizePrompts(
  feedbackReports: FeedbackReport[],
  iteration: number
): Promise<OptimizationResult> {
  // Initialize defaults if needed
  initializeDefaultPrompts();
  
  // Aggregate feedback
  const aggregated = aggregateFeedback(feedbackReports);
  
  // Get current prompts
  const currentPrompts: Record<string, PromptVersion> = {};
  for (const module of Object.keys(DEFAULT_PROMPTS)) {
    const prompt = getCurrentPrompt(module);
    if (prompt) {
      currentPrompts[module] = prompt;
    }
  }
  
  // Build feedback summary for LLM
  const feedbackSummary = feedbackReports.map(r => ({
    persona: r.personaName,
    satisfaction: r.overallSatisfaction,
    moduleFeedback: r.moduleFeedback.map(mf => ({
      module: mf.module,
      rating: mf.rating,
      issues: mf.specificIssues,
      suggestions: mf.suggestions,
    })),
    prioritizedSuggestions: r.prioritizedSuggestions.filter(s => s.priority === 'critical' || s.priority === 'high'),
  }));
  
  const prompt = `You are optimizing prompts for an AI interview system based on user feedback.

CURRENT PROMPTS:
${Object.entries(currentPrompts).map(([module, p]) => `
### ${module} (v${p.version})
${p.prompt}
`).join('\n')}

AGGREGATED METRICS:
- Average Satisfaction: ${aggregated.averageSatisfaction}/10
- Recommendation Rate: ${aggregated.recommendationRate}%
- Module Ratings: ${JSON.stringify(aggregated.moduleRatings)}

TOP ISSUES:
${aggregated.topIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

TOP SUGGESTIONS:
${aggregated.topSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

DETAILED FEEDBACK:
${JSON.stringify(feedbackSummary, null, 2)}

Based on this feedback, optimize the prompts. For each module that needs improvement:
1. Identify specific issues from feedback
2. Propose concrete changes to the prompt
3. Explain expected impact

Also suggest how to evolve the persona generator to create more challenging test cases.

Return JSON:
{
  "promptUpdates": [
    {
      "module": "module_name",
      "newPrompt": "the improved prompt text",
      "changelog": "what changed and why",
      "expectedImpact": "expected improvement"
    }
  ],
  "personaGeneratorUpdate": "suggestions for making personas more challenging",
  "summary": "overall optimization summary",
  "convergenceScore": number (0-1, how close to optimal based on feedback)
}`;

  const promptUpdates: PromptVersion[] = [];
  let personaGeneratorUpdate = '';
  let summary = '';
  let convergenceScore = 0.5;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'optimization_result',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              promptUpdates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    module: { type: 'string' },
                    newPrompt: { type: 'string' },
                    changelog: { type: 'string' },
                    expectedImpact: { type: 'string' },
                  },
                  required: ['module', 'newPrompt', 'changelog', 'expectedImpact'],
                  additionalProperties: false,
                },
              },
              personaGeneratorUpdate: { type: 'string' },
              summary: { type: 'string' },
              convergenceScore: { type: 'number' },
            },
            required: ['promptUpdates', 'personaGeneratorUpdate', 'summary', 'convergenceScore'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const result = JSON.parse(content);
      
      // Create new prompt versions
      for (const update of result.promptUpdates) {
        const current = currentPrompts[update.module];
        const newVersion: PromptVersion = {
          id: `prompt_${update.module}_v${(current?.version || 0) + 1}`,
          module: update.module,
          version: (current?.version || 0) + 1,
          prompt: update.newPrompt,
          changelog: update.changelog,
          metrics: {
            avgSatisfaction: aggregated.averageSatisfaction,
            moduleRating: aggregated.moduleRatings[update.module],
          },
          createdAt: new Date().toISOString(),
          iteration,
        };
        
        savePromptVersion(newVersion);
        promptUpdates.push(newVersion);
      }
      
      personaGeneratorUpdate = result.personaGeneratorUpdate;
      summary = result.summary;
      convergenceScore = result.convergenceScore;
    }
  } catch (error) {
    console.error('[PromptOptimizer] Error optimizing prompts:', error);
    summary = 'Optimization failed, keeping current prompts';
  }

  const optimizationResult: OptimizationResult = {
    iteration,
    promptUpdates,
    personaGeneratorUpdate,
    summary,
    convergenceScore,
    createdAt: new Date().toISOString(),
  };
  
  saveOptimizationResult(optimizationResult);
  
  return optimizationResult;
}

/**
 * Check if optimization has converged
 */
export function hasConverged(history: OptimizationResult[], threshold: number = 0.85): boolean {
  if (history.length < 2) {
    return false;
  }
  
  // Check last 2 iterations
  const recent = history.slice(-2);
  const avgScore = recent.reduce((sum, r) => sum + r.convergenceScore, 0) / recent.length;
  
  // Also check if no significant changes in last iteration
  const lastUpdate = history[history.length - 1];
  const noSignificantChanges = lastUpdate.promptUpdates.length === 0;
  
  return avgScore >= threshold || (avgScore >= 0.7 && noSignificantChanges);
}
