# Chrome Extension 技能分析功能 PRD

## 1. 概述

### 1.1 背景
Careerflow Extension 的核心竞争力是在 LinkedIn 页面上直接显示用户简历与职位的技能匹配分析。UHired Extension 需要实现类似功能以提升用户体验和产品竞争力。

### 1.2 目标
在 UHired Chrome Extension 的浮动面板中添加技能分析功能，让用户无需跳转即可看到：
- 技能匹配百分比
- 强匹配技能
- 部分匹配技能
- 缺失关键词

### 1.3 成功指标
- 技能分析响应时间 < 3 秒
- 用户无需跳转即可获得匹配分析
- API 成本控制在 $0.02/次以内

---

## 2. 功能需求

### 2.1 技能分析面板 UI

**面板结构：**
```
┌─────────────────────────────────────┐
│  JobH Assistant                  ─  │  ← 最小化按钮
├─────────────────────────────────────┤
│  Skill Score: 75%                   │  ← 匹配百分比
│  ████████████░░░░                   │  ← 进度条
├─────────────────────────────────────┤
│  ▼ Strong Match (5)                 │  ← 可折叠
│    • React                          │
│    • Node.js                        │
│    • TypeScript                     │
├─────────────────────────────────────┤
│  ▼ Partial Match (3)                │  ← 可折叠
│    • Cloud ≈ AWS                    │
│    • Database ≈ PostgreSQL          │
├─────────────────────────────────────┤
│  ▼ Missing Keywords (4)             │  ← 可折叠
│    • Kubernetes                     │
│    • GraphQL                        │
│    • CI/CD                          │
├─────────────────────────────────────┤
│  [Change Resume ▼]                  │  ← 简历选择器
├─────────────────────────────────────┤
│  [Save Job] [Tailor Resume]         │  ← 操作按钮
└─────────────────────────────────────┘
```

**UI 状态：**
1. **加载中**: 显示骨架屏 + "Analyzing skills..."
2. **分析完成**: 显示完整分析结果
3. **未登录**: 显示 "Login to see skill analysis" + 登录按钮
4. **无简历**: 显示 "Upload a resume to see skill match" + 跳转按钮
5. **分析失败**: 显示 "Analysis failed" + 重试按钮

### 2.2 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension 触发分析                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 提取职位描述 (Extension Content Script)                      │
│     - 从 LinkedIn DOM 提取职位标题、公司、描述                    │
│     - 使用多个选择器作为后备                                      │
│     - 模型: 无 (纯 DOM 操作)                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 提取职位技能 (后端 API - GPT-3.5)                            │
│     输入: 职位描述文本                                           │
│     输出: ["React", "Node.js", "AWS", ...]                      │
│     成本: ~$0.002/次                                            │
│     缓存: 相同职位描述 Hash → 缓存 24 小时                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 获取用户简历技能 (后端 API)                                   │
│     - 从数据库获取用户选中的简历                                  │
│     - 如果简历有结构化技能数据 → 直接使用                         │
│     - 如果只有文本 → 调用 GPT-3.5 提取并缓存                      │
│     成本: $0 (已缓存) 或 ~$0.004/次 (首次)                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 技能匹配分析 (后端 API - GPT-4)                              │
│     输入: 职位技能列表 + 简历技能列表                             │
│     输出: {                                                     │
│       score: 75,                                                │
│       strongMatch: ["React", "Node.js"],                       │
│       partialMatch: [{ job: "Cloud", resume: "AWS" }],         │
│       missing: ["Kubernetes", "GraphQL"]                       │
│     }                                                           │
│     成本: ~$0.01/次                                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 返回结果到 Extension 面板显示                                │
│     - 更新 UI 状态                                              │
│     - 缓存结果到 chrome.storage (职位 ID + 简历 ID)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 技术设计

### 3.1 API 设计

#### 3.1.1 技能分析 API

**Endpoint:** `POST /api/trpc/extension.analyzeSkills`

**请求：**
```typescript
interface AnalyzeSkillsInput {
  jobDescription: string;      // 职位描述文本
  jobTitle: string;            // 职位标题
  company: string;             // 公司名称
  resumeId?: number;           // 可选，指定简历 ID
  jobUrl?: string;             // 职位 URL，用于缓存 key
}
```

**响应：**
```typescript
interface AnalyzeSkillsOutput {
  score: number;               // 0-100 匹配分数
  strongMatch: string[];       // 强匹配技能
  partialMatch: Array<{        // 部分匹配
    jobSkill: string;
    resumeSkill: string;
  }>;
  missing: string[];           // 缺失技能
  jobSkills: string[];         // 职位要求的所有技能
  resumeSkills: string[];      // 简历中的所有技能
  cached: boolean;             // 是否来自缓存
  analyzedAt: string;          // 分析时间
}
```

#### 3.1.2 简历列表 API (已存在)

**Endpoint:** `GET /api/trpc/resume.list`

**响应：**
```typescript
interface Resume {
  id: number;
  title: string;
  type: 'base' | 'tailored';
  skills: Array<{ name: string; level?: string }>;
  // ... 其他字段
}
```

### 3.2 LLM Prompt 设计

#### 3.2.1 职位技能提取 (GPT-3.5)

```
You are a job skills extractor. Extract all required and preferred skills from the job description.

Job Description:
{jobDescription}

Return a JSON array of skills. Include:
- Technical skills (programming languages, frameworks, tools)
- Soft skills (communication, leadership)
- Domain knowledge (industry-specific)

Format: ["skill1", "skill2", ...]
```

#### 3.2.2 简历技能提取 (GPT-3.5)

```
You are a resume skills extractor. Extract all skills mentioned in this resume.

Resume Text:
{resumeText}

Return a JSON array of skills. Include:
- Technical skills
- Soft skills
- Tools and technologies
- Certifications

Format: ["skill1", "skill2", ...]
```

#### 3.2.3 技能匹配分析 (GPT-4)

```
You are a skill matching expert. Analyze how well the candidate's skills match the job requirements.

Job Skills: {jobSkills}
Resume Skills: {resumeSkills}

Analyze and return:
1. matchScore: 0-100 based on skill coverage and relevance
2. strongMatch: Skills that directly match (exact or very close)
3. partialMatch: Skills that are related (e.g., "AWS" matches "Cloud")
4. missing: Important job skills not found in resume

Consider:
- Exact matches (React = React)
- Synonym matches (React.js = ReactJS = React)
- Category matches (AWS ≈ Cloud Computing)
- Transferable skills

Return JSON:
{
  "matchScore": number,
  "strongMatch": ["skill1", "skill2"],
  "partialMatch": [{"jobSkill": "X", "resumeSkill": "Y"}],
  "missing": ["skill1", "skill2"]
}
```

### 3.3 缓存策略

| 缓存类型 | Key | TTL | 存储位置 |
|---------|-----|-----|---------|
| 职位技能提取 | `job_skills:{hash(jobDescription)}` | 24 小时 | Redis/数据库 |
| 简历技能提取 | `resume_skills:{resumeId}:{updatedAt}` | 永久 (简历更新时失效) | 数据库 |
| 匹配分析结果 | `match:{hash(jobDescription)}:{resumeId}` | 1 小时 | chrome.storage |

### 3.4 成本估算

| 操作 | 模型 | Token 估算 | 单次成本 |
|------|------|-----------|---------|
| 职位技能提取 | GPT-3.5 | ~800 | $0.002 |
| 简历技能提取 | GPT-3.5 | ~1500 | $0.004 |
| 技能匹配分析 | GPT-4 | ~500 | $0.01 |
| **总计 (无缓存)** | - | ~2800 | **$0.016** |
| **总计 (有缓存)** | - | ~500 | **$0.01** |

**月度成本估算 (1000 活跃用户)：**
- 每用户每天 10 次分析
- 缓存命中率 50%
- 月成本: 1000 × 10 × 30 × $0.013 × 0.5 = **$1,950/月**

---

## 4. 可复用代码

### 4.1 已有代码

| 功能 | 文件路径 | 函数/类 |
|------|---------|--------|
| LLM 调用 | `server/_core/llm.ts` | `invokeLLM()` |
| 技能匹配分析 | `server/agents/react/jobRecommendationAgent.ts` | `analyze_skill_match` 工具 |
| 简历获取 | `server/db.ts` | `getResumesByUser()`, `getResumeById()` |
| 简历解析 | `server/resumeParser.ts` | `parseResume()` |

### 4.2 需要新增代码

| 功能 | 文件路径 | 说明 |
|------|---------|------|
| Extension API | `server/routers.ts` | 新增 `extension.analyzeSkills` procedure |
| 职位技能提取 | `server/skillExtractor.ts` | 新增服务 |
| 缓存层 | `server/skillCache.ts` | 新增缓存逻辑 |
| Extension UI | `chrome-extension/content/floating-button.js` | 更新面板 UI |

---

## 5. 实现计划

### Phase 1: 后端 API (2-3 小时)
- [ ] 创建 `extension.analyzeSkills` tRPC procedure
- [ ] 实现职位技能提取 (GPT-3.5)
- [ ] 实现技能匹配分析 (复用 `analyze_skill_match` 逻辑)
- [ ] 添加基础缓存

### Phase 2: Extension UI (2-3 小时)
- [ ] 更新浮动面板 UI，添加技能分析区域
- [ ] 实现加载状态和骨架屏
- [ ] 实现可折叠的技能列表
- [ ] 添加简历选择器

### Phase 3: 集成测试 (1 小时)
- [ ] 测试 LinkedIn 职位页面
- [ ] 测试各种边缘情况
- [ ] 性能优化

### Phase 4: 优化 (后续)
- [ ] 添加 Redis 缓存
- [ ] 支持 Indeed/Glassdoor
- [ ] 添加使用限制 (免费用户)

---

## 6. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| LLM 分析不准确 | 中 | 中 | 迭代优化 prompt，收集用户反馈 |
| LinkedIn 页面结构变化 | 中 | 高 | 使用多个选择器，定期监控 |
| API 成本超预期 | 低 | 中 | 实现缓存，设置使用限制 |
| 响应时间过长 | 低 | 中 | 并行请求，优化缓存 |

---

## 7. 附录

### 7.1 Careerflow 功能对比

| 功能 | Careerflow | UHired (计划) |
|------|-----------|--------------|
| 技能匹配分数 | ✅ | ✅ |
| 强匹配技能 | ✅ | ✅ |
| 部分匹配技能 | ✅ | ✅ |
| 缺失关键词 | ✅ | ✅ |
| 简历切换 | ✅ | ✅ |
| 面板拖拽 | ✅ | ❌ (后续) |
| Indeed 支持 | ✅ | ❌ (后续) |
| Glassdoor 支持 | ✅ | ❌ (后续) |

### 7.2 参考链接
- [Careerflow Extension](https://chrome.google.com/webstore/detail/careerflow)
- [UHired Extension 代码](../chrome-extension/)
- [技能匹配分析代码](../server/agents/react/jobRecommendationAgent.ts)
