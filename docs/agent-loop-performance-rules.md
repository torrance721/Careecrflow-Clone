# Agent Loop 硬性时间规则

> ⚠️ **强制规则**：任何功能优化都不能牺牲响应时间。如果新功能导致时间超标，该功能不能上线。时间问题优先级高于功能问题。

## 硬性时间指标

| 任务 | 硬性限制 | 超时降级策略 |
|------|---------|-------------|
| **追问响应** | ≤5秒 | 返回通用追问 |
| **单话题面试报告** | ≤20秒 | 返回简化报告 |
| **面试准备（知识库搜索）** | ≤30秒 | 使用缓存/跳过搜索 |
| **简历解析** | ≤8秒 | 返回原始文本 |
| **职位推荐** | ≤10秒 | 返回缓存结果 |

## 迭代前置检查

每次 Agent Loop 迭代开始前，**必须先运行时间基准测试**：

```bash
# 测试脚本
pnpm test:performance
```

测试内容：
1. 追问响应时间（3次取平均）
2. 报告生成时间（3次取平均）
3. 面试准备时间（3次取平均）

**如果任何一项超过硬性限制 → 停止迭代，先修复时间问题**

## 迭代过程中的约束

如果迭代中的任何代码修改导致时间超标：
1. 立即回滚该修改
2. 记录问题原因到 `docs/performance-issues.md`
3. 寻找不影响性能的替代方案

## 超时降级策略实现

### 追问响应（5秒超时）
```typescript
const followup = await Promise.race([
  generateFollowup(userMessage, topicContext),
  timeout(5000).then(() => ({
    content: getDefaultFollowup(topicContext),
    isTimeout: true
  }))
]);
```

### 单话题报告（20秒超时）
```typescript
const report = await Promise.race([
  generateTopicFeedback(session),
  timeout(20000).then(() => getQuickFeedback(session))
]);
```

### 面试准备（30秒超时）
```typescript
const knowledgeBase = await Promise.race([
  searchKnowledgeBase(company, position),
  timeout(30000).then(() => getCachedKnowledgeBase(company, position))
]);
```

## 每次迭代的验证清单

在每次迭代结束时，必须验证以下指标：

```
□ 追问响应 ≤5秒
□ 单话题报告 ≤20秒
□ 面试准备 ≤30秒
□ 简历解析 ≤8秒
□ 职位推荐 ≤10秒

如果任何一项未通过 → 迭代失败，必须先修复
```

## 性能优化技术栈

### 已实现的优化
1. **快速状态评估** (`quickStatusEvaluator.ts`) - 2秒内完成状态判断
2. **流式输出** (`topicPracticeStreamResponse.ts`) - 用户 1 秒内看到内容
3. **并行处理** - 状态评估和追问生成并行
4. **缓存机制** - LinkedIn 职位缓存、知识库缓存

### 禁止的做法
1. ❌ 在追问响应中添加额外的 LLM 调用
2. ❌ 在追问响应中添加实时语言检测
3. ❌ 串行执行多个 LLM 调用
4. ❌ 不设置超时的外部 API 调用

## 语言处理规则

语言选择在主页一次性完成，选完后整个会话固定使用该语言：
- 从 i18n context 获取用户语言设置
- 不在追问响应中实时检测语言
- 所有 Prompt 预先准备中英文版本

## 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-01-07 | 初始版本，定义硬性时间规则 |
| 2026-01-07 | 回滚语言检测代码，恢复 4-5 秒追问响应 |
