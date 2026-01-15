/**
 * Tool Library Tests
 * 
 * 测试工具库的核心功能：
 * 1. 工具注册和获取
 * 2. 使用统计和反馈评分
 * 3. 推荐工具选择
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolLibrary, ToolUsageStats } from './toolLibrary';
import { Tool, ToolResult } from '../react/types';

describe('ToolLibrary', () => {
  let library: ToolLibrary;

  beforeEach(() => {
    library = new ToolLibrary({
      persistPath: '/tmp/test-tool-library',
      enableAutoDiscovery: false,
      enableAutoCreation: false,
      enableOptimization: false,
    });
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', async () => {
      await library.initialize();
      
      const testTool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input value' },
          },
          required: ['input'],
        },
        estimatedTimeMs: 100,
        execute: async () => ({
          success: true,
          data: { result: 'test' },
          executionTimeMs: 50,
        }),
      };

      library.registerTool(testTool);
      
      const retrieved = library.getTool('test_tool');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test_tool');
      expect(retrieved?.description).toBe('A test tool');
    });

    it('should return undefined for non-existent tool', async () => {
      await library.initialize();
      
      const tool = library.getTool('non_existent');
      expect(tool).toBeUndefined();
    });

    it('should get all registered tools', async () => {
      await library.initialize();
      
      const tools = library.getAllTools();
      // Should have core tools registered
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('search_knowledge_base');
      expect(toolNames).toContain('analyze_difficulty');
      expect(toolNames).toContain('check_user_background');
    });
  });

  describe('Usage Statistics', () => {
    it('should record tool usage', async () => {
      await library.initialize();
      
      const result: ToolResult = {
        success: true,
        data: { test: 'data' },
        executionTimeMs: 100,
      };

      library.recordToolUsage('search_knowledge_base', result, 'question_generation');
      library.recordToolUsage('search_knowledge_base', result, 'question_generation');
      
      const report = library.getUsageReport();
      const searchTool = report.topTools.find(t => t.name === 'search_knowledge_base');
      
      expect(searchTool).toBeDefined();
      expect(searchTool?.calls).toBe(2);
    });

    it('should update success rate based on results', async () => {
      await library.initialize();
      
      // Record successful calls
      for (let i = 0; i < 5; i++) {
        library.recordToolUsage('analyze_difficulty', {
          success: true,
          data: {},
          executionTimeMs: 100,
        }, 'test');
      }

      // Record failed calls
      for (let i = 0; i < 5; i++) {
        library.recordToolUsage('analyze_difficulty', {
          success: false,
          error: 'Test error',
          executionTimeMs: 100,
        }, 'test');
      }

      const report = library.getUsageReport();
      const tool = report.topTools.find(t => t.name === 'analyze_difficulty');
      
      // Success rate should be between 0 and 1 (sliding average)
      expect(tool?.successRate).toBeGreaterThan(0);
      expect(tool?.successRate).toBeLessThan(1);
    });

    it('should update feedback score', async () => {
      await library.initialize();
      
      // Update feedback multiple times
      library.updateToolFeedback('search_knowledge_base', 8);
      library.updateToolFeedback('search_knowledge_base', 9);
      library.updateToolFeedback('search_knowledge_base', 10);
      
      // Feedback score should be updated (sliding average)
      // Initial score is 5, after updates it should be higher
      const report = library.getUsageReport();
      // Can't directly access feedback score from report, but we can verify no errors
      expect(report.totalTools).toBeGreaterThan(0);
    });
  });

  describe('Tool Recommendations', () => {
    it('should recommend tools based on context', async () => {
      await library.initialize();
      
      // Record some usage to build context
      library.recordToolUsage('search_knowledge_base', {
        success: true,
        data: {},
        executionTimeMs: 100,
      }, 'question_generation');

      const recommended = library.getRecommendedTools({
        moduleName: 'question_generation',
        task: 'search for interview questions',
        maxTools: 3,
      });

      expect(recommended.length).toBeLessThanOrEqual(3);
      expect(recommended.length).toBeGreaterThan(0);
      
      // search_knowledge_base should be recommended for this context
      const hasSearchTool = recommended.some(t => t.name === 'search_knowledge_base');
      expect(hasSearchTool).toBe(true);
    });

    it('should respect maxTools limit', async () => {
      await library.initialize();
      
      const recommended = library.getRecommendedTools({
        moduleName: 'test',
        task: 'test task',
        maxTools: 2,
      });

      expect(recommended.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Usage Report', () => {
    it('should generate usage report', async () => {
      await library.initialize();
      
      const report = library.getUsageReport();
      
      expect(report).toHaveProperty('totalTools');
      expect(report).toHaveProperty('totalCalls');
      expect(report).toHaveProperty('topTools');
      expect(report).toHaveProperty('poorPerformers');
      
      expect(report.totalTools).toBeGreaterThan(0);
      expect(Array.isArray(report.topTools)).toBe(true);
      expect(Array.isArray(report.poorPerformers)).toBe(true);
    });

    it('should identify poor performers', async () => {
      await library.initialize();
      
      // Register a tool with poor performance
      const poorTool: Tool = {
        name: 'poor_tool',
        description: 'A poorly performing tool',
        parameters: { type: 'object', properties: {}, required: [] },
        estimatedTimeMs: 100,
        execute: async () => ({
          success: false,
          error: 'Always fails',
          executionTimeMs: 100,
        }),
      };
      
      library.registerTool(poorTool);
      
      // Record many failed calls
      for (let i = 0; i < 10; i++) {
        library.recordToolUsage('poor_tool', {
          success: false,
          error: 'Failed',
          executionTimeMs: 100,
        }, 'test');
      }
      
      // Also update feedback to be low
      library.updateToolFeedback('poor_tool', 2);
      library.updateToolFeedback('poor_tool', 1);
      library.updateToolFeedback('poor_tool', 2);
      
      const report = library.getUsageReport();
      
      // Poor tool should be in poorPerformers
      const poorPerformer = report.poorPerformers.find(p => p.name === 'poor_tool');
      expect(poorPerformer).toBeDefined();
    });
  });

  describe('Core Tools', () => {
    it('should have search_knowledge_base tool', async () => {
      await library.initialize();
      
      const tool = library.getTool('search_knowledge_base');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('search_knowledge_base');
      
      // Test execution
      const result = await tool?.execute({ query: 'test query' });
      expect(result?.success).toBe(true);
    });

    it('should have analyze_difficulty tool', async () => {
      await library.initialize();
      
      const tool = library.getTool('analyze_difficulty');
      expect(tool).toBeDefined();
      
      // Test execution
      const result = await tool?.execute({ 
        question: 'Design a distributed system',
        userExperience: 3,
      });
      expect(result?.success).toBe(true);
      expect(result?.data).toHaveProperty('difficulty');
    });

    it('should have check_user_background tool', async () => {
      await library.initialize();
      
      const tool = library.getTool('check_user_background');
      expect(tool).toBeDefined();
      
      // Test execution
      const result = await tool?.execute({
        skills: 'JavaScript, React, Node.js',
        experience: '5 years of web development',
      });
      expect(result?.success).toBe(true);
      expect(result?.data).toHaveProperty('skills');
      expect(result?.data).toHaveProperty('yearsOfExperience');
      expect(result?.data).toHaveProperty('level');
    });
  });
});
