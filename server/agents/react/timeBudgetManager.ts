/**
 * Time Budget Manager
 * 
 * 管理 ReAct Agent 的时间预算，确保在用户等待时间内完成
 */

import { TimeBudget, TIME_BUDGETS } from './types';

export class TimeBudgetManager {
  private startTime: number;
  private budget: TimeBudget;
  private moduleName: string;
  private checkpoints: Array<{ name: string; timeMs: number }> = [];

  constructor(moduleName: string, customBudget?: TimeBudget) {
    this.moduleName = moduleName;
    this.budget = customBudget || TIME_BUDGETS[moduleName] || {
      maxTimeMs: 10000,
      priority: 'balanced',
    };
    this.startTime = Date.now();
  }

  /**
   * 获取已用时间（毫秒）
   */
  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  /**
   * 获取剩余时间（毫秒）
   */
  getRemainingMs(): number {
    return Math.max(0, this.budget.maxTimeMs - this.getElapsedMs());
  }

  /**
   * 检查是否超时
   */
  isExpired(): boolean {
    return this.getElapsedMs() >= this.budget.maxTimeMs;
  }

  /**
   * 检查是否接近超时（警告阈值）
   */
  isNearTimeout(): boolean {
    const threshold = this.budget.warningThresholdMs || this.budget.maxTimeMs * 0.7;
    return this.getElapsedMs() >= threshold;
  }

  /**
   * 检查是否有足够时间执行某个操作
   */
  hasTimeFor(estimatedMs: number): boolean {
    return this.getRemainingMs() >= estimatedMs;
  }

  /**
   * 根据优先级决定是否应该继续深度思考
   */
  shouldContinueThinking(currentQuality: number, targetQuality: number = 0.8): boolean {
    const remaining = this.getRemainingMs();
    const elapsed = this.getElapsedMs();
    
    switch (this.budget.priority) {
      case 'speed':
        // 速度优先：只要有基本质量就停止
        return remaining > 1000 && currentQuality < 0.6;
        
      case 'quality':
        // 质量优先：尽可能提高质量
        return remaining > 2000 && currentQuality < targetQuality;
        
      case 'balanced':
      default:
        // 平衡：根据时间消耗比例决定
        const timeRatio = elapsed / this.budget.maxTimeMs;
        const qualityGap = targetQuality - currentQuality;
        
        // 如果时间消耗超过 60%，质量差距小于 0.2，就停止
        if (timeRatio > 0.6 && qualityGap < 0.2) return false;
        
        // 如果时间消耗超过 80%，就停止
        if (timeRatio > 0.8) return false;
        
        return currentQuality < targetQuality;
    }
  }

  /**
   * 计算推荐的最大思考步数
   */
  getRecommendedMaxSteps(estimatedStepTimeMs: number = 2000): number {
    const remaining = this.getRemainingMs();
    const maxSteps = Math.floor(remaining / estimatedStepTimeMs);
    
    switch (this.budget.priority) {
      case 'speed':
        return Math.min(maxSteps, 2);  // 最多 2 步
      case 'quality':
        return Math.min(maxSteps, 5);  // 最多 5 步
      case 'balanced':
      default:
        return Math.min(maxSteps, 3);  // 最多 3 步
    }
  }

  /**
   * 添加检查点
   */
  checkpoint(name: string): void {
    this.checkpoints.push({
      name,
      timeMs: this.getElapsedMs(),
    });
  }

  /**
   * 获取时间报告
   */
  getReport(): {
    moduleName: string;
    budget: TimeBudget;
    elapsedMs: number;
    remainingMs: number;
    isExpired: boolean;
    checkpoints: Array<{ name: string; timeMs: number }>;
  } {
    return {
      moduleName: this.moduleName,
      budget: this.budget,
      elapsedMs: this.getElapsedMs(),
      remainingMs: this.getRemainingMs(),
      isExpired: this.isExpired(),
      checkpoints: this.checkpoints,
    };
  }

  /**
   * 创建一个带超时的 Promise
   */
  withTimeout<T>(promise: Promise<T>, fallback?: T): Promise<T> {
    const remaining = this.getRemainingMs();
    
    return Promise.race([
      promise,
      new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          if (fallback !== undefined) {
            resolve(fallback);
          } else {
            reject(new Error(`[${this.moduleName}] Timeout after ${this.budget.maxTimeMs}ms`));
          }
        }, remaining);
      }),
    ]);
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = Date.now();
    this.checkpoints = [];
  }
}

/**
 * 创建时间预算管理器的工厂函数
 */
export function createTimeBudget(moduleName: string, customBudget?: Partial<TimeBudget>): TimeBudgetManager {
  const defaultBudget = TIME_BUDGETS[moduleName];
  const budget = customBudget ? { ...defaultBudget, ...customBudget } : defaultBudget;
  return new TimeBudgetManager(moduleName, budget);
}

/**
 * 装饰器：为函数添加时间预算
 */
export function withTimeBudget<T extends (...args: unknown[]) => Promise<unknown>>(
  moduleName: string,
  fn: T
): T {
  return (async (...args: unknown[]) => {
    const manager = createTimeBudget(moduleName);
    
    try {
      const result = await manager.withTimeout(fn(...args));
      
      const report = manager.getReport();
      console.log(`[TimeBudget] ${moduleName} completed in ${report.elapsedMs}ms (budget: ${report.budget.maxTimeMs}ms)`);
      
      return result;
    } catch (error) {
      const report = manager.getReport();
      console.error(`[TimeBudget] ${moduleName} failed after ${report.elapsedMs}ms:`, error);
      throw error;
    }
  }) as T;
}
