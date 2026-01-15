/**
 * Tool Discovery and Auto-Creation System
 * 
 * 工具自动发现：搜索 npm/GitHub 找到可用工具
 * 工具自动创建：用 LLM 生成工具代码
 */

import { Tool, ToolResult } from '../types';
import { invokeLLM } from '../../../_core/llm';

// ==================== 工具注册表 ====================

interface RegisteredTool {
  tool: Tool;
  version: string;
  source: 'builtin' | 'discovered' | 'generated';
  createdAt: Date;
  usageCount: number;
  successRate: number;
}

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private static instance: ToolRegistry;

  private constructor() {
    // 单例模式
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  register(tool: Tool, source: 'builtin' | 'discovered' | 'generated', version: string = '1.0.0'): void {
    this.tools.set(tool.name, {
      tool,
      version,
      source,
      createdAt: new Date(),
      usageCount: 0,
      successRate: 1.0,
    });
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values()).map(r => r.tool);
  }

  recordUsage(name: string, success: boolean): void {
    const registered = this.tools.get(name);
    if (registered) {
      registered.usageCount++;
      // 更新成功率（滑动平均）
      const alpha = 0.1;
      registered.successRate = registered.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    }
  }

  getStats(): Array<{ name: string; usageCount: number; successRate: number; source: string }> {
    return Array.from(this.tools.entries()).map(([name, r]) => ({
      name,
      usageCount: r.usageCount,
      successRate: r.successRate,
      source: r.source,
    }));
  }
}

export const toolRegistry = ToolRegistry.getInstance();

// ==================== 工具发现 ====================

interface DiscoveredToolInfo {
  name: string;
  description: string;
  source: 'npm' | 'github';
  url: string;
  relevanceScore: number;
}

/**
 * 搜索 npm 包
 */
async function searchNpm(query: string): Promise<DiscoveredToolInfo[]> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    return (data.objects || []).map((obj: { package: { name: string; description: string; links: { npm: string } }; score: { final: number } }) => ({
      name: obj.package.name,
      description: obj.package.description || '',
      source: 'npm' as const,
      url: obj.package.links?.npm || `https://www.npmjs.com/package/${obj.package.name}`,
      relevanceScore: obj.score?.final || 0.5,
    }));
  } catch (error) {
    console.error('[ToolDiscovery] npm search failed:', error);
    return [];
  }
}

/**
 * 搜索 GitHub 仓库
 */
async function searchGitHub(query: string): Promise<DiscoveredToolInfo[]> {
  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+language:typescript&sort=stars&per_page=5`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'UHired-ToolDiscovery',
        },
      }
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    return (data.items || []).map((item: { name: string; description: string; html_url: string; stargazers_count: number }) => ({
      name: item.name,
      description: item.description || '',
      source: 'github' as const,
      url: item.html_url,
      relevanceScore: Math.min(1, item.stargazers_count / 10000),
    }));
  } catch (error) {
    console.error('[ToolDiscovery] GitHub search failed:', error);
    return [];
  }
}

/**
 * 发现相关工具
 */
export async function discoverTools(
  taskDescription: string,
  existingTools: string[]
): Promise<DiscoveredToolInfo[]> {
  // 使用 LLM 生成搜索关键词
  const keywordsResponse = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: 'You are a tool discovery assistant. Generate 2-3 search keywords for finding npm packages or GitHub repositories that could help with the given task. Return only the keywords, one per line.',
      },
      {
        role: 'user',
        content: `Task: ${taskDescription}\n\nExisting tools: ${existingTools.join(', ')}\n\nGenerate search keywords for finding helpful tools:`,
      },
    ],
  });

  const keywordsContent = keywordsResponse.choices[0]?.message?.content;
  if (!keywordsContent || typeof keywordsContent !== 'string') {
    return [];
  }
  
  const keywords = keywordsContent.split('\n').filter(k => k.trim()).slice(0, 3);
  
  // 并行搜索
  const results: DiscoveredToolInfo[] = [];
  
  for (const keyword of keywords) {
    const [npmResults, githubResults] = await Promise.all([
      searchNpm(keyword),
      searchGitHub(keyword),
    ]);
    
    results.push(...npmResults, ...githubResults);
  }
  
  // 去重并排序
  const uniqueResults = results.reduce((acc, item) => {
    if (!acc.find(r => r.name === item.name)) {
      acc.push(item);
    }
    return acc;
  }, [] as DiscoveredToolInfo[]);
  
  return uniqueResults.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
}

// ==================== 工具自动创建 ====================

interface GeneratedToolCode {
  name: string;
  code: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * 使用 LLM 生成工具代码
 */
export async function generateToolCode(
  toolDescription: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>
): Promise<GeneratedToolCode | null> {
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are a TypeScript tool generator. Generate a tool implementation that follows this interface:

interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  estimatedTimeMs: number;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
}

Return ONLY valid TypeScript code that exports the tool. No explanations.`,
      },
      {
        role: 'user',
        content: `Generate a tool with:
Description: ${toolDescription}
Input Schema: ${JSON.stringify(inputSchema, null, 2)}
Expected Output: ${JSON.stringify(outputSchema, null, 2)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    return null;
  }

  // 提取代码块
  const codeMatch = content.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : content.trim();

  // 提取工具名称
  const nameMatch = code.match(/name:\s*['"]([^'"]+)['"]/);
  const name = nameMatch ? nameMatch[1] : 'generated_tool';

  // 提取描述
  const descMatch = code.match(/description:\s*['"]([^'"]+)['"]/);
  const description = descMatch ? descMatch[1] : toolDescription;

  return {
    name,
    code,
    description,
    parameters: inputSchema,
  };
}

/**
 * 动态创建工具（从生成的代码）
 */
export function createToolFromCode(generatedCode: GeneratedToolCode): Tool | null {
  try {
    // 安全警告：在生产环境中，应该对生成的代码进行沙箱执行
    // 这里使用一个简化的实现，仅用于演示
    
    // 创建一个基础的工具实现
    const tool: Tool = {
      name: generatedCode.name,
      description: generatedCode.description,
      parameters: {
        type: 'object',
        properties: Object.entries(generatedCode.parameters).reduce((acc, [key, value]) => {
          acc[key] = {
            type: typeof value === 'string' ? value : 'string',
            description: `Parameter: ${key}`,
          };
          return acc;
        }, {} as Record<string, { type: string; description: string }>),
        required: Object.keys(generatedCode.parameters),
      },
      estimatedTimeMs: 1000,
      execute: async (params): Promise<ToolResult> => {
        const startTime = Date.now();
        try {
          // 这里应该执行生成的代码
          // 在实际实现中，需要使用 vm2 或类似的沙箱
          return {
            success: true,
            data: { message: 'Tool executed', params },
            executionTimeMs: Date.now() - startTime,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Execution failed',
            executionTimeMs: Date.now() - startTime,
          };
        }
      },
    };

    // 注册工具
    toolRegistry.register(tool, 'generated');

    return tool;
  } catch (error) {
    console.error('[ToolDiscovery] Failed to create tool from code:', error);
    return null;
  }
}

// ==================== 工具发现 Agent 工具 ====================

/**
 * 工具发现工具 - 让 Agent 能搜索新工具
 */
export const discoverToolsTool: Tool = {
  name: 'discover_tools',
  description: 'Search npm and GitHub for tools that could help with a specific task',
  parameters: {
    type: 'object',
    properties: {
      taskDescription: {
        type: 'string',
        description: 'Description of the task that needs a tool',
      },
      existingTools: {
        type: 'string',
        description: 'JSON array of existing tool names to avoid duplicates',
      },
    },
    required: ['taskDescription'],
  },
  estimatedTimeMs: 5000,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { taskDescription, existingTools } = params as {
        taskDescription: string;
        existingTools?: string;
      };

      let existing: string[] = [];
      if (existingTools) {
        try {
          existing = JSON.parse(existingTools);
        } catch {
          existing = [];
        }
      }

      const tools = await discoverTools(taskDescription, existing);

      return {
        success: true,
        data: {
          discoveredTools: tools,
          count: tools.length,
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * 工具创建工具 - 让 Agent 能生成新工具
 */
export const generateToolTool: Tool = {
  name: 'generate_tool',
  description: 'Generate a new tool using LLM based on description and schemas',
  parameters: {
    type: 'object',
    properties: {
      toolDescription: {
        type: 'string',
        description: 'Description of what the tool should do',
      },
      inputSchema: {
        type: 'string',
        description: 'JSON schema for tool input parameters',
      },
      outputSchema: {
        type: 'string',
        description: 'JSON schema for expected tool output',
      },
    },
    required: ['toolDescription', 'inputSchema', 'outputSchema'],
  },
  estimatedTimeMs: 10000,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { toolDescription, inputSchema, outputSchema } = params as {
        toolDescription: string;
        inputSchema: string;
        outputSchema: string;
      };

      let input: Record<string, unknown>;
      let output: Record<string, unknown>;
      
      try {
        input = JSON.parse(inputSchema);
        output = JSON.parse(outputSchema);
      } catch {
        return {
          success: false,
          error: 'Invalid JSON schema',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const generated = await generateToolCode(toolDescription, input, output);

      if (!generated) {
        return {
          success: false,
          error: 'Failed to generate tool code',
          executionTimeMs: Date.now() - startTime,
        };
      }

      const tool = createToolFromCode(generated);

      return {
        success: true,
        data: {
          toolName: generated.name,
          description: generated.description,
          registered: !!tool,
          code: generated.code.slice(0, 500) + '...', // 截断以避免过长
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * 列出已注册工具
 */
export const listRegisteredToolsTool: Tool = {
  name: 'list_registered_tools',
  description: 'List all registered tools with their usage statistics',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  estimatedTimeMs: 100,
  execute: async (): Promise<ToolResult> => {
    const startTime = Date.now();
    const stats = toolRegistry.getStats();
    
    return {
      success: true,
      data: {
        tools: stats,
        totalCount: stats.length,
      },
      executionTimeMs: Date.now() - startTime,
    };
  },
};

/**
 * 工具发现系统的所有工具
 */
export const toolDiscoveryTools: Tool[] = [
  discoverToolsTool,
  generateToolTool,
  listRegisteredToolsTool,
];
