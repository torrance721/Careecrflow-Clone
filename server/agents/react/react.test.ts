/**
 * ReAct Agent Framework Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeBudgetManager, createTimeBudget } from './timeBudgetManager';
import { TIME_BUDGETS } from './types';
import { MultiGrader, createMultiGrader, questionGenerationGraders } from './multiGrader';

// ==================== TimeBudgetManager Tests ====================

describe('TimeBudgetManager', () => {
  it('should create with default budget for known module', () => {
    const manager = createTimeBudget('question_generation');
    expect(manager.getRemainingMs()).toBeLessThanOrEqual(TIME_BUDGETS.question_generation.maxTimeMs);
  });

  it('should track elapsed time', async () => {
    const manager = new TimeBudgetManager('test', { maxTimeMs: 5000, priority: 'balanced' });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(manager.getElapsedMs()).toBeGreaterThanOrEqual(95); // Allow small timing variance
    expect(manager.getRemainingMs()).toBeLessThan(5000);
  });

  it('should detect timeout', async () => {
    const manager = new TimeBudgetManager('test', { maxTimeMs: 100, priority: 'speed' });
    
    expect(manager.isExpired()).toBe(false);
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(manager.isExpired()).toBe(true);
  });

  it('should check if has time for operation', () => {
    const manager = new TimeBudgetManager('test', { maxTimeMs: 5000, priority: 'balanced' });
    
    expect(manager.hasTimeFor(1000)).toBe(true);
    expect(manager.hasTimeFor(10000)).toBe(false);
  });

  it('should recommend max steps based on priority', () => {
    const speedManager = new TimeBudgetManager('test', { maxTimeMs: 10000, priority: 'speed' });
    const qualityManager = new TimeBudgetManager('test', { maxTimeMs: 10000, priority: 'quality' });
    
    // Speed priority should recommend fewer steps
    expect(speedManager.getRecommendedMaxSteps(2000)).toBeLessThanOrEqual(2);
    
    // Quality priority should allow more steps
    expect(qualityManager.getRecommendedMaxSteps(2000)).toBeGreaterThanOrEqual(3);
  });

  it('should decide whether to continue thinking', () => {
    const speedManager = new TimeBudgetManager('test', { maxTimeMs: 10000, priority: 'speed' });
    const qualityManager = new TimeBudgetManager('test', { maxTimeMs: 10000, priority: 'quality' });
    
    // Speed priority: stop early if quality is decent
    expect(speedManager.shouldContinueThinking(0.7, 0.8)).toBe(false);
    
    // Quality priority: continue if quality gap exists
    expect(qualityManager.shouldContinueThinking(0.7, 0.8)).toBe(true);
  });

  it('should add checkpoints', () => {
    const manager = new TimeBudgetManager('test', { maxTimeMs: 5000, priority: 'balanced' });
    
    manager.checkpoint('start');
    manager.checkpoint('middle');
    
    const report = manager.getReport();
    expect(report.checkpoints).toHaveLength(2);
    expect(report.checkpoints[0].name).toBe('start');
    expect(report.checkpoints[1].name).toBe('middle');
  });

  it('should handle timeout with fallback', async () => {
    const manager = new TimeBudgetManager('test', { maxTimeMs: 100, priority: 'speed' });
    
    const slowPromise = new Promise(resolve => setTimeout(() => resolve('slow'), 500));
    
    const result = await manager.withTimeout(slowPromise, 'fallback');
    expect(result).toBe('fallback');
  });
});

// ==================== MultiGrader Tests ====================

describe('MultiGrader', () => {
  it('should create grader for known module', () => {
    const grader = createMultiGrader('question_generation');
    expect(grader).toBeInstanceOf(MultiGrader);
  });

  it('should evaluate with rule graders', async () => {
    const grader = new MultiGrader({
      graders: [
        {
          type: 'rule',
          name: 'has_content',
          description: 'Check if output has content',
          check: (output: unknown) => {
            const o = output as { question?: string };
            return o?.question ? 1 : 0;
          },
        },
      ],
      aggregation: 'average',
    });

    const result = await grader.evaluate({ question: 'Test question?' }, {});
    expect(result.overallScore).toBe(1);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].graderName).toBe('has_content');
  });

  it('should aggregate scores correctly', async () => {
    const grader = new MultiGrader({
      graders: [
        {
          type: 'rule',
          name: 'grader1',
          description: 'Test grader 1',
          check: () => 0.8,
        },
        {
          type: 'rule',
          name: 'grader2',
          description: 'Test grader 2',
          check: () => 0.6,
        },
      ],
      aggregation: 'average',
    });

    const result = await grader.evaluate({}, {});
    expect(result.overallScore).toBe(0.7); // (0.8 + 0.6) / 2
  });

  it('should use min aggregation', async () => {
    const grader = new MultiGrader({
      graders: [
        {
          type: 'rule',
          name: 'grader1',
          description: 'Test grader 1',
          check: () => 0.8,
        },
        {
          type: 'rule',
          name: 'grader2',
          description: 'Test grader 2',
          check: () => 0.6,
        },
      ],
      aggregation: 'min',
    });

    const result = await grader.evaluate({}, {});
    expect(result.overallScore).toBe(0.6);
  });

  it('should use weighted aggregation', async () => {
    const grader = new MultiGrader({
      graders: [
        {
          type: 'rule',
          name: 'important',
          description: 'Important grader',
          check: () => 1.0,
        },
        {
          type: 'rule',
          name: 'less_important',
          description: 'Less important grader',
          check: () => 0.5,
        },
      ],
      aggregation: 'weighted',
      weights: {
        important: 2,
        less_important: 1,
      },
    });

    const result = await grader.evaluate({}, {});
    // (1.0 * 2 + 0.5 * 1) / (2 + 1) = 2.5 / 3 ≈ 0.833
    expect(result.overallScore).toBeCloseTo(0.833, 2);
  });

  it('should handle similarity grader', async () => {
    const grader = new MultiGrader({
      graders: [
        {
          type: 'similarity',
          name: 'uniqueness',
          description: 'Check uniqueness',
          threshold: 0.5,
          compareWith: ['This is a test question about coding'],
        },
      ],
      aggregation: 'average',
    });

    // Very similar text should get low score
    const result1 = await grader.evaluate('This is a test question about coding', {});
    expect(result1.overallScore).toBeLessThan(0.5);

    // Different text should get high score
    const result2 = await grader.evaluate('Tell me about your leadership experience', {});
    expect(result2.overallScore).toBeGreaterThan(0.8);
  });
});

// ==================== Question Generation Graders Tests ====================

describe('Question Generation Graders', () => {
  it('should have required graders', () => {
    expect(questionGenerationGraders.length).toBeGreaterThan(0);
    
    const graderNames = questionGenerationGraders.map(g => g.name);
    expect(graderNames).toContain('has_question');
    expect(graderNames).toContain('appropriate_length');
  });

  it('should validate question presence', () => {
    const hasQuestionGrader = questionGenerationGraders.find(g => g.name === 'has_question');
    expect(hasQuestionGrader).toBeDefined();
    
    if (hasQuestionGrader?.type === 'rule') {
      // Valid question
      expect(hasQuestionGrader.check({ question: 'What is your experience with React?' }, {})).toBe(1);
      
      // Missing question mark
      expect(hasQuestionGrader.check({ question: 'Tell me about yourself' }, {})).toBe(0);
      
      // Too short
      expect(hasQuestionGrader.check({ question: 'Why?' }, {})).toBe(0);
      
      // No question
      expect(hasQuestionGrader.check({}, {})).toBe(0);
    }
  });

  it('should validate question length', () => {
    const lengthGrader = questionGenerationGraders.find(g => g.name === 'appropriate_length');
    expect(lengthGrader).toBeDefined();
    
    if (lengthGrader?.type === 'rule') {
      // Good length
      expect(lengthGrader.check({ question: 'Can you describe a challenging project you worked on and how you overcame the obstacles?' }, {})).toBe(1);
      
      // Too short
      expect(lengthGrader.check({ question: 'Why?' }, {})).toBe(0.3);
    }
  });
});

// ==================== TIME_BUDGETS Tests ====================

describe('TIME_BUDGETS', () => {
  it('should have budgets for all core modules', () => {
    expect(TIME_BUDGETS.question_generation).toBeDefined();
    expect(TIME_BUDGETS.hint_system).toBeDefined();
    expect(TIME_BUDGETS.next_question).toBeDefined();
    expect(TIME_BUDGETS.response_analysis).toBeDefined();
  });

  it('should have appropriate time limits', () => {
    // User-facing modules should be fast
    expect(TIME_BUDGETS.question_generation.maxTimeMs).toBeLessThanOrEqual(15000);
    expect(TIME_BUDGETS.hint_system.maxTimeMs).toBeLessThanOrEqual(5000);
    expect(TIME_BUDGETS.next_question.maxTimeMs).toBeLessThanOrEqual(10000);
    
    // Background modules can be slower
    expect(TIME_BUDGETS.persona_generation.maxTimeMs).toBeGreaterThan(TIME_BUDGETS.question_generation.maxTimeMs);
  });

  it('should have correct priorities', () => {
    expect(TIME_BUDGETS.hint_system.priority).toBe('speed');
    expect(TIME_BUDGETS.question_generation.priority).toBe('quality');
  });
});
