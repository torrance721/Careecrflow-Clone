# JobH 后端工程改造需求文档

## 文档信息

| 项目 | 内容 |
|-----|------|
| 项目名称 | JobH (Careerflow Clone) |
| 文档版本 | 1.0 |
| 创建日期 | 2026-01-10 |
| 作者 | Manus AI |
| 目标读者 | 后端工程师 |

---

## 一、项目概述

JobH 是一个求职辅助平台，复刻 Careerflow 的核心功能，包括简历构建、职位追踪、LinkedIn 优化和 AI 生成内容。当前版本使用 Manus 平台的内置服务实现基础功能，但在生产环境中需要专业后端工程师进行性能优化和架构改造。

---

## 二、当前实现状态

### 2.1 已实现功能

| 功能模块 | 实现状态 | 技术栈 | 性能评估 |
|---------|---------|--------|---------|
| 用户认证 | ✅ 完成 | Manus OAuth | 良好 |
| Resume CRUD | ✅ 完成 | tRPC + Drizzle | 良好 |
| Job Tracker CRUD | ✅ 完成 | tRPC + Drizzle | 良好 |
| LinkedIn Generator | ✅ 完成 | tRPC + LLM API | 需优化 |
| Resume AI Assistant | ✅ 完成 | tRPC + LLM API | 需优化 |
| Resume PDF Export | ✅ 完成 | HTML Template | 需优化 |
| Chrome Extension | ✅ 完成 | Vanilla JS | 良好 |

### 2.2 AI 生成功能当前实现

当前 AI 生成功能使用 Manus 内置的 `invokeLLM` 服务，实现方式如下：

```typescript
// 当前实现 - server/routers.ts
import { invokeLLM } from "./_core/llm";

const response = await invokeLLM({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userInput }
  ]
});
```

**当前限制：**

1. **响应时间**：单次 LLM 调用约 3-8 秒，用户体验不佳
2. **并发限制**：Manus 平台有 API 调用频率限制
3. **无流式输出**：当前实现等待完整响应，无法实时显示生成过程
4. **无缓存机制**：相同输入每次都重新调用 LLM
5. **无重试机制**：API 失败时直接返回错误

---

## 三、后端改造需求

### 3.1 AI 生成服务优化

#### 3.1.1 流式输出 (Streaming)

**需求描述**：实现 Server-Sent Events (SSE) 或 WebSocket，支持 AI 生成内容的实时流式输出。

**技术方案**：

```typescript
// 目标实现
app.get('/api/stream/linkedin-headline', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [...],
    stream: true
  });
  
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  
  res.end();
});
```

**预期效果**：用户可以实时看到 AI 生成的内容，响应感知时间从 5s 降低到 0.5s。

#### 3.1.2 响应缓存

**需求描述**：对相同或相似的输入进行缓存，减少重复 API 调用。

**技术方案**：

| 缓存策略 | 适用场景 | 缓存时间 |
|---------|---------|---------|
| 精确匹配 | 完全相同的输入 | 24 小时 |
| 语义相似 | 相似度 > 0.9 的输入 | 1 小时 |
| 用户级缓存 | 同一用户的重复请求 | 5 分钟 |

**推荐技术**：Redis + 向量数据库 (Pinecone/Milvus)

#### 3.1.3 队列和重试机制

**需求描述**：使用消息队列处理 AI 生成请求，支持失败重试和优先级调度。

**技术方案**：

```
用户请求 → API Gateway → 消息队列 (Bull/RabbitMQ) → AI Worker → 结果存储 → 通知用户
```

**重试策略**：

| 重试次数 | 间隔时间 | 策略 |
|---------|---------|------|
| 1 | 1 秒 | 立即重试 |
| 2 | 5 秒 | 指数退避 |
| 3 | 30 秒 | 指数退避 |
| 失败 | - | 通知用户，记录日志 |

---

### 3.2 PDF 生成服务优化

#### 3.2.1 当前实现

当前使用 HTML 模板 + 浏览器打印方式生成 PDF，存在以下问题：

1. **样式一致性**：不同浏览器渲染结果不同
2. **无服务端生成**：依赖客户端浏览器
3. **无批量导出**：无法一次导出多份简历

#### 3.2.2 改造方案

**推荐技术栈**：

| 方案 | 优点 | 缺点 | 推荐度 |
|-----|------|------|-------|
| Puppeteer | 渲染效果好，支持复杂样式 | 资源消耗大 | ⭐⭐⭐⭐ |
| WeasyPrint | 轻量级，Python 生态 | CSS 支持有限 | ⭐⭐⭐ |
| PDFKit | Node.js 原生，性能好 | 需要手动布局 | ⭐⭐ |
| 第三方 API | 无需维护 | 成本高，依赖外部 | ⭐⭐ |

**推荐实现**：

```typescript
// Puppeteer 方案
import puppeteer from 'puppeteer';

async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
  });
  await browser.close();
  return pdf;
}
```

---

### 3.3 数据库优化

#### 3.3.1 索引优化

当前表结构需要添加以下索引：

```sql
-- resumes 表
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_type ON resumes(type);
CREATE INDEX idx_resumes_created_at ON resumes(created_at);

-- tracked_jobs 表
CREATE INDEX idx_tracked_jobs_user_id ON tracked_jobs(user_id);
CREATE INDEX idx_tracked_jobs_status ON tracked_jobs(status);
CREATE INDEX idx_tracked_jobs_user_status ON tracked_jobs(user_id, status);

-- linkedin_content 表
CREATE INDEX idx_linkedin_content_user_id ON linkedin_content(user_id);
CREATE INDEX idx_linkedin_content_type ON linkedin_content(type);
```

#### 3.3.2 数据分区

对于大规模用户，建议按用户 ID 或时间进行分区：

```sql
-- 按时间分区
ALTER TABLE resumes PARTITION BY RANGE (YEAR(created_at)) (
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

---

### 3.4 API 接口规范

#### 3.4.1 Resume API

| 端点 | 方法 | 描述 | 请求体 | 响应 |
|-----|------|------|-------|------|
| `/api/resumes` | GET | 获取用户简历列表 | - | `Resume[]` |
| `/api/resumes` | POST | 创建新简历 | `CreateResumeInput` | `Resume` |
| `/api/resumes/:id` | GET | 获取单个简历 | - | `Resume` |
| `/api/resumes/:id` | PUT | 更新简历 | `UpdateResumeInput` | `Resume` |
| `/api/resumes/:id` | DELETE | 删除简历 | - | `{ success: boolean }` |
| `/api/resumes/:id/preview` | GET | 获取简历预览 HTML | - | `{ html: string }` |
| `/api/resumes/:id/pdf` | GET | 下载简历 PDF | - | `application/pdf` |
| `/api/resumes/:id/score` | POST | 计算简历评分 | - | `{ score: number, details: ScoreDetails }` |
| `/api/resumes/:id/tailor` | POST | AI 定制简历 | `{ jobDescription: string }` | `Resume` |

**数据类型定义**：

```typescript
interface Resume {
  id: number;
  userId: string;
  title: string;
  type: 'base' | 'tailored';
  targetJobId?: number;
  personalInfo: PersonalInfo;
  summary?: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications: Certification[];
  awards: Award[];
  publications: Publication[];
  volunteering: Volunteering[];
  template: string;
  colorScheme: string;
  fontSize: string;
  sectionOrder: string[];
  sectionVisibility: Record<string, boolean>;
  score?: number;
  scoreDetails?: ScoreDetails;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateResumeInput {
  title: string;
  type: 'base' | 'tailored';
  targetJobId?: number;
  template?: string;
}

interface UpdateResumeInput {
  title?: string;
  personalInfo?: PersonalInfo;
  summary?: string;
  experience?: Experience[];
  education?: Education[];
  skills?: string[];
  // ... 其他字段
}
```

#### 3.4.2 Job Tracker API

| 端点 | 方法 | 描述 | 请求体 | 响应 |
|-----|------|------|-------|------|
| `/api/jobs` | GET | 获取职位列表 | `?status=saved` | `TrackedJob[]` |
| `/api/jobs` | POST | 添加职位 | `CreateJobInput` | `TrackedJob` |
| `/api/jobs/:id` | GET | 获取单个职位 | - | `TrackedJob` |
| `/api/jobs/:id` | PUT | 更新职位 | `UpdateJobInput` | `TrackedJob` |
| `/api/jobs/:id` | DELETE | 删除职位 | - | `{ success: boolean }` |
| `/api/jobs/:id/status` | PATCH | 更新状态 | `{ status: string }` | `TrackedJob` |
| `/api/jobs/stats` | GET | 获取统计数据 | - | `JobStats` |

**数据类型定义**：

```typescript
interface TrackedJob {
  id: number;
  userId: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  jobUrl?: string;
  description?: string;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';
  appliedDate?: Date;
  notes?: string;
  tags: string[];
  contactName?: string;
  contactEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateJobInput {
  title: string;
  company: string;
  location?: string;
  salary?: string;
  jobUrl?: string;
  description?: string;
  status?: string;
  tags?: string[];
}

interface JobStats {
  total: number;
  byStatus: Record<string, number>;
  appliedThisWeek: number;
  interviewsScheduled: number;
}
```

#### 3.4.3 LinkedIn Generator API

| 端点 | 方法 | 描述 | 请求体 | 响应 |
|-----|------|------|-------|------|
| `/api/linkedin/headline` | POST | 生成 LinkedIn 标题 | `GenerateHeadlineInput` | `{ headlines: string[] }` |
| `/api/linkedin/headline/stream` | POST | 流式生成标题 | `GenerateHeadlineInput` | SSE Stream |
| `/api/linkedin/about` | POST | 生成 LinkedIn 简介 | `GenerateAboutInput` | `{ about: string }` |
| `/api/linkedin/about/stream` | POST | 流式生成简介 | `GenerateAboutInput` | SSE Stream |
| `/api/linkedin/history` | GET | 获取生成历史 | `?type=headline` | `LinkedinContent[]` |
| `/api/linkedin/:id/favorite` | PATCH | 收藏/取消收藏 | - | `LinkedinContent` |

**数据类型定义**：

```typescript
interface GenerateHeadlineInput {
  currentRole: string;
  targetRole: string;
  keywords: string[];
  tone: 'professional' | 'creative' | 'casual';
  language: string;
  profileUrl?: string;
}

interface GenerateAboutInput {
  currentRole: string;
  targetRole: string;
  keywords: string[];
  tone: 'professional' | 'creative' | 'casual';
  length: 'short' | 'medium' | 'long';
  language: string;
  highlights?: string[];
}

interface LinkedinContent {
  id: number;
  userId: string;
  type: 'headline' | 'about';
  content: string;
  input: Record<string, any>;
  isFavorite: boolean;
  createdAt: Date;
}
```

---

## 四、性能指标要求

### 4.1 响应时间

| API 类型 | 目标响应时间 | 当前状态 |
|---------|------------|---------|
| CRUD 操作 | < 200ms | ✅ 达标 |
| 列表查询 | < 500ms | ✅ 达标 |
| AI 生成（首字节） | < 1s | ❌ 需优化 |
| AI 生成（完整） | < 10s | ⚠️ 边界 |
| PDF 生成 | < 5s | ❌ 需优化 |

### 4.2 并发能力

| 指标 | 目标值 | 当前状态 |
|-----|-------|---------|
| 同时在线用户 | 1000+ | 未测试 |
| API QPS | 100+ | 未测试 |
| AI 生成并发 | 10+ | 受限于 LLM API |

### 4.3 可用性

| 指标 | 目标值 |
|-----|-------|
| 系统可用性 | 99.9% |
| 数据持久性 | 99.99% |
| 故障恢复时间 | < 5 分钟 |

---

## 五、安全要求

### 5.1 认证授权

1. 所有 API 需要 JWT 认证
2. 用户只能访问自己的数据
3. 管理员 API 需要额外权限验证

### 5.2 数据安全

1. 敏感数据（如简历内容）需要加密存储
2. API 传输使用 HTTPS
3. 防止 SQL 注入和 XSS 攻击

### 5.3 速率限制

| API 类型 | 限制 |
|---------|------|
| 普通 API | 100 次/分钟/用户 |
| AI 生成 API | 10 次/分钟/用户 |
| PDF 生成 API | 5 次/分钟/用户 |

---

## 六、部署架构建议

### 6.1 推荐架构

```
                    ┌─────────────────┐
                    │   CDN (静态资源)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Load Balancer  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│   API Server 1   │ │   API Server 2   │ │   API Server N   │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐ ┌───────▼───────┐ ┌───▼───┐
     │   MySQL     │ │   Redis       │ │  S3   │
     │  (Primary)  │ │   (Cache)     │ │(Files)│
     └─────────────┘ └───────────────┘ └───────┘
```

### 6.2 技术选型建议

| 组件 | 推荐方案 | 备选方案 |
|-----|---------|---------|
| API 框架 | Express + tRPC | Fastify, NestJS |
| 数据库 | MySQL 8.0 | PostgreSQL |
| 缓存 | Redis | Memcached |
| 消息队列 | Bull (Redis) | RabbitMQ |
| 文件存储 | S3 | MinIO |
| PDF 生成 | Puppeteer | WeasyPrint |
| LLM API | OpenAI GPT-4 | Claude, Gemini |
| 监控 | Prometheus + Grafana | DataDog |
| 日志 | ELK Stack | Loki |

---

## 七、开发优先级

### 7.1 Phase 1（高优先级）

1. ✅ 流式输出实现
2. ✅ PDF 服务端生成
3. ✅ 数据库索引优化

### 7.2 Phase 2（中优先级）

1. ⬜ 响应缓存机制
2. ⬜ 队列和重试机制
3. ⬜ API 速率限制

### 7.3 Phase 3（低优先级）

1. ⬜ 数据分区
2. ⬜ 多区域部署
3. ⬜ A/B 测试框架

---

## 八、联系方式

如有技术问题，请联系：

- **项目负责人**：[待定]
- **技术支持**：[待定]
- **GitHub Issues**：https://github.com/ZHouliRic/JobH/issues

---

*文档版本：1.0*
*最后更新：2026-01-10*
*作者：Manus AI*
