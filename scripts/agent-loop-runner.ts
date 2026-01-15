/**
 * Agent Loop Runner with Google Drive Sync
 * 
 * Run with: cd /home/ubuntu/UHWeb && npx tsx scripts/agent-loop-runner.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Import agent loop components
import { 
  generatePersonas, 
  loadExistingPersonas,
  MockPersona,
  PersonaGeneratorConfig,
} from '../server/agents/agentLoop/personaGenerator';
import { simulateInterview, SimulationResult } from '../server/agents/agentLoop/interviewSimulator';
import { generateFeedback, aggregateFeedback, FeedbackReport } from '../server/agents/agentLoop/feedbackGenerator';
import { 
  optimizePrompts, 
  hasConverged, 
  loadOptimizationHistory,
  initializeDefaultPrompts,
  OptimizationResult,
} from '../server/agents/agentLoop/promptOptimizer';

const DATA_DIR = '/home/ubuntu/UHWeb/data';
const GDRIVE_CONFIG = '/home/ubuntu/.gdrive-rclone.ini';
const GDRIVE_REMOTE = 'manus_google_drive:uhire/agent-loop-results';

interface AgentLoopConfig {
  maxIterations: number;
  personasPerIteration: number;
  initialCriticalness: number;
  criticalnesIncrement: number;
  convergenceThreshold: number;
}

interface IterationResult {
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
  duration: number;
}

/**
 * Sync a directory to Google Drive
 */
function syncToGoogleDrive(localPath: string, remotePath: string): void {
  try {
    console.log(`[Sync] Uploading ${localPath} to ${remotePath}...`);
    execSync(`rclone copy "${localPath}" "${remotePath}" --config ${GDRIVE_CONFIG}`, {
      stdio: 'pipe'
    });
    console.log(`[Sync] ✓ Upload complete!`);
  } catch (error: any) {
    console.error(`[Sync] ✗ Error:`, error.message);
  }
}

/**
 * Sync iteration data to Google Drive
 */
function syncIterationData(iteration: number): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[Sync] Syncing iteration ${iteration} data to Google Drive...`);
  console.log(`${'─'.repeat(60)}\n`);
  
  const iterationDir = `${GDRIVE_REMOTE}/iteration-${iteration}`;
  
  // Sync each data type
  syncToGoogleDrive(`${DATA_DIR}/personas`, `${iterationDir}/personas`);
  syncToGoogleDrive(`${DATA_DIR}/simulations`, `${iterationDir}/simulations`);
  syncToGoogleDrive(`${DATA_DIR}/feedback`, `${iterationDir}/feedback`);
  syncToGoogleDrive(`${DATA_DIR}/prompts`, `${iterationDir}/prompts`);
  syncToGoogleDrive(`${DATA_DIR}/optimizations`, `${iterationDir}/optimizations`);
  
  // Create and sync iteration summary
  const summaryPath = `${DATA_DIR}/iteration-${iteration}-summary.json`;
  if (fs.existsSync(summaryPath)) {
    syncToGoogleDrive(summaryPath, `${iterationDir}/summary.json`);
  }
  
  console.log(`\n[Sync] ✓ Iteration ${iteration} sync complete!\n`);
}

/**
 * Run a single iteration
 */
async function runIteration(
  iteration: number,
  config: AgentLoopConfig,
  existingPersonas: MockPersona[]
): Promise<IterationResult> {
  const startTime = Date.now();
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`                    ITERATION ${iteration}`);
  console.log(`${'═'.repeat(60)}\n`);
  
  // Calculate target criticalness
  const targetCriticalness = Math.min(
    10,
    config.initialCriticalness + (iteration - 1) * config.criticalnesIncrement
  );
  
  // Step 1: Generate personas
  console.log(`[Step 1/4] Generating ${config.personasPerIteration} personas (criticalness: ${targetCriticalness}/10)...`);
  const personaConfig: PersonaGeneratorConfig = {
    iteration,
    existingPersonas,
    targetCriticalness,
  };
  const newPersonas = await generatePersonas(personaConfig, config.personasPerIteration);
  console.log(`         ✓ Generated ${newPersonas.length} personas:`);
  for (const p of newPersonas) {
    console.log(`           - ${p.name} (${p.background.currentRole}, ${p.background.yearsOfExperience}y exp)`);
  }
  
  // Step 2: Simulate interviews
  console.log(`\n[Step 2/4] Simulating interviews...`);
  const simulations: SimulationResult[] = [];
  for (const persona of newPersonas) {
    console.log(`         - ${persona.name}: Starting simulation...`);
    const simulation = await simulateInterview(persona, iteration, 4); // 4 questions for faster testing
    simulations.push(simulation);
    console.log(`           ✓ Done (${simulation.duration}s, ${simulation.hintsUsed} hints, ${simulation.completedSuccessfully ? 'success' : 'failed'})`);
  }
  
  // Step 3: Generate feedback
  console.log(`\n[Step 3/4] Generating feedback...`);
  const feedback: FeedbackReport[] = [];
  for (let i = 0; i < newPersonas.length; i++) {
    console.log(`         - ${newPersonas[i].name}: Generating feedback...`);
    const report = await generateFeedback(newPersonas[i], simulations[i]);
    feedback.push(report);
    console.log(`           ✓ Satisfaction: ${report.overallSatisfaction}/10, Recommend: ${report.wouldRecommend ? 'Yes' : 'No'}`);
  }
  
  // Aggregate feedback
  const aggregated = aggregateFeedback(feedback);
  console.log(`\n         Aggregated Metrics:`);
  console.log(`           - Avg Satisfaction: ${aggregated.averageSatisfaction}/10`);
  console.log(`           - Recommendation Rate: ${aggregated.recommendationRate}%`);
  if (aggregated.topIssues.length > 0) {
    console.log(`           - Top Issues: ${aggregated.topIssues.slice(0, 2).join(', ')}`);
  }
  
  // Step 4: Optimize prompts
  console.log(`\n[Step 4/4] Optimizing prompts...`);
  const optimization = await optimizePrompts(feedback, iteration);
  console.log(`         ✓ Updated ${optimization.promptUpdates.length} prompts`);
  console.log(`         ✓ Convergence score: ${optimization.convergenceScore.toFixed(2)}`);
  console.log(`         ✓ Summary: ${optimization.summary.slice(0, 80)}...`);
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  // Save iteration summary
  const iterationResult: IterationResult = {
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
  
  const summaryPath = `${DATA_DIR}/iteration-${iteration}-summary.json`;
  fs.writeFileSync(summaryPath, JSON.stringify(iterationResult, null, 2));
  
  console.log(`\n[Iteration ${iteration}] Completed in ${duration}s`);
  
  // Sync to Google Drive
  syncIterationData(iteration);
  
  return iterationResult;
}

/**
 * Main function
 */
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         AGENT LOOP WITH GOOGLE DRIVE SYNC                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  const config: AgentLoopConfig = {
    maxIterations: 5,
    personasPerIteration: 3,
    initialCriticalness: 4,
    criticalnesIncrement: 1,
    convergenceThreshold: 0.85,
  };
  
  console.log('Configuration:');
  console.log(`  - Max iterations: ${config.maxIterations}`);
  console.log(`  - Personas per iteration: ${config.personasPerIteration}`);
  console.log(`  - Initial criticalness: ${config.initialCriticalness}/10`);
  console.log(`  - Convergence threshold: ${config.convergenceThreshold}`);
  console.log('\n');
  
  // Ensure directories exist
  const dirs = ['personas', 'simulations', 'feedback', 'prompts', 'optimizations', 'agent-loop-results'];
  for (const dir of dirs) {
    const fullPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
  
  // Initialize default prompts
  initializeDefaultPrompts();
  
  const startTime = Date.now();
  const iterations: IterationResult[] = [];
  let converged = false;
  let existingPersonas = loadExistingPersonas();
  const optimizationHistory = loadOptimizationHistory();
  
  for (let i = 1; i <= config.maxIterations; i++) {
    const result = await runIteration(i, config, existingPersonas);
    iterations.push(result);
    
    // Update existing personas
    existingPersonas = [...existingPersonas, ...result.personas];
    
    // Check convergence
    const allOptimizations = [...optimizationHistory, result.optimization];
    if (hasConverged(allOptimizations, config.convergenceThreshold)) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`              ✅ CONVERGED after ${i} iterations!`);
      console.log(`${'═'.repeat(60)}\n`);
      converged = true;
      break;
    }
  }
  
  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  const lastIteration = iterations[iterations.length - 1];
  
  // Final summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AGENT LOOP COMPLETE                     ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Total iterations: ${iterations.length.toString().padEnd(39)}║`);
  console.log(`║  Converged: ${(converged ? 'Yes' : 'No').padEnd(46)}║`);
  console.log(`║  Final satisfaction: ${lastIteration.aggregatedMetrics.averageSatisfaction}/10${' '.repeat(35)}║`);
  console.log(`║  Final recommendation: ${lastIteration.aggregatedMetrics.recommendationRate}%${' '.repeat(33)}║`);
  console.log(`║  Total duration: ${Math.round(totalDuration / 60)} minutes${' '.repeat(35)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  // Save final result
  const finalResult = {
    totalIterations: iterations.length,
    converged,
    finalMetrics: lastIteration.aggregatedMetrics,
    totalDuration,
    completedAt: new Date().toISOString(),
  };
  
  const finalPath = `${DATA_DIR}/agent-loop-results/final-result-${Date.now()}.json`;
  fs.writeFileSync(finalPath, JSON.stringify(finalResult, null, 2));
  
  // Sync final result
  syncToGoogleDrive(`${DATA_DIR}/agent-loop-results`, `${GDRIVE_REMOTE}/final-results`);
  
  console.log('All results synced to Google Drive!');
  console.log(`Location: uhire/agent-loop-results/`);
}

main().catch(console.error);
