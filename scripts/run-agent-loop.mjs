/**
 * Agent Loop Runner Script
 * 
 * Runs the Agent Loop and syncs results to Google Drive after each iteration.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = '/home/ubuntu/UHWeb/data';
const GDRIVE_CONFIG = '/home/ubuntu/.gdrive-rclone.ini';
const GDRIVE_REMOTE = 'manus_google_drive:uhire/agent-loop-results';

/**
 * Sync a directory to Google Drive
 */
function syncToGoogleDrive(localPath, remotePath) {
  try {
    console.log(`[Sync] Uploading ${localPath} to ${remotePath}...`);
    execSync(`rclone copy "${localPath}" "${remotePath}" --config ${GDRIVE_CONFIG}`, {
      stdio: 'inherit'
    });
    console.log(`[Sync] Upload complete!`);
  } catch (error) {
    console.error(`[Sync] Error uploading to Google Drive:`, error.message);
  }
}

/**
 * Sync all iteration data to Google Drive
 */
function syncIterationData(iteration) {
  console.log(`\n[Sync] Syncing iteration ${iteration} data to Google Drive...\n`);
  
  // Sync personas
  syncToGoogleDrive(
    `${DATA_DIR}/personas`,
    `${GDRIVE_REMOTE}/iteration-${iteration}/personas`
  );
  
  // Sync simulations
  syncToGoogleDrive(
    `${DATA_DIR}/simulations`,
    `${GDRIVE_REMOTE}/iteration-${iteration}/simulations`
  );
  
  // Sync feedback
  syncToGoogleDrive(
    `${DATA_DIR}/feedback`,
    `${GDRIVE_REMOTE}/iteration-${iteration}/feedback`
  );
  
  // Sync prompts
  syncToGoogleDrive(
    `${DATA_DIR}/prompts`,
    `${GDRIVE_REMOTE}/iteration-${iteration}/prompts`
  );
  
  // Sync optimizations
  syncToGoogleDrive(
    `${DATA_DIR}/optimizations`,
    `${GDRIVE_REMOTE}/iteration-${iteration}/optimizations`
  );
  
  console.log(`\n[Sync] Iteration ${iteration} sync complete!\n`);
}

/**
 * Main runner - imports and runs the agent loop with Google Drive sync
 */
async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         AGENT LOOP RUNNER WITH GOOGLE DRIVE SYNC           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  // Ensure data directories exist
  const dirs = ['personas', 'simulations', 'feedback', 'prompts', 'optimizations', 'agent-loop-results'];
  for (const dir of dirs) {
    const fullPath = path.join(DATA_DIR, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
  
  // Import the agent loop module dynamically
  // We need to use tsx to run TypeScript
  const config = {
    maxIterations: 5,
    personasPerIteration: 3,
    initialCriticalness: 4,
    criticalnesIncrement: 1,
    convergenceThreshold: 0.85,
  };
  
  console.log('Configuration:', JSON.stringify(config, null, 2));
  console.log('\nStarting Agent Loop...\n');
  
  // Since we can't directly import TypeScript, we'll create a TypeScript runner
  const runnerCode = `
import { runAgentLoop } from './server/agents/agentLoop/index.js';

const config = ${JSON.stringify(config)};

async function main() {
  const result = await runAgentLoop(config);
  console.log('\\n[Result]', JSON.stringify(result, null, 2));
}

main().catch(console.error);
`;

  // Write the runner
  fs.writeFileSync('/home/ubuntu/UHWeb/scripts/agent-loop-runner.ts', runnerCode);
  
  console.log('Running Agent Loop via tsx...\n');
}

main().catch(console.error);
