/**
 * Streaming ReAct Agent Base Class
 * 
 * 支持实时流式输出思考过程的 ReAct Agent 基类
 */

import { invokeLLM } from '../../_core/llm';
import { 
  ReActConfig, 
  Tool, 
  ToolResult, 
  ThoughtStep, 
  ReActTrace, 
  AgentResult 
} from './types';
import { TimeBudgetManager, createTimeBudget } from './timeBudgetManager';
import { MultiGrader, createMultiGrader } from './multiGrader';
import {
  StreamCallback,
  StreamEvent,
  StreamingStep,
  createStreamEvent,
  getToolDisplayName,
  AgentStartEvent,
  StepStartEvent,
  ThoughtEvent,
  ActionStartEvent,
  ActionCompleteEvent,
  StepCompleteEvent,
  AgentCompleteEvent,
  ErrorEvent,
} from './streamingTypes';

/**
 * 支持流式输出的 ReAct Agent 基础类
 */
export abstract class StreamingBaseReActAgent<TInput, TOutput> {
  protected config: ReActConfig;
  protected timeBudget: TimeBudgetManager;
  protected grader: MultiGrader;
  protected tools: Map<string, Tool>;
  protected streamCallback?: StreamCallback;
  protected streamingSteps: StreamingStep[] = [];

  constructor(config: ReActConfig) {
    this.config = config;
    this.timeBudget = createTimeBudget(config.moduleName, config.timeBudget);
    this.grader = createMultiGrader(config.moduleName);
    this.tools = new Map(config.tools.map(t => [t.name, t]));
  }

  /**
   * 设置流式输出回调
   */
  setStreamCallback(callback: StreamCallback): void {
    this.streamCallback = callback;
  }

  /**
   * 发送流式事件
   */
  protected emit(event: StreamEvent): void {
    if (this.streamCallback) {
      this.streamCallback(event);
    }
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
   * 子类必须实现：获取 Agent 描述
   */
  protected abstract getAgentDescription(): string;

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
   * 生成唯一的步骤 ID
   */
  private generateStepId(stepNumber: number): string {
    return `${this.config.moduleName}_step_${stepNumber}_${Date.now()}`;
  }

  /**
   * 执行 ReAct 循环（支持流式输出）
   */
  async execute(input: TInput): Promise<AgentResult<TOutput>> {
    this.timeBudget.reset();
    this.streamingSteps = [];
    
    const trace: ReActTrace = {
      steps: [],
      totalTimeMs: 0,
      earlyStop: false,
    };
    
    const context = await this.getInitialContext(input);
    const systemPrompt = this.buildSystemPrompt(input, context);
    const toolsDescription = this.buildToolsDescription();
    
    // 发送 Agent 开始事件
    this.emit(createStreamEvent<AgentStartEvent>('agent_start', this.config.moduleName, {
      totalSteps: this.timeBudget.getRecommendedMaxSteps(),
      description: this.getAgentDescription(),
    }));
    
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
      const stepId = this.generateStepId(currentStep);
      
      // 发送步骤开始事件
      this.emit(createStreamEvent<StepStartEvent>('step_start', this.config.moduleName, {
        stepId,
        stepNumber: currentStep,
      }));
      
      const streamingStep: StreamingStep = {
        id: stepId,
        step: currentStep,
        status: 'running',
        startTime: stepStartTime,
      };
      this.streamingSteps.push(streamingStep);
      
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
          streamingStep.status = 'error';
          streamingStep.error = 'LLM timeout';
          this.emit(createStreamEvent<ErrorEvent>('error', this.config.moduleName, {
            stepId,
            error: 'LLM timeout',
            recoverable: false,
          }));
          break;
        }
        
        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          trace.earlyStop = true;
          trace.earlyStopReason = 'Invalid LLM response';
          streamingStep.status = 'error';
          streamingStep.error = 'Invalid LLM response';
          this.emit(createStreamEvent<ErrorEvent>('error', this.config.moduleName, {
            stepId,
            error: 'Invalid LLM response',
            recoverable: false,
          }));
          break;
        }
        
        // 解析思考和行动
        const { thought, action, isFinal } = this.parseThoughtAndAction(content);
        
        // 发送思考事件
        streamingStep.thought = thought;
        this.emit(createStreamEvent<ThoughtEvent>('thought', this.config.moduleName, {
          stepId,
          thought,
          isPartial: false,
        }));
        
        const step: ThoughtStep = {
          step: currentStep,
          thought,
          timeSpentMs: Date.now() - stepStartTime,
        };
        
        // 如果是最终答案
        if (isFinal) {
          streamingStep.status = 'completed';
          streamingStep.endTime = Date.now();
          streamingStep.durationMs = streamingStep.endTime - streamingStep.startTime;
          
          this.emit(createStreamEvent<StepCompleteEvent>('step_complete', this.config.moduleName, {
            stepId,
            stepNumber: currentStep,
            durationMs: streamingStep.durationMs,
          }));
          
          trace.steps.push(step);
          trace.finalAnswer = thought;
          break;
        }
        
        // 如果有行动
        if (action) {
          step.action = action;
          streamingStep.action = {
            tool: action.tool,
            toolDisplayName: getToolDisplayName(action.tool),
            params: action.params,
          };
          
          // 发送行动开始事件
          this.emit(createStreamEvent<ActionStartEvent>('action_start', this.config.moduleName, {
            stepId,
            tool: action.tool,
            toolDisplayName: getToolDisplayName(action.tool),
            params: action.params,
          }));
          
          // 检查是否有时间执行工具
          const tool = this.tools.get(action.tool);
          const estimatedTime = tool?.estimatedTimeMs || 2000;
          
          if (!this.timeBudget.hasTimeFor(estimatedTime)) {
            trace.earlyStop = true;
            trace.earlyStopReason = 'Not enough time for tool execution';
            streamingStep.status = 'error';
            streamingStep.error = 'Not enough time';
            
            this.emit(createStreamEvent<ErrorEvent>('error', this.config.moduleName, {
              stepId,
              error: 'Not enough time for tool execution',
              recoverable: false,
            }));
            
            trace.steps.push(step);
            break;
          }
          
          // 执行工具
          const result = await this.executeTool(action.tool, action.params);
          step.observation = result.success 
            ? JSON.stringify(result.data, null, 2)
            : `Error: ${result.error}`;
          streamingStep.observation = step.observation;
          
          // 发送行动完成事件
          this.emit(createStreamEvent<ActionCompleteEvent>('action_complete', this.config.moduleName, {
            stepId,
            tool: action.tool,
            success: result.success,
            result: result.data,
            error: result.error,
            durationMs: result.executionTimeMs,
          }));
          
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
        
        // 更新步骤状态
        streamingStep.status = 'completed';
        streamingStep.endTime = Date.now();
        streamingStep.durationMs = streamingStep.endTime - streamingStep.startTime;
        
        // 发送步骤完成事件
        this.emit(createStreamEvent<StepCompleteEvent>('step_complete', this.config.moduleName, {
          stepId,
          stepNumber: currentStep,
          durationMs: streamingStep.durationMs,
        }));
        
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
        streamingStep.status = 'error';
        streamingStep.error = error instanceof Error ? error.message : 'Unknown error';
        
        this.emit(createStreamEvent<ErrorEvent>('error', this.config.moduleName, {
          stepId,
          error: streamingStep.error,
          recoverable: false,
        }));
        
        trace.earlyStop = true;
        trace.earlyStopReason = streamingStep.error;
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
    
    // 发送 Agent 完成事件
    this.emit(createStreamEvent<AgentCompleteEvent>('agent_complete', this.config.moduleName, {
      success: output !== null,
      result: output,
      error: output === null ? 'Failed to generate valid output' : undefined,
      totalDurationMs: trace.totalTimeMs,
      totalSteps: trace.steps.length,
    }));
    
    return {
      success: output !== null,
      output: output || undefined,
      trace,
      grade,
      error: output === null ? 'Failed to generate valid output' : undefined,
    };
  }

  /**
   * 获取当前的流式步骤
   */
  getStreamingSteps(): StreamingStep[] {
    return [...this.streamingSteps];
  }
}
