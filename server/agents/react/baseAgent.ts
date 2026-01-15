/**
 * ReAct Agent Base Class
 * 
 * 实现 ReAct（Reasoning + Acting）模式的基础框架
 * 思考 → 行动 → 观察 → 继续思考
 */

import { invokeLLM } from '../../_core/llm';
import { 
  ReActConfig, 
  Tool, 
  ToolResult, 
  ThoughtStep, 
  ReActTrace, 
  AgentState, 
  AgentResult 
} from './types';
import { TimeBudgetManager, createTimeBudget } from './timeBudgetManager';
import { MultiGrader, createMultiGrader } from './multiGrader';

/**
 * ReAct Agent 基础类
 */
export abstract class BaseReActAgent<TInput, TOutput> {
  protected config: ReActConfig;
  protected timeBudget: TimeBudgetManager;
  protected grader: MultiGrader;
  protected tools: Map<string, Tool>;

  constructor(config: ReActConfig) {
    this.config = config;
    this.timeBudget = createTimeBudget(config.moduleName, config.timeBudget);
    this.grader = createMultiGrader(config.moduleName);
    this.tools = new Map(config.tools.map(t => [t.name, t]));
  }

  /**
   * 子类必须实现：构建系统 Prompt
   */
  protected abstract buildSystemPrompt(input: TInput, context: Record<string, unknown>): string;

  /**
   * 子类必须实现：解析最终输出
   */
  protected abstract parseOutput(thought: string, trace: ReActTrace): TOutput | null;

  /**
   * 子类可选实现：获取初始上下文
   */
  protected async getInitialContext(_input: TInput): Promise<Record<string, unknown>> {
    return {};
  }

  /**
   * 构建工具描述
   */
  private buildToolsDescription(): string {
    if (this.tools.size === 0) return 'No tools available.';
    
    const toolDescriptions = Array.from(this.tools.values()).map(tool => {
      const params = Object.entries(tool.parameters.properties)
        .map(([name, prop]) => `    - ${name}: ${prop.description}`)
        .join('\n');
      return `- ${tool.name}: ${tool.description}\n  Parameters:\n${params}`;
    });
    
    return `Available tools:\n${toolDescriptions.join('\n\n')}`;
  }

  /**
   * 执行工具
   */
  private async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found`,
        executionTimeMs: Date.now() - startTime,
      };
    }
    
    try {
      const result = await tool.execute(params);
      return {
        ...result,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 解析 LLM 响应中的思考和行动
   */
  private parseThoughtAndAction(response: string): {
    thought: string;
    action?: { tool: string; params: Record<string, unknown> };
    isFinal: boolean;
  } {
    // 提取 Thought
    const thoughtMatch = response.match(/Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i);
    const thought = thoughtMatch ? thoughtMatch[1].trim() : response;
    
    // 检查是否是最终答案
    const finalMatch = response.match(/Final Answer:\s*([\s\S]*?)$/i);
    if (finalMatch) {
      return { thought: finalMatch[1].trim(), isFinal: true };
    }
    
    // 提取 Action
    const actionMatch = response.match(/Action:\s*(\w+)\s*\nAction Input:\s*(\{[\s\S]*?\})/i);
    if (actionMatch) {
      try {
        const params = JSON.parse(actionMatch[2]);
        return {
          thought,
          action: { tool: actionMatch[1], params },
          isFinal: false,
        };
      } catch {
        // JSON 解析失败，继续思考
      }
    }
    
    // 没有明确的 action，检查是否应该结束
    const shouldEnd = thought.toLowerCase().includes('i have enough information') ||
                      thought.toLowerCase().includes('final answer') ||
                      thought.toLowerCase().includes('我已经有足够的信息');
    
    return { thought, isFinal: shouldEnd };
  }

  /**
   * 执行 ReAct 循环
   */
  async execute(input: TInput): Promise<AgentResult<TOutput>> {
    this.timeBudget.reset();
    
    const trace: ReActTrace = {
      steps: [],
      totalTimeMs: 0,
      earlyStop: false,
    };
    
    const context = await this.getInitialContext(input);
    const systemPrompt = this.buildSystemPrompt(input, context);
    const toolsDescription = this.buildToolsDescription();
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: `${systemPrompt}

${toolsDescription}

You are a ReAct agent. Follow this format:

Thought: [Your reasoning about what to do next]
Action: [Tool name to use]
Action Input: [JSON parameters for the tool]

After receiving the observation, continue with:
Thought: [Your reasoning based on the observation]
...

When you have enough information, respond with:
Final Answer: [Your final response in the required format]

Time Budget: You have ${this.timeBudget.getRemainingMs()}ms remaining. Be efficient.`,
      },
      { role: 'user', content: 'Begin your analysis.' },
    ];
    
    let currentStep = 0;
    const maxSteps = this.timeBudget.getRecommendedMaxSteps();
    
    while (currentStep < maxSteps && !this.timeBudget.isExpired()) {
      currentStep++;
      const stepStartTime = Date.now();
      
      this.timeBudget.checkpoint(`step_${currentStep}_start`);
      
      try {
        // 调用 LLM
        const response = await this.timeBudget.withTimeout(
          invokeLLM({ messages }),
          null
        );
        
        if (!response) {
          trace.earlyStop = true;
          trace.earlyStopReason = 'LLM timeout';
          break;
        }
        
        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          trace.earlyStop = true;
          trace.earlyStopReason = 'Invalid LLM response';
          break;
        }
        
        // 解析思考和行动
        const { thought, action, isFinal } = this.parseThoughtAndAction(content);
        
        const step: ThoughtStep = {
          step: currentStep,
          thought,
          timeSpentMs: Date.now() - stepStartTime,
        };
        
        // 如果是最终答案
        if (isFinal) {
          trace.steps.push(step);
          trace.finalAnswer = thought;
          break;
        }
        
        // 如果有行动
        if (action) {
          step.action = action;
          
          // 检查是否有时间执行工具
          const tool = this.tools.get(action.tool);
          const estimatedTime = tool?.estimatedTimeMs || 2000;
          
          if (!this.timeBudget.hasTimeFor(estimatedTime)) {
            trace.earlyStop = true;
            trace.earlyStopReason = 'Not enough time for tool execution';
            trace.steps.push(step);
            break;
          }
          
          // 执行工具
          const result = await this.executeTool(action.tool, action.params);
          step.observation = result.success 
            ? JSON.stringify(result.data, null, 2)
            : `Error: ${result.error}`;
          
          // 添加观察结果到消息
          messages.push({ role: 'assistant', content });
          messages.push({ 
            role: 'user', 
            content: `Observation: ${step.observation}\n\nRemaining time: ${this.timeBudget.getRemainingMs()}ms. Continue your analysis.` 
          });
        } else {
          // 没有行动，继续思考
          messages.push({ role: 'assistant', content });
          messages.push({ 
            role: 'user', 
            content: `Continue your analysis. Remaining time: ${this.timeBudget.getRemainingMs()}ms.` 
          });
        }
        
        trace.steps.push(step);
        
        // 检查是否应该提前停止
        if (this.timeBudget.isNearTimeout()) {
          // 强制要求最终答案
          messages.push({
            role: 'user',
            content: 'Time is running out. Please provide your Final Answer now.',
          });
        }
        
      } catch (error) {
        console.error(`[${this.config.moduleName}] Step ${currentStep} error:`, error);
        trace.earlyStop = true;
        trace.earlyStopReason = error instanceof Error ? error.message : 'Unknown error';
        break;
      }
    }
    
    trace.totalTimeMs = this.timeBudget.getElapsedMs();
    
    // 解析输出
    const lastThought = trace.steps[trace.steps.length - 1]?.thought || '';
    const output = this.parseOutput(trace.finalAnswer as string || lastThought, trace);
    
    // 评估质量
    let grade;
    if (output && this.config.quality.minScore !== undefined) {
      grade = await this.grader.evaluate(output, context);
    }
    
    return {
      success: output !== null,
      output: output || undefined,
      trace,
      grade,
      error: output === null ? 'Failed to generate valid output' : undefined,
    };
  }
}
