# Agent Loop Auto-Iteration System

**Version**: 1.0.0
**Date**: 2026-01-05
**Author**: Manus AI

## Overview

The Agent Loop Auto-Iteration System is a self-improving mechanism that automatically optimizes the interview preparation system through simulated user testing and feedback analysis. It uses an adversarial approach where mock personas become increasingly critical over iterations, driving continuous improvement.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT LOOP CONTROLLER                           │
│                        (server/agents/agentLoop/index.ts)               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │ 1. PERSONA      │  Generate diverse mock users                       │
│  │    GENERATOR    │  with increasing criticalness                      │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 2. INTERVIEW    │  Simulate complete mock interviews                 │
│  │    SIMULATOR    │  using generated personas                          │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 3. FEEDBACK     │  Generate comprehensive feedback                   │
│  │    GENERATOR    │  from persona perspective                          │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 4. PROMPT       │  Analyze feedback and optimize                     │
│  │    OPTIMIZER    │  system prompts                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐                                                    │
│  │ 5. CONVERGENCE  │  Check if optimization has                         │
│  │    DETECTOR     │  reached target quality                            │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           └──────────────────────────────────────────────────────┐      │
│                                                                  │      │
│                              ┌───────────────────────────────────┘      │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │   CONVERGED?    │                                  │
│                    └────────┬────────┘                                  │
│                             │                                           │
│              ┌──────────────┴──────────────┐                            │
│              │                             │                            │
│              ▼                             ▼                            │
│         ┌────────┐                   ┌──────────┐                       │
│         │  YES   │                   │    NO    │                       │
│         │  STOP  │                   │  REPEAT  │ ─────────────────┐    │
│         └────────┘                   └──────────┘                  │    │
│                                                                    │    │
│                                                                    │    │
│  ◄─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Persona Generator (`personaGenerator.ts`)

Generates diverse mock user personas for testing.

**Key Features:**
- Creates personas with varied backgrounds, experience levels, and industries
- Implements adversarial evolution (personas become more critical over iterations)
- Ensures new personas are different from existing ones
- Stores personas as JSON files for reproducibility

**Data Structure:**
```typescript
interface MockPersona {
  id: string;
  name: string;
  background: {
    yearsOfExperience: number;
    currentRole: string;
    currentCompany: string;
    education: string;
    skills: string[];
  };
  targetJob: {
    company: string;
    position: string;
  };
  personality: {
    communicationStyle: 'verbose' | 'concise' | 'rambling' | 'structured';
    confidenceLevel: 'high' | 'medium' | 'low';
    criticalness: number; // 1-10
    patience: number; // 1-10
  };
  interviewBehavior: {
    typicalResponseLength: 'brief' | 'medium' | 'detailed';
    usesExamples: boolean;
    asksForClarification: boolean;
    getsNervous: boolean;
  };
  resumeText: string;
  situation: string;
  feedbackStyle: string;
}
```

### 2. Interview Simulator (`interviewSimulator.ts`)

Simulates complete mock interviews using generated personas.

**Key Features:**
- Generates realistic user responses based on persona traits
- Simulates hint requests based on confidence and nervousness
- Tracks all interactions for analysis
- Uses the actual interview system (question generation, hints, etc.)

**Simulation Flow:**
1. Generate opening question
2. For each question (1 to totalQuestions):
   - Maybe request hint (based on persona)
   - Generate user response (based on persona traits)
   - Generate next question (using real system)
3. Generate closing message
4. Save simulation result

### 3. Feedback Generator (`feedbackGenerator.ts`)

Generates comprehensive feedback from the persona's perspective.

**Key Features:**
- Module-specific feedback (question_generation, hint_system, etc.)
- Emotional journey description
- Prioritized suggestions (critical/high/medium/low)
- Aggregation across multiple feedback reports

**Feedback Structure:**
```typescript
interface FeedbackReport {
  overallSatisfaction: number; // 1-10
  wouldRecommend: boolean;
  moduleFeedback: ModuleFeedback[];
  emotionalJourney: string;
  frustratingMoments: string[];
  positiveHighlights: string[];
  prioritizedSuggestions: PrioritizedSuggestion[];
  rawFeedback: string;
}
```

### 4. Prompt Optimizer (`promptOptimizer.ts`)

Analyzes feedback and optimizes system prompts.

**Key Features:**
- Maintains versioned prompts for each module
- Generates specific improvements based on feedback
- Tracks metrics for each prompt version
- Provides evolution suggestions for persona generator

**Optimized Modules:**
- `question_generation` - How interview questions are generated
- `hint_system` - How hints are provided
- `response_analysis` - How user responses are analyzed
- `next_question` - How next questions are decided
- `persona_generator` - How mock personas are created

### 5. Convergence Detector

Determines when optimization has reached satisfactory quality.

**Convergence Criteria:**
- Convergence score ≥ threshold (default 0.85)
- Or: score ≥ 0.7 AND no significant changes in last iteration
- Checked after each iteration

---

## Data Storage

All artifacts are stored in `/home/ubuntu/UHWeb/data/`:

```
data/
├── personas/           # Generated mock personas
│   └── persona_*.json
├── simulations/        # Interview simulation results
│   └── sim_*.json
├── feedback/           # Feedback reports
│   └── feedback_*.json
├── prompts/            # Versioned prompts
│   ├── question_generation/
│   │   └── question_generation_v*.json
│   ├── hint_system/
│   │   └── hint_system_v*.json
│   └── ...
├── optimizations/      # Optimization results
│   └── optimization_iter*.json
└── agent-loop-results/ # Complete loop results
    └── agent_loop_*.json
```

---

## Configuration

```typescript
interface AgentLoopConfig {
  maxIterations: number;        // Default: 10
  personasPerIteration: number; // Default: 3
  initialCriticalness: number;  // Default: 4
  criticalnesIncrement: number; // Default: 1
  convergenceThreshold: number; // Default: 0.85
}
```

---

## Usage

### Running the Agent Loop

```typescript
import { runAgentLoop } from './server/agents/agentLoop';

// Run with default config
const result = await runAgentLoop();

// Run with custom config
const result = await runAgentLoop({
  maxIterations: 5,
  personasPerIteration: 5,
  initialCriticalness: 3,
  convergenceThreshold: 0.9,
});
```

### Accessing Results

```typescript
import { 
  loadExistingPersonas,
  loadSimulations,
  loadFeedback,
  loadOptimizationHistory,
} from './server/agents/agentLoop';

// Load all personas
const personas = loadExistingPersonas();

// Load simulations for specific iteration
const simulations = loadSimulations(3);

// Load all feedback
const feedback = loadFeedback();

// Load optimization history
const history = loadOptimizationHistory();
```

---

## Adversarial Evolution

The system uses adversarial evolution to continuously improve:

1. **Initial Personas**: Criticalness starts at 4/10
2. **Each Iteration**: Criticalness increases by 1
3. **Diversity**: New personas must be different from existing ones
4. **Feedback-Driven**: Persona generator evolves based on feedback

This ensures:
- Early iterations catch obvious issues
- Later iterations find subtle problems
- System is tested against increasingly demanding users

---

## Metrics Tracked

| Metric | Description | Target |
|--------|-------------|--------|
| Overall Satisfaction | Average user satisfaction (1-10) | ≥ 8.0 |
| Recommendation Rate | % who would recommend | ≥ 80% |
| Module Ratings | Per-module satisfaction | ≥ 7.0 each |
| Convergence Score | Optimization progress (0-1) | ≥ 0.85 |

---

## Reuse Guidelines

### Adding a New Module to Optimize

1. Add default prompt in `promptOptimizer.ts`:
```typescript
const DEFAULT_PROMPTS: Record<string, string> = {
  // ... existing prompts
  new_module: `Your default prompt here`,
};
```

2. Add module to feedback schema in `feedbackGenerator.ts`:
```typescript
module: { 
  type: 'string', 
  enum: ['question_generation', 'hint_system', ..., 'new_module'] 
}
```

### Customizing Persona Generation

Modify the prompt in `generatePersonas()` to add new persona traits:
```typescript
const prompt = `Generate personas with:
- New trait: ...
- Another trait: ...
`;
```

### Adjusting Convergence

Modify `hasConverged()` in `promptOptimizer.ts`:
```typescript
export function hasConverged(
  history: OptimizationResult[], 
  threshold: number = 0.85  // Adjust this
): boolean {
  // Add custom convergence logic
}
```

---

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║              AGENT LOOP AUTO-ITERATION SYSTEM              ║
╠════════════════════════════════════════════════════════════╣
║  Max iterations: 10                                        ║
║  Personas per iteration: 3                                 ║
║  Initial criticalness: 4                                   ║
║  Convergence threshold: 0.85                               ║
╚════════════════════════════════════════════════════════════╝

========== ITERATION 1 ==========

[Iteration 1] Generating 3 personas (criticalness: 4)...
[Iteration 1] Generated 3 personas
[Iteration 1] Simulating interviews...
  - Simulating interview for Alex Chen...
    Completed: true, Duration: 45s, Hints: 1
  - Simulating interview for Maria Garcia...
    Completed: true, Duration: 52s, Hints: 0
  - Simulating interview for James Wilson...
    Completed: true, Duration: 48s, Hints: 2
[Iteration 1] Generating feedback...
  - Generating feedback from Alex Chen...
    Satisfaction: 7/10, Would recommend: true
  - Generating feedback from Maria Garcia...
    Satisfaction: 8/10, Would recommend: true
  - Generating feedback from James Wilson...
    Satisfaction: 6/10, Would recommend: true
[Iteration 1] Aggregated metrics:
  - Average satisfaction: 7.0/10
  - Recommendation rate: 100%
  - Top issues: question repetition, hint clarity, response timing
[Iteration 1] Optimizing prompts...
  - Updated 2 prompts
  - Convergence score: 0.65
  - Summary: Improved question variety and hint specificity...
[Iteration 1] Completed in 180s

... (more iterations) ...

✅ CONVERGED after 5 iterations!

╔════════════════════════════════════════════════════════════╗
║                    AGENT LOOP COMPLETE                     ║
╠════════════════════════════════════════════════════════════╣
║  Total iterations: 5                                       ║
║  Converged: Yes                                            ║
║  Final satisfaction: 8.5/10                                ║
║  Final recommendation rate: 93%                            ║
║  Total duration: 15 minutes                                ║
╚════════════════════════════════════════════════════════════╝
```

---

## Future Improvements

1. **A/B Testing**: Run multiple prompt variants simultaneously
2. **Real User Integration**: Mix mock personas with real user feedback
3. **Multi-Language Support**: Test with personas in different languages
4. **Performance Optimization**: Parallel simulation execution
5. **Dashboard**: Visual monitoring of optimization progress
