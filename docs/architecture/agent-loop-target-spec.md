# Agent Loop 系统 - 业界最佳实践目标规范

> **版本**: 1.0  
> **创建日期**: 2025-01-05  
> **状态**: 目标定义（待实现）

---

## 一、系统定位

Agent Loop 是 UHired 平台的**后台自动优化系统**，通过模拟用户测试和反馈，持续优化面试系统的各个模块。

### 与核心业务的关系

```
┌─────────────────────────────────────────────────────────────────┐
│                     核心业务模块（用户使用）                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 问题生成  │ │ Hint系统 │ │ 下一题   │ │ 回答分析 │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 优化 Prompt + 策略 + 工具
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Loop 系统（后台运行）                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Persona  │ │ 面试模拟 │ │ 反馈生成 │ │ Prompt   │          │
│  │ 生成器   │ │          │ │          │ │ 优化器   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、目标规范

### 2.1 核心目标

| 目标 | 指标 | 达标标准 |
|------|------|----------|
| **用户满意度** | Mock 用户评分 | 所有挑剔度级别的用户满意度 ≥ 8/10 |
| **响应速度** | 用户等待时间 | 问题生成 ≤ 10s，Hint ≤ 3s，下一题 ≤ 5s |
| **自动化程度** | 人工干预频率 | 完全自动运行，无需人工干预 |
| **收敛效率** | 迭代次数 | 每个挑剔度级别 ≤ 5 次迭代达到收敛 |

### 2.2 模块能力目标

每个核心业务模块应具备以下能力：

#### 问题生成模块

| 能力 | 当前状态 | 目标状态 |
|------|----------|----------|
| Prompt | ✅ 有 | 可迭代优化 |
| 知识库搜索 | ✅ 有 | 自动选择搜索策略 |
| 难度分配 | ❌ 无 | 根据用户背景动态调整 |
| 思维链深度 | ❌ 固定 | 动态调整（1-5步），受时间约束 |
| 工具使用 | ⚠️ 手动 | 自动发现/创建工具 |

#### Hint 系统模块

| 能力 | 当前状态 | 目标状态 |
|------|----------|----------|
| Prompt | ✅ 有 | 可迭代优化 |
| 触发时机 | ❌ 手动 | 自动检测用户卡住 |
| 提示分级 | ❌ 无 | 渐进式提示（方向→框架→答案） |
| 思维链深度 | ❌ 固定 | 动态调整，≤ 3秒响应 |

#### 下一题决策模块

| 能力 | 当前状态 | 目标状态 |
|------|----------|----------|
| Prompt | ✅ 有 | 可迭代优化 |
| 话题覆盖策略 | ⚠️ 基础 | 智能平衡深度 vs 广度 |
| 追问阈值 | ❌ 无 | 根据回答质量动态决定 |
| 思维链深度 | ❌ 固定 | 动态调整，≤ 5秒响应 |

#### 回答分析模块

| 能力 | 当前状态 | 目标状态 |
|------|----------|----------|
| Prompt | ✅ 有 | 可迭代优化 |
| 评分标准 | ⚠️ 基础 | 多维度评分（内容、表达、结构） |
| 追问决策 | ⚠️ 基础 | 基于知识库的精准追问 |

#### Persona 生成模块

| 能力 | 当前状态 | 目标状态 |
|------|----------|----------|
| Prompt | ✅ 有 | 可迭代优化 |
| 多样性策略 | ⚠️ 基础 | 确保覆盖各种用户类型 |
| 挑剔度递增 | ✅ 有 | 渐进式对抗进化 |
| 差异化检查 | ❌ 无 | 确保新 Persona 与历史不重复 |

---

## 三、技术规范

### 3.1 ReAct Agent 模式

每个模块采用 ReAct（Reasoning + Acting）模式：

```typescript
interface ReActConfig {
  // 思维链配置
  thinking: {
    maxSteps: number;           // 最大思考步数
    maxTimeMs: number;          // 最大等待时间
    requiredThoughts: string[]; // 必须思考的问题
    adaptiveDepth: boolean;     // 是否动态调整深度
  };
  
  // 工具配置
  tools: {
    available: Tool[];          // 可用工具列表
    autoDiscover: boolean;      // 是否自动发现新工具
    autoCreate: boolean;        // 是否自动创建新工具
  };
  
  // 质量配置
  quality: {
    minScore: number;           // 最低质量分数
    earlyStopOnQuality: boolean; // 达到质量阈值提前停止
  };
}
```

### 3.2 Multi-Grader 评估系统

```typescript
interface MultiGrader {
  graders: [
    // 规则检查（快速，确定性）
    {
      type: 'rule';
      name: string;
      check: (output: any, context: any) => number; // 0-1
    },
    
    // LLM-as-Judge（慢，但能捕捉细微问题）
    {
      type: 'llm_judge';
      name: string;
      prompt: string;
    },
    
    // 相似度检查（防止重复）
    {
      type: 'similarity';
      name: string;
      threshold: number;
    }
  ];
  
  // 聚合策略
  aggregation: 'average' | 'min' | 'weighted';
  weights?: Record<string, number>;
}
```

### 3.3 渐进式收敛策略

```typescript
interface ConvergenceConfig {
  // 挑剔度级别
  levels: {
    start: number;              // 起始挑剔度（如 4）
    end: number;                // 最终挑剔度（如 10）
    step: number;               // 每级递增（如 1）
  };
  
  // 收敛条件
  convergence: {
    targetSatisfaction: number; // 目标满意度（如 8）
    maxIterationsPerLevel: number; // 每级最大迭代次数
    requireAllUsersPass: boolean; // 是否要求所有用户都达标
  };
  
  // 回归测试
  regression: {
    testPreviousLevels: boolean; // 是否测试之前级别的用户
    allowRegressionDrop: number; // 允许的回归下降幅度
  };
}
```

### 3.4 时间约束配置

```typescript
const TIME_BUDGETS = {
  // 用户面对的模块（需要快速响应）
  question_generation: {
    maxTimeMs: 10000,  // 10秒
    priority: 'quality', // 优先质量
  },
  hint_system: {
    maxTimeMs: 3000,   // 3秒
    priority: 'speed',  // 优先速度
  },
  next_question: {
    maxTimeMs: 5000,   // 5秒
    priority: 'balanced',
  },
  response_analysis: {
    maxTimeMs: 5000,   // 5秒
    priority: 'quality',
  },
  
  // Agent Loop 模块（后台运行，可以慢）
  persona_generation: {
    maxTimeMs: 30000,  // 30秒
    priority: 'quality',
  },
  interview_simulation: {
    maxTimeMs: 300000, // 5分钟
    priority: 'quality',
  },
  feedback_generation: {
    maxTimeMs: 60000,  // 1分钟
    priority: 'quality',
  },
  prompt_optimization: {
    maxTimeMs: 120000, // 2分钟
    priority: 'quality',
  },
};
```

### 3.5 工具自动发现/创建

```typescript
interface ToolDiscovery {
  // 发现策略
  discovery: {
    searchNpm: boolean;         // 搜索 npm 包
    searchGitHub: boolean;      // 搜索 GitHub
    searchApis: boolean;        // 搜索公开 API
  };
  
  // 创建策略
  creation: {
    allowCodeGeneration: boolean; // 允许 LLM 生成代码
    requireValidation: boolean;   // 需要验证生成的代码
    sandboxExecution: boolean;    // 在沙箱中执行
  };
  
  // 注册策略
  registration: {
    persistToFile: boolean;     // 持久化到文件
    versionControl: boolean;    // 版本控制
  };
}
```

---

## 四、迭代优化范围

### 4.1 可迭代的内容

| 类别 | 内容 | 存储位置 |
|------|------|----------|
| **Prompt** | 各模块的 Prompt 模板 | `data/prompts/{module}/v{n}.txt` |
| **策略参数** | 难度分配、话题覆盖等 | `data/strategies/{module}/v{n}.json` |
| **思维链配置** | 必须思考的问题、深度 | `data/thinking/{module}/v{n}.json` |
| **工具配置** | 可用工具、调用顺序 | `data/tools/{module}/v{n}.json` |
| **评估规则** | Multi-Grader 规则 | `data/graders/{module}/v{n}.json` |

### 4.2 不可迭代的内容

| 类别 | 原因 |
|------|------|
| 核心业务逻辑 | 需要人工审核 |
| 数据库 Schema | 影响范围大 |
| API 接口 | 影响前端 |
| 安全相关配置 | 风险高 |

---

## 五、验收标准

### 5.1 功能验收

- [ ] 渐进式收敛策略实现并运行
- [ ] 所有模块支持 ReAct 模式
- [ ] Multi-Grader 评估系统实现
- [ ] 时间约束在所有模块生效
- [ ] 工具自动发现/创建功能可用
- [ ] 所有迭代结果自动同步到 Google Drive

### 5.2 质量验收

- [ ] 挑剔度 4-7 的用户满意度 ≥ 8/10
- [ ] 挑剔度 8-10 的用户满意度 ≥ 7/10
- [ ] 问题生成响应时间 ≤ 10秒
- [ ] Hint 响应时间 ≤ 3秒
- [ ] 无明显回归（之前级别的用户满意度不下降超过 0.5）

### 5.3 文档验收

- [ ] 架构文档完整
- [ ] 所有 Prompt 模板有版本记录
- [ ] 迭代历史可追溯
- [ ] 复用指南清晰

---

## 六、实施路线图

### Phase 1: 基础重构（2-3小时）
1. 重写 Agent Loop 使用渐进式收敛策略
2. 为每个模块添加时间约束配置
3. 实现基础 Multi-Grader（规则 + LLM）

### Phase 2: ReAct 增强（2-3小时）
1. 将问题生成模块改造为 ReAct Agent
2. 添加动态思维链深度调整
3. 集成知识库搜索到思维链

### Phase 3: 工具系统（1-2小时）
1. 实现工具自动发现（搜索 npm/GitHub）
2. 实现工具自动创建（LLM 生成代码）
3. 工具注册和版本管理

### Phase 4: 完整迭代（2-3小时）
1. 运行完整 Agent Loop
2. 验证收敛效果
3. 同步所有结果到 Google Drive

### Phase 5: 文档和复用（1小时）
1. 完善架构文档
2. 编写复用指南
3. 创建示例代码

**总预计时间：8-12小时**

---

## 七、复用指南

### 7.1 如何添加新模块

```typescript
// 1. 定义模块配置
const newModuleConfig: ReActConfig = {
  thinking: { maxSteps: 3, maxTimeMs: 5000, ... },
  tools: { available: [...], autoDiscover: true },
  quality: { minScore: 0.8, earlyStopOnQuality: true },
};

// 2. 注册到 Agent Loop
agentLoop.registerModule('new_module', newModuleConfig);

// 3. 创建初始 Prompt
await savePrompt('new_module', 'v1', initialPrompt);
```

### 7.2 如何调整收敛策略

```typescript
// 修改 convergenceConfig
const customConvergence: ConvergenceConfig = {
  levels: { start: 3, end: 8, step: 1 },
  convergence: { targetSatisfaction: 7.5, maxIterationsPerLevel: 3 },
  regression: { testPreviousLevels: true, allowRegressionDrop: 0.3 },
};
```

### 7.3 如何添加新的评估规则

```typescript
// 添加到 Multi-Grader
graders.push({
  type: 'rule',
  name: 'custom_check',
  check: (output, context) => {
    // 自定义检查逻辑
    return score; // 0-1
  },
});
```

---

## 八、参考资料

1. [OpenAI Cookbook - Self-Evolving Agents](https://cookbook.openai.com/examples/partners/self_evolving_agents/autonomous_agent_retraining)
2. [LangChain State of AI Agents Report](https://www.langchain.com/stateofaiagents)
3. [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
4. [GEPA: Genetic-Pareto Prompt Optimization](https://arxiv.org/abs/2310.08303)
