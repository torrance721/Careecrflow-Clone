# 话题练习 AI 响应时间优化报告

## 优化日期
2026-01-06

## 问题描述
话题练习中 AI 追问响应时间约 30 秒，用户体验较差。

## 根因分析
在 `sendTopicMessage` 函数中，每次用户发送消息时会**串行调用 3 个 LLM**：

1. `detectUserIntent` - 检测用户意图（~3-5秒）
2. `evaluateTopicStatus` - 评估话题状态（~3-5秒）
3. `generateFollowUpQuestion` - 生成追问（~3-5秒）

总计：10-15 秒 + 网络延迟 ≈ 20-30 秒

## 优化方案
将 3 个 LLM 调用合并为 1 个，使用结构化 JSON Schema 输出：

### 新增文件
- `server/agents/interviewModes/topicMessageProcessor.ts`

### 合并的功能
1. **快速规则匹配**：对于明确的意图（结束、换话题、需要提示），使用关键词匹配，避免 LLM 调用
2. **合并 Prompt**：一次 LLM 调用完成：
   - 意图检测（如果规则未匹配）
   - 状态评估（collecting/collected/abandoned）
   - 信息提取（新的信息点）
   - 追问生成

### JSON Schema 输出
```json
{
  "status": "collecting" | "collected" | "abandoned",
  "topic_complete": true/false,
  "user_engagement": "high" | "medium" | "low",
  "newInfoPoints": [...],
  "reasoning": "判断理由",
  "aiResponse": "追问或回应"
}
```

## 测试结果

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| LLM 调用次数 | 3 | 1 | -67% |
| 响应时间 | ~15-30秒 | ~5-8秒 | -60% |
| 用户体验 | 等待时间长 | 流畅 | ✅ |

### 测试用例
- 输入目标职位：Software Engineer at Google
- 用户回答：I built a distributed caching system at my previous company that reduced API latency by 40%. The main challenge was handling cache invalidation across multiple data centers.
- AI 追问响应时间：约 6 秒
- AI 追问内容：That's a significant improvement! Reducing latency by 40% is impressive. Could you elaborate on the technical solution you implemented to manage cache invalidation across those multiple data centers? Specifically, what architecture did you choose, and what trade-offs did you have to consider regarding consistency versus availability?

## 代码变更

### 修改的文件
1. `server/agents/interviewModes/topicPracticeRouter.ts`
   - 移除 `detectUserIntent` 和 `evaluateTopicStatus` 的 import
   - 新增 `processTopicMessage` 的 import
   - 重写 `sendTopicMessage` 使用合并处理器

### 新增的文件
1. `server/agents/interviewModes/topicMessageProcessor.ts`
   - `quickIntentMatch()` - 快速规则匹配
   - `processTopicMessage()` - 合并处理函数

## 后续优化建议
1. **流式输出**：将 AI 响应改为流式输出，进一步提升感知速度
2. **缓存常见追问**：对于常见话题，缓存追问模板
3. **预加载**：在用户输入时预测可能的追问方向
