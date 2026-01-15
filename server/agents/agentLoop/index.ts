/**
 * Agent Loop Main Controller
 * 
 * Orchestrates the complete agent loop:
 * 1. Generate mock personas (adversarial evolution)
 * 2. Simulate interviews with personas
 * 3. Generate feedback from persona perspective
 * 4. Optimize prompts based on feedback
 * 5. Repeat until convergence
 */

import { 
  generatePersonas, 
  loadExistingPersonas, 
  evolvePersonaGenerator,
  MockPersona,
  PersonaGeneratorConfig,
} from './personaGenerator';
import { simulateInterview, SimulationResult } from './interviewSimulator';
import { generateFeedback, aggregateFeedback, FeedbackReport } from './feedbackGenerator';
import { 
  optimizePrompts, 
  hasConverged, 
  loadOptimizationHistory,
  OptimizationResult,
} from './promptOptimizer';
import * as fs from 'fs';
import * as path from 'path';

export interface AgentLoopConfig {
  maxIterations: number;
  personasPerIteration: number;
  initialCriticalness: number;
  criticalnesIncrement: number;
  convergenceThreshold: number;
}

export interface IterationResult {
  iteration: number;
  personas: MockPersona[];
  simulations: SimulationResult[];
  feedback: FeedbackReport[];
  optimization: OptimizationResult;
  aggregatedMetrics: {
    averageSatisfaction: number;
    recommendationRate: number;
    moduleRatings: Record<string, number>;
  };
  duration: number; // seconds
}

export interface AgentLoopResult {
  totalIterations: number;
  converged: boolean;
  finalMetrics: {
    averageSatisfaction: number;
    recommendationRate: number;
  };
  iterations: IterationResult[];
  totalDuration: number; // seconds
  completedAt: string;
}

const RESULTS_DIR = '/home/ubuntu/UHWeb/data/agent-loop-results';

/**
 * Ensure results directory exists
 */
function ensureResultsDir(): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Save agent loop result
 */
function saveAgentLoopResult(result: AgentLoopResult): void {
  ensureResultsDir();
  const filename = `agent_loop_${Date.now()}.json`;
  fs.writeFileSync(path.join(RESULTS_DIR, filename), JSON.stringify(result, null, 2));
}

/**
 * Run a single iteration of the agent loop
 */
async function runIteration(
  iteration: number,
  config: AgentLoopConfig,
  existingPersonas: MockPersona[]
): Promise<IterationResult> {
  const startTime = Date.now();
  console.log(`\n========== ITERATION ${iteration} ==========\n`);
  
  // Calculate target criticalness for this iteration
  const targetCriticalness = Math.min(
    10,
    config.initialCriticalness + (iteration - 1) * config.criticalnesIncrement
  );
  
  // Step 1: Generate new personas
  console.log(`[Iteration ${iteration}] Generating ${config.personasPerIteration} personas (criticalness: ${targetCriticalness})...`);
  const personaConfig: PersonaGeneratorConfig = {
    iteration,
    existingPersonas,
    targetCriticalness,
  };
  const newPersonas = await generatePersonas(personaConfig, config.personasPerIteration);
  console.log(`[Iteration ${iteration}] Generated ${newPersonas.length} personas`);
  
  // Step 2: Simulate interviews
  console.log(`[Iteration ${iteration}] Simulating interviews...`);
  const simulations: SimulationResult[] = [];
  for (const persona of newPersonas) {
    console.log(`  - Simulating interview for ${persona.name}...`);
    const simulation = await simulateInterview(persona, iteration);
    simulations.push(simulation);
    console.log(`    Completed: ${simulation.completedSuccessfully}, Duration: ${simulation.duration}s, Hints: ${simulation.hintsUsed}`);
  }
  
  // Step 3: Generate feedback
  console.log(`[Iteration ${iteration}] Generating feedback...`);
  const feedback: FeedbackReport[] = [];
  for (let i = 0; i < newPersonas.length; i++) {
    console.log(`  - Generating feedback from ${newPersonas[i].name}...`);
    const report = await generateFeedback(newPersonas[i], simulations[i]);
    feedback.push(report);
    console.log(`    Satisfaction: ${report.overallSatisfaction}/10, Would recommend: ${report.wouldRecommend}`);
  }
  
  // Step 4: Aggregate and analyze feedback
  const aggregated = aggregateFeedback(feedback);
  console.log(`[Iteration ${iteration}] Aggregated metrics:`);
  console.log(`  - Average satisfaction: ${aggregated.averageSatisfaction}/10`);
  console.log(`  - Recommendation rate: ${aggregated.recommendationRate}%`);
  console.log(`  - Top issues: ${aggregated.topIssues.slice(0, 3).join(', ')}`);
  
  // Step 5: Optimize prompts
  console.log(`[Iteration ${iteration}] Optimizing prompts...`);
  const optimization = await optimizePrompts(feedback, iteration);
  console.log(`  - Updated ${optimization.promptUpdates.length} prompts`);
  console.log(`  - Convergence score: ${optimization.convergenceScore}`);
  console.log(`  - Summary: ${optimization.summary.slice(0, 100)}...`);
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[Iteration ${iteration}] Completed in ${duration}s\n`);
  
  return {
    iteration,
    personas: newPersonas,
    simulations,
    feedback,
    optimization,
    aggregatedMetrics: {
      averageSatisfaction: aggregated.averageSatisfaction,
      recommendationRate: aggregated.recommendationRate,
      moduleRatings: aggregated.moduleRatings,
    },
    duration,
  };
}

/**
 * Run the complete agent loop until convergence
 */
export async function runAgentLoop(
  config: Partial<AgentLoopConfig> = {}
): Promise<AgentLoopResult> {
  const fullConfig: AgentLoopConfig = {
    maxIterations: config.maxIterations || 10,
    personasPerIteration: config.personasPerIteration || 3,
    initialCriticalness: config.initialCriticalness || 4,
    criticalnesIncrement: config.criticalnesIncrement || 1,
    convergenceThreshold: config.convergenceThreshold || 0.85,
  };
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              AGENT LOOP AUTO-ITERATION SYSTEM              ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Max iterations: ${fullConfig.maxIterations.toString().padEnd(40)}║`);
  console.log(`║  Personas per iteration: ${fullConfig.personasPerIteration.toString().padEnd(33)}║`);
  console.log(`║  Initial criticalness: ${fullConfig.initialCriticalness.toString().padEnd(35)}║`);
  console.log(`║  Convergence threshold: ${fullConfig.convergenceThreshold.toString().padEnd(34)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const startTime = Date.now();
  const iterations: IterationResult[] = [];
  let converged = false;
  
  // Load existing personas and optimization history
  let existingPersonas = loadExistingPersonas();
  const optimizationHistory = loadOptimizationHistory();
  
  for (let i = 1; i <= fullConfig.maxIterations; i++) {
    // Run iteration
    const result = await runIteration(i, fullConfig, existingPersonas);
    iterations.push(result);
    
    // Update existing personas for next iteration
    existingPersonas = [...existingPersonas, ...result.personas];
    
    // Check convergence
    const allOptimizations = [...optimizationHistory, result.optimization];
    if (hasConverged(allOptimizations, fullConfig.convergenceThreshold)) {
      console.log(`\n✅ CONVERGED after ${i} iterations!`);
      converged = true;
      break;
    }
    
    // Evolve persona generator for next iteration
    if (i < fullConfig.maxIterations) {
      const feedbackSummary = result.feedback
        .map(f => f.rawFeedback)
        .join('\n\n');
      const evolution = await evolvePersonaGenerator(feedbackSummary, i);
      console.log(`[Evolution] Persona generator update: ${evolution.slice(0, 100)}...`);
    }
  }
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  
  // Calculate final metrics
  const lastIteration = iterations[iterations.length - 1];
  const finalMetrics = {
    averageSatisfaction: lastIteration.aggregatedMetrics.averageSatisfaction,
    recommendationRate: lastIteration.aggregatedMetrics.recommendationRate,
  };
  
  const result: AgentLoopResult = {
    totalIterations: iterations.length,
    converged,
    finalMetrics,
    iterations,
    totalDuration,
    completedAt: new Date().toISOString(),
  };
  
  // Save result
  saveAgentLoopResult(result);
  
  // Print summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AGENT LOOP COMPLETE                     ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Total iterations: ${iterations.length.toString().padEnd(39)}║`);
  console.log(`║  Converged: ${converged ? 'Yes' : 'No'.padEnd(46)}║`);
  console.log(`║  Final satisfaction: ${finalMetrics.averageSatisfaction}/10${' '.repeat(35)}║`);
  console.log(`║  Final recommendation rate: ${finalMetrics.recommendationRate}%${' '.repeat(29)}║`);
  console.log(`║  Total duration: ${Math.round(totalDuration / 60)} minutes${' '.repeat(35)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  return result;
}

// Re-export types and functions
export * from './personaGenerator';
export * from './interviewSimulator';
export * from './feedbackGenerator';
export * from './promptOptimizer';

// Progressive Agent Loop with ReAct
export {
  runProgressiveAgentLoop,
  PROGRESSIVE_DEFAULT_CONFIG,
  type ProgressiveConfig,
  type ProgressiveIterationResult,
  type ProgressiveAgentLoopResult,
} from './progressiveAgentLoop';

// Tool Library for dynamic tool management
export {
  ToolLibrary,
  getToolLibrary,
  initializeToolLibrary,
  type ToolUsageStats,
  type ToolLibraryConfig,
  type ToolLibraryState,
} from './toolLibrary';

// Realistic Simulator for human-like flow
export {
  runRealisticSimulation,
  toStandardSimulation,
  type UserAction,
  type RealisticMessage,
  type RealisticSimulationResult,
} from './realisticSimulator';

// Generalization Evaluator for strategy assessment
export {
  calculateGeneralizationScore,
  checkCodeGeneralization,
  evaluateStrategyGeneralization,
  shouldSwitchTopic,
  generateContextAwareQuestion,
  generateGeneralizationReport,
  POOR_GENERALIZATION_PATTERNS,
  type GeneralizationScore,
  type GeneralizationIssue,
  type GeneralizationReport,
  type IterationResult as GeneralizationIterationResult,
} from './generalizationEvaluator';
