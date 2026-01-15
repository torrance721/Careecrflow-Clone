/**
 * Tool Library for Agent Loop
 * 
 * 在 Agent Loop 中动态发现、创建和管理工具
 * 支持基于反馈自动优化工具选择
 */

import { Tool, ToolResult } from '../react/types';
import { 
  toolRegistry, 
  discoverTools, 
  generateToolCode, 
  createToolFromCode,
} from '../react/tools/toolDiscovery';

// 本地定义 DiscoveredTool 类型
interface DiscoveredTool {
  name: string;
  description: string;
  source: 'npm' | 'github';
  url: string;
  relevanceScore: number;
}
import { invokeLLM } from '../../_core/llm';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 类型定义 ====================

export interface ToolUsageStats {
  toolName: string;
  totalCalls: number;
  successRate: number;
  averageExecutionTimeMs: number;
  lastUsed: number;
  feedbackScore: number;  // 基于用户反馈的评分
  contexts: string[];     // 使用该工具的上下文
}

export interface ToolLibraryConfig {
  // 自动发现
  enableAutoDiscovery: boolean;
  discoveryInterval: number;  // 毫秒
  maxDiscoveredTools: number;
  
  // 自动创建
  enableAutoCreation: boolean;
  creationThreshold: number;  // 需要多少次失败才触发创建
  
  // 优化
  enableOptimization: boolean;
  optimizationInterval: number;
  minUsageForOptimization: number;
  
  // 存储
  persistPath: string;
}

export interface ToolLibraryState {
  tools: Map<string, Tool>;
  usageStats: Map<string, ToolUsageStats>;
  discoveredTools: DiscoveredTool[];
  pendingCreations: Array<{
    description: string;
    failureCount: number;
    contexts: string[];
  }>;
  lastDiscovery: number;
  lastOptimization: number;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: ToolLibraryConfig = {
  enableAutoDiscovery: true,
  discoveryInterval: 3600000,  // 1 hour
  maxDiscoveredTools: 50,
  
  enableAutoCreation: true,
  creationThreshold: 3,
  
  enableOptimization: true,
  optimizationInterval: 1800000,  // 30 minutes
  minUsageForOptimization: 10,
  
  persistPath: '/home/ubuntu/UHWeb/data/tool-library',
};

// ==================== Tool Library 类 ====================

export class ToolLibrary {
  private config: ToolLibraryConfig;
  private state: ToolLibraryState;
  private initialized: boolean = false;

  constructor(config: Partial<ToolLibraryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      tools: new Map(),
      usageStats: new Map(),
      discoveredTools: [],
      pendingCreations: [],
      lastDiscovery: 0,
      lastOptimization: 0,
    };
  }

  /**
   * 初始化工具库
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 确保存储目录存在
    if (!fs.existsSync(this.config.persistPath)) {
      fs.mkdirSync(this.config.persistPath, { recursive: true });
    }

    // 加载持久化状态
    await this.loadState();

    // 注册核心工具
    this.registerCoreTools();

    this.initialized = true;
    console.log(`[ToolLibrary] Initialized with ${this.state.tools.size} tools`);
  }

  /**
   * 注册核心工具（始终可用）
   */
  private registerCoreTools(): void {
    // 知识库搜索工具
    this.registerTool({
      name: 'search_knowledge_base',
      description: 'Search the interview knowledge base for relevant questions and tips',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          company: { type: 'string', description: 'Company name (optional)' },
          position: { type: 'string', description: 'Position (optional)' },
        },
        required: ['query'],
      },
      estimatedTimeMs: 500,
      execute: async (params): Promise<ToolResult> => {
        const startTime = Date.now();
        // 实际实现会调用知识库服务
        return {
          success: true,
          data: { results: [], message: 'Search completed' },
          executionTimeMs: Date.now() - startTime,
        };
      },
    });

    // 难度分析工具
    this.registerTool({
      name: 'analyze_difficulty',
      description: 'Analyze the difficulty level of a question based on user background',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to analyze' },
          userExperience: { type: 'number', description: 'Years of experience' },
        },
        required: ['question'],
      },
      estimatedTimeMs: 200,
      execute: async (params): Promise<ToolResult> => {
        const startTime = Date.now();
        const { question, userExperience = 0 } = params as { question: string; userExperience?: number };
        
        // 简单的难度评估逻辑
        let difficulty = 'Medium';
        if (question.toLowerCase().includes('system design') || question.toLowerCase().includes('architecture')) {
          difficulty = userExperience >= 5 ? 'Medium' : 'Hard';
        } else if (question.toLowerCase().includes('basic') || question.toLowerCase().includes('简单')) {
          difficulty = 'Easy';
        }
        
        return {
          success: true,
          data: { difficulty, confidence: 0.8 },
          executionTimeMs: Date.now() - startTime,
        };
      },
    });

    // 用户背景检查工具
    this.registerTool({
      name: 'check_user_background',
      description: 'Check user background and skills to personalize questions',
      parameters: {
        type: 'object',
        properties: {
          skills: { type: 'string', description: 'User skills (comma separated)' },
          experience: { type: 'string', description: 'User experience description' },
        },
        required: [],
      },
      estimatedTimeMs: 100,
      execute: async (params): Promise<ToolResult> => {
        const startTime = Date.now();
        const { skills = '', experience = '' } = params as { skills?: string; experience?: string };
        
        const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
        const yearsMatch = experience.match(/(\d+)\s*(年|years?)/i);
        const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
        
        return {
          success: true,
          data: {
            skills: skillList,
            yearsOfExperience: years,
            level: years >= 5 ? 'Senior' : years >= 2 ? 'Mid' : 'Junior',
          },
          executionTimeMs: Date.now() - startTime,
        };
      },
    });
  }

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.state.tools.set(tool.name, tool);
    
    // 初始化使用统计
    if (!this.state.usageStats.has(tool.name)) {
      this.state.usageStats.set(tool.name, {
        toolName: tool.name,
        totalCalls: 0,
        successRate: 1,
        averageExecutionTimeMs: tool.estimatedTimeMs || 500,
        lastUsed: 0,
        feedbackScore: 5,
        contexts: [],
      });
    }
  }

  /**
   * 获取工具
   */
  getTool(name: string): Tool | undefined {
    return this.state.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAllTools(): Tool[] {
    return Array.from(this.state.tools.values());
  }

  /**
   * 获取推荐工具（基于上下文和使用统计）
   */
  getRecommendedTools(context: {
    moduleName: string;
    task: string;
    maxTools?: number;
  }): Tool[] {
    const { moduleName, task, maxTools = 5 } = context;
    
    const tools = this.getAllTools();
    
    // 计算每个工具的推荐分数
    const scoredTools = tools.map(tool => {
      const stats = this.state.usageStats.get(tool.name);
      let score = 0;
      
      // 基于成功率
      score += (stats?.successRate || 0.5) * 30;
      
      // 基于反馈评分
      score += (stats?.feedbackScore || 5) * 10;
      
      // 基于上下文匹配
      if (stats?.contexts.includes(moduleName)) {
        score += 20;
      }
      
      // 基于任务描述匹配
      if (tool.description.toLowerCase().includes(task.toLowerCase().slice(0, 20))) {
        score += 15;
      }
      
      // 基于执行时间（快的工具加分）
      if ((stats?.averageExecutionTimeMs || 1000) < 500) {
        score += 5;
      }
      
      return { tool, score };
    });
    
    // 排序并返回前 N 个
    return scoredTools
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTools)
      .map(s => s.tool);
  }

  /**
   * 记录工具使用
   */
  recordToolUsage(
    toolName: string, 
    result: ToolResult, 
    context: string
  ): void {
    const stats = this.state.usageStats.get(toolName);
    if (!stats) return;

    stats.totalCalls += 1;
    stats.lastUsed = Date.now();
    
    // 更新成功率（滑动平均）
    const alpha = 0.1;
    stats.successRate = alpha * (result.success ? 1 : 0) + (1 - alpha) * stats.successRate;
    
    // 更新平均执行时间
    stats.averageExecutionTimeMs = alpha * result.executionTimeMs + (1 - alpha) * stats.averageExecutionTimeMs;
    
    // 记录上下文
    if (!stats.contexts.includes(context)) {
      stats.contexts.push(context);
      if (stats.contexts.length > 10) {
        stats.contexts.shift();
      }
    }
  }

  /**
   * 更新工具反馈评分
   */
  updateToolFeedback(toolName: string, score: number): void {
    const stats = this.state.usageStats.get(toolName);
    if (!stats) return;

    // 滑动平均更新
    const alpha = 0.2;
    stats.feedbackScore = alpha * score + (1 - alpha) * stats.feedbackScore;
  }

  /**
   * 自动发现新工具
   */
  async autoDiscoverTools(needs: string[]): Promise<DiscoveredTool[]> {
    if (!this.config.enableAutoDiscovery) return [];
    
    const now = Date.now();
    if (now - this.state.lastDiscovery < this.config.discoveryInterval) {
      return this.state.discoveredTools;
    }

    console.log('[ToolLibrary] Starting auto-discovery...');
    
    const newTools: DiscoveredTool[] = [];
    
    for (const need of needs) {
      try {
        const discovered = await discoverTools(need, []);
        newTools.push(...discovered);
      } catch (error) {
        console.error(`[ToolLibrary] Discovery failed for "${need}":`, error);
      }
    }

    // 去重并限制数量
    const uniqueTools = newTools.filter(
      (tool, index, self) => 
        index === self.findIndex(t => t.name === tool.name)
    ).slice(0, this.config.maxDiscoveredTools);

    this.state.discoveredTools = uniqueTools;
    this.state.lastDiscovery = now;

    console.log(`[ToolLibrary] Discovered ${uniqueTools.length} tools`);
    
    return uniqueTools;
  }

  /**
   * 自动创建缺失的工具
   */
  async autoCreateTool(description: string, context: string): Promise<Tool | null> {
    if (!this.config.enableAutoCreation) return null;

    // 检查是否已有待创建记录
    let pending = this.state.pendingCreations.find(p => p.description === description);
    
    if (!pending) {
      pending = { description, failureCount: 1, contexts: [context] };
      this.state.pendingCreations.push(pending);
    } else {
      pending.failureCount += 1;
      if (!pending.contexts.includes(context)) {
        pending.contexts.push(context);
      }
    }

    // 检查是否达到创建阈值
    if (pending.failureCount < this.config.creationThreshold) {
      return null;
    }

    console.log(`[ToolLibrary] Auto-creating tool for: ${description}`);

    try {
      // 生成工具代码
      const code = await generateToolCode(
        description, 
        { context: { type: 'string', description: 'Context information' } },
        { result: { type: 'string', description: 'Tool result' } }
      );
      
      if (!code) {
        console.error('[ToolLibrary] Failed to generate tool code');
        return null;
      }

      // 创建工具
      const tool = createToolFromCode(code);
      
      if (!tool) {
        console.error('[ToolLibrary] Failed to create tool from code');
        return null;
      }

      // 注册工具
      this.registerTool(tool);
      
      // 移除待创建记录
      this.state.pendingCreations = this.state.pendingCreations.filter(
        p => p.description !== description
      );

      console.log(`[ToolLibrary] Successfully created tool: ${tool.name}`);
      
      return tool;
    } catch (error) {
      console.error('[ToolLibrary] Auto-creation failed:', error);
      return null;
    }
  }

  /**
   * 优化工具选择（基于使用统计）
   */
  async optimizeToolSelection(): Promise<void> {
    if (!this.config.enableOptimization) return;

    const now = Date.now();
    if (now - this.state.lastOptimization < this.config.optimizationInterval) {
      return;
    }

    console.log('[ToolLibrary] Starting tool optimization...');

    // 找出表现差的工具
    const poorPerformers: string[] = [];
    
    const entries = Array.from(this.state.usageStats.entries());
    for (const [name, stats] of entries) {
      if (stats.totalCalls >= this.config.minUsageForOptimization) {
        if (stats.successRate < 0.5 || stats.feedbackScore < 4) {
          poorPerformers.push(name);
        }
      }
    }

    if (poorPerformers.length > 0) {
      console.log(`[ToolLibrary] Found ${poorPerformers.length} poor performing tools: ${poorPerformers.join(', ')}`);
      
      // 尝试发现替代工具
      for (const toolName of poorPerformers) {
        const tool = this.state.tools.get(toolName);
        if (tool) {
          await this.autoDiscoverTools([tool.description]);
        }
      }
    }

    this.state.lastOptimization = now;
  }

  /**
   * 获取工具使用报告
   */
  getUsageReport(): {
    totalTools: number;
    totalCalls: number;
    topTools: Array<{ name: string; calls: number; successRate: number }>;
    poorPerformers: Array<{ name: string; successRate: number; feedbackScore: number }>;
  } {
    const stats = Array.from(this.state.usageStats.values());
    
    const totalCalls = stats.reduce((sum, s) => sum + s.totalCalls, 0);
    
    const topTools = stats
      .filter(s => s.totalCalls > 0)
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, 5)
      .map(s => ({
        name: s.toolName,
        calls: s.totalCalls,
        successRate: s.successRate,
      }));

    const poorPerformers = stats
      .filter(s => s.totalCalls >= 5 && (s.successRate < 0.5 || s.feedbackScore < 4))
      .map(s => ({
        name: s.toolName,
        successRate: s.successRate,
        feedbackScore: s.feedbackScore,
      }));

    return {
      totalTools: this.state.tools.size,
      totalCalls,
      topTools,
      poorPerformers,
    };
  }

  /**
   * 保存状态
   */
  async saveState(): Promise<void> {
    const statePath = path.join(this.config.persistPath, 'state.json');
    
    const serializable = {
      usageStats: Array.from(this.state.usageStats.entries()),
      discoveredTools: this.state.discoveredTools,
      pendingCreations: this.state.pendingCreations,
      lastDiscovery: this.state.lastDiscovery,
      lastOptimization: this.state.lastOptimization,
    };

    fs.writeFileSync(statePath, JSON.stringify(serializable, null, 2));
  }

  /**
   * 加载状态
   */
  private async loadState(): Promise<void> {
    const statePath = path.join(this.config.persistPath, 'state.json');
    
    if (!fs.existsSync(statePath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      
      if (data.usageStats) {
        this.state.usageStats = new Map(data.usageStats);
      }
      if (data.discoveredTools) {
        this.state.discoveredTools = data.discoveredTools;
      }
      if (data.pendingCreations) {
        this.state.pendingCreations = data.pendingCreations;
      }
      if (data.lastDiscovery) {
        this.state.lastDiscovery = data.lastDiscovery;
      }
      if (data.lastOptimization) {
        this.state.lastOptimization = data.lastOptimization;
      }
      
      console.log('[ToolLibrary] State loaded successfully');
    } catch (error) {
      console.error('[ToolLibrary] Failed to load state:', error);
    }
  }
}

// ==================== 单例实例 ====================

let toolLibraryInstance: ToolLibrary | null = null;

export function getToolLibrary(): ToolLibrary {
  if (!toolLibraryInstance) {
    toolLibraryInstance = new ToolLibrary();
  }
  return toolLibraryInstance;
}

export async function initializeToolLibrary(
  config?: Partial<ToolLibraryConfig>
): Promise<ToolLibrary> {
  toolLibraryInstance = new ToolLibrary(config);
  await toolLibraryInstance.initialize();
  return toolLibraryInstance;
}
