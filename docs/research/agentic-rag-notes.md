# Agentic RAG 研究笔记

## 来源
1. IBM - What is Agentic RAG
2. Medium - Mastering Agentic RAG: A Practical Guide for AI Engineers

---

## 核心概念

### 什么是 Agentic RAG？
- 使用 AI Agent 来增强 RAG（检索增强生成）系统
- 相比传统 RAG，能从多个数据源检索信息，处理更复杂的工作流

### AI Agent 的三个关键特征
1. **记忆（Memory）**：短期和长期记忆，用于规划和执行复杂任务
2. **路由和规划（Routing & Planning）**：逐步规划和决策能力
3. **工具调用（Tool Calling）**：通过 API 调用外部工具

---

## Agentic RAG vs 传统 RAG

| 特性 | 传统 RAG | Agentic RAG |
|------|----------|-------------|
| 数据源 | 单一知识库 | 多个外部数据源 |
| 适应性 | 静态规则查询 | 自适应智能问题解决 |
| 准确性 | 无法自我验证 | 可迭代优化结果 |
| 扩展性 | 有限 | 高度可扩展 |
| 多模态 | 有限 | 支持图像、音频等 |

---

## Agentic RAG 的 Agent 类型

### 1. Routing Agent（路由代理）
- 决定使用哪些外部知识源和工具
- 处理用户提示，识别最优 RAG 管道

### 2. Query Planning Agent（查询规划代理）
- RAG 管道的任务管理器
- 将复杂查询分解为逐步流程
- 提交子查询给其他 Agent，然后合并响应

### 3. ReAct Agent（推理和行动代理）
- 创建并执行逐步解决方案
- 识别合适的工具
- 根据每步结果动态调整后续阶段

### 4. Plan-and-Execute Agent（计划执行代理）
- ReAct 的进化版
- 可执行多步工作流而无需回调主代理
- 完成率和质量更高

---

## Agentic RAG 的 5 个步骤（实践指南）

### Step 1: 智能查询分析
- 不是立即搜索，而是先分析问题
- 判断：是否太模糊？是否包含多个子问题？是否缺少关键上下文？
- 将模糊查询转换为精确查询

**示例：**
- 用户问："展示最新销售趋势"
- 转换为：
  1. "2025年Q1各地区销售总额是多少？"
  2. "与2024年Q4相比销售变化百分比"
  3. "识别增长最快的前3个产品类别"

### Step 2: 智能数据检索
- 根据问题类型选择不同的数据源
- 公司政策问题 → 员工手册、HR系统
- 天气问题 → 日历API + 天气API
- 可插入多种数据源：向量数据库、SQL、知识图谱、Web搜索API

### Step 3: 整合与重排序
- 收集所有检索结果后进行质量控制
- 使用更强大的 LLM 重新评估每个片段的相关性
- 过滤掉过时或不相关的内容
- 从50个片段筛选到5-10个真正相关的

### Step 4 & 5: 生成、评估与迭代
- 生成答案后，评估代理进行质量检查：
  - **事实准确性**：答案是否与上下文一致？
  - **完整性**：是否回答了用户问题的所有部分？
  - **连贯性**：答案是否逻辑清晰？
  - **幻觉检测**：模型是否做出了无证据支持的声明？
- 如果发现问题，启动反馈循环重新生成

---

## 应用于面试知识库的设计思路

### 数据源
1. **Glassdoor** - 面试问题和经验分享
2. **LinkedIn** - 公司信息、职位描述
3. **公司官网** - 文化、价值观、产品信息
4. **LeetCode/牛客** - 技术面试题
5. **一亩三分地** - 面经分享（中国求职者）

### Agent 设计
1. **Search Agent** - 实时搜索公司面试信息
2. **Knowledge Extraction Agent** - 提取结构化面试知识
3. **Question Generation Agent** - 根据知识库生成面试问题
4. **Evaluation Agent** - 评估用户回答

### 知识库结构
```
每个面试目标 = {
  company: "Google",
  position: "数据分析师",
  knowledge_base: {
    interview_process: [...],      // 面试流程
    common_questions: [...],       // 常见问题
    technical_requirements: [...], // 技术要求
    culture_fit: [...],           // 文化契合
    tips: [...]                   // 面试技巧
  }
}
```

---

## 数据源方案

### Apify Glassdoor Scraper
- **URL**: https://apify.com/memo23/apify-glassdoor-reviews-scraper
- **价格**: $29/月 + 使用量
- **评分**: 4.4★ (9个评价)
- **用户**: 610 总用户, 37 月活跃用户

**可爬取的数据类型：**
1. **Reviews** - 员工评价
2. **Interviews** - 面试问题和经验 ✅ 核心数据
3. **Office locations** - 办公地点
4. **Salaries** - 薪资估算
5. **Jobs** - 职位信息
6. **Company details/overview** - 公司概况
7. **Culture/Diversity data** - 文化多样性
8. **Benefits data** - 福利数据

**面试数据包含：**
- 面试问题
- 面试详情
- 面试难度
- 面试结果
- 面试者职位

### 其他数据源
- **Kaggle HR Interview Questions Dataset** - 250,000 个 HR 面试问题
- **HuggingFace interviews dataset** - 编程面试问题
- **LeetCode/牛客** - 技术面试题
