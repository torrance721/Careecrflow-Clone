# UHired 功能实现文档

**文档版本**: v2.0  
**更新日期**: 2026-01-12  
**更新内容**: 添加 Apify 真数据需求，标记 Rejected 列已实现  
**作者**: Manus AI

---

## 一、文档概述

本文档详细描述 UHired 与 Careerflow.ai 对比后识别的缺失功能的技术实现方案，包含 Web 端和 Chrome Extension 两部分。每个功能都包含需求描述、技术方案、数据库设计、API 设计、前端实现和测试方案。

---

## 二、Web 端功能实现

### 2.0 将假数据改为 Apify 真数据

**需求描述**：当前系统中存在多处使用硬编码假数据的地方，需要全部改为调用 Apify API 获取真实数据。

**优先级**：P0  
**预估工时**：4h

#### 2.0.1 当前假数据位置检查

| 文件 | 函数 | 假数据描述 | 改造方案 |
|------|------|------------|----------|
| `server/routers.ts` | `generateMock` | 7个硬编码职位推荐 | 调用 `scrapeLinkedIn` 获取真实数据 |
| `server/routers.ts` | `generateInterviewHistory` | 硬编码面试历史 | 从知识库生成真实数据 |
| `server/routers.ts` | `mockInterview.createSession` | Mock 面试会话 | 已使用真实 LLM，无需修改 |

#### 2.0.2 generateMock 改造

**当前实现**（假数据）：
```typescript
// server/routers.ts - 当前实现
generateMock: protectedProcedure.mutation(async ({ ctx }) => {
  const mockJobs = [
    { company: "TriEdge Investments", position: "Full-Stack Engineer", ... },
    { company: "Resonance", position: "Front End Engineer", ... },
    // ... 7个硬编码职位
  ];
  for (const job of mockJobs) {
    await createJobRecommendation(job);
  }
});
```

**改造后实现**（Apify 真数据）：
```typescript
// server/routers.ts - 改造后
generateRecommendations: protectedProcedure.mutation(async ({ ctx }) => {
  // 1. 获取用户偏好
  const prefs = await getUserPreferences(ctx.user.id);
  
  // 2. 根据偏好调用 Apify 获取真实职位
  const searchParams = {
    title: prefs?.preferredTitles?.[0] || "Software Engineer",
    location: prefs?.location || "United States",
    rows: 20,
    workType: prefs?.workMode as 'onsite' | 'remote' | 'hybrid' | undefined,
  };
  
  try {
    const linkedInJobs = await scrapeLinkedInJobs(searchParams);
    
    // 3. 转换并保存到数据库
    await deleteJobRecommendations(ctx.user.id);
    for (const job of linkedInJobs) {
      await createJobRecommendation({
        userId: ctx.user.id,
        company: job.companyName,
        position: job.title,
        location: job.location,
        description: job.description,
        linkedinUrl: job.jobUrl,
        linkedinJobId: job.id,
        source: 'linkedin',
        scrapedAt: new Date(),
      });
    }
    
    return { success: true, count: linkedInJobs.length, source: 'apify' };
  } catch (error) {
    // 4. 降级策略：Apify 失败时使用缓存数据
    console.error('Apify scrape failed, using cached data:', error);
    const cachedJobs = await getLinkedInJobCache(searchParams.title, searchParams.location);
    if (cachedJobs.length > 0) {
      for (const job of cachedJobs) {
        await createJobRecommendation({ ...job, userId: ctx.user.id });
      }
      return { success: true, count: cachedJobs.length, source: 'cache' };
    }
    throw new Error('Failed to fetch job recommendations');
  }
});
```

#### 2.0.3 generateInterviewHistory 改造

**当前实现**（假数据）：
```typescript
const mockInterviews = [
  { question: "Tell me about yourself", score: 85, ... },
  { question: "What are your strengths?", score: 78, ... },
  // ... 硬编码面试历史
];
```

**改造后实现**（从知识库生成）：
```typescript
generateInterviewHistory: protectedProcedure
  .input(z.object({ company: z.string(), position: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. 从知识库获取真实面试问题
    const knowledgeBase = await getOrCreateKnowledgeBase(input.company, input.position);
    const questions = await getInterviewQuestions(knowledgeBase.id);
    
    // 2. 生成模拟面试历史（基于真实问题）
    const interviewHistory = questions.slice(0, 5).map(q => ({
      userId: ctx.user.id,
      question: q.question,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      score: null, // 用户还未练习
      aiFeedback: null,
    }));
    
    for (const interview of interviewHistory) {
      await createInterviewHistory(interview);
    }
    
    return { success: true, count: interviewHistory.length };
  });
```

#### 2.0.4 错误处理和降级策略

```typescript
// server/utils/apifyFallback.ts
export async function withApifyFallback<T>(
  apifyCall: () => Promise<T[]>,
  cacheCall: () => Promise<T[]>,
  errorMessage: string
): Promise<{ data: T[]; source: 'apify' | 'cache' }> {
  try {
    const data = await apifyCall();
    return { data, source: 'apify' };
  } catch (error) {
    console.error(`Apify call failed: ${errorMessage}`, error);
    const cachedData = await cacheCall();
    if (cachedData.length > 0) {
      return { data: cachedData, source: 'cache' };
    }
    throw new Error(`${errorMessage} and no cached data available`);
  }
}
```

#### 2.0.5 测试方案

```typescript
// server/apifyIntegration.test.ts
describe('Apify Integration', () => {
  it('should fetch real jobs from Apify', async () => {
    const result = await caller.preferences.generateRecommendations();
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
    expect(['apify', 'cache']).toContain(result.source);
  });

  it('should fallback to cache when Apify fails', async () => {
    // Mock Apify failure
    vi.spyOn(apify, 'scrapeLinkedInJobs').mockRejectedValue(new Error('API limit'));
    
    const result = await caller.preferences.generateRecommendations();
    expect(result.source).toBe('cache');
  });

  it('should generate interview history from knowledge base', async () => {
    const result = await caller.preferences.generateInterviewHistory({
      company: 'Google',
      position: 'Software Engineer'
    });
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });
});
```

---

### 2.1 Job Tracker - Rejected 列

**状态**：✅ 已实现

数据库 schema 和前端 Kanban 都已支持 `rejected` 状态，无需额外开发。

**需求描述**：在 Job Tracker 的 Kanban 看板中添加 "Rejected" 列，用于追踪被拒绝的职位申请。

**优先级**：P0  
**预估工时**：1h

#### 2.1.1 数据库设计

当前 `job_applications` 表已有 `status` 字段，只需添加新的状态值。

```sql
-- 更新 status 枚举，添加 'rejected' 值
-- 当前值: 'saved', 'applied', 'interviewing', 'offered'
-- 新增值: 'rejected'
ALTER TABLE job_applications 
MODIFY COLUMN status ENUM('saved', 'applied', 'interviewing', 'offered', 'rejected') 
DEFAULT 'saved';
```

#### 2.1.2 后端实现

**文件**: `server/routers.ts`

无需修改，现有 `jobTracker.updateStatus` 已支持任意状态值。

#### 2.1.3 前端实现

**文件**: `client/src/pages/JobTracker.tsx`

```tsx
// 在 COLUMNS 数组中添加 Rejected 列
const COLUMNS = [
  { id: 'saved', title: 'Saved', color: 'bg-gray-100' },
  { id: 'applied', title: 'Applied', color: 'bg-blue-100' },
  { id: 'interviewing', title: 'Interviewing', color: 'bg-yellow-100' },
  { id: 'offered', title: 'Offered', color: 'bg-green-100' },
  { id: 'rejected', title: 'Rejected', color: 'bg-red-100' }, // 新增
];
```

#### 2.1.4 测试方案

```typescript
// server/jobTracker.test.ts
describe('Job Tracker - Rejected Status', () => {
  it('should update job status to rejected', async () => {
    const result = await caller.jobTracker.updateStatus({
      id: jobId,
      status: 'rejected'
    });
    expect(result.status).toBe('rejected');
  });

  it('should filter jobs by rejected status', async () => {
    const jobs = await caller.jobTracker.list({ status: 'rejected' });
    expect(jobs.every(j => j.status === 'rejected')).toBe(true);
  });
});
```

---

### 2.2 Job Tracker - Add Column 自定义列

**需求描述**：允许用户添加自定义列到 Kanban 看板，如 "Phone Screen"、"Technical Interview" 等。

**优先级**：P1  
**预估工时**：4h

#### 2.2.1 数据库设计

**新建表**: `custom_columns`

```sql
CREATE TABLE custom_columns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) DEFAULT 'bg-gray-100',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_column (user_id, name),
  INDEX idx_user_position (user_id, position)
);
```

**Drizzle Schema**: `drizzle/schema.ts`

```typescript
export const customColumns = mysqlTable('custom_columns', {
  id: int('id').autoincrement().primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 50 }).default('bg-gray-100'),
  position: int('position').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
```

#### 2.2.2 后端实现

**文件**: `server/routers.ts`

```typescript
// 添加 customColumns router
customColumns: {
  // 获取用户的自定义列
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select()
      .from(customColumns)
      .where(eq(customColumns.userId, ctx.user.openId))
      .orderBy(customColumns.position);
  }),

  // 创建自定义列
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 获取当前最大 position
      const maxPos = await db.select({ max: sql`MAX(position)` })
        .from(customColumns)
        .where(eq(customColumns.userId, ctx.user.openId));
      
      const position = (maxPos[0]?.max ?? -1) + 1;
      
      const [result] = await db.insert(customColumns).values({
        userId: ctx.user.openId,
        name: input.name,
        color: input.color ?? 'bg-gray-100',
        position,
      });
      
      return { id: result.insertId, ...input, position };
    }),

  // 删除自定义列
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(customColumns)
        .where(and(
          eq(customColumns.id, input.id),
          eq(customColumns.userId, ctx.user.openId)
        ));
      return { success: true };
    }),

  // 重新排序列
  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.number(), position: z.number() })))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(input.map(item =>
        db.update(customColumns)
          .set({ position: item.position })
          .where(and(
            eq(customColumns.id, item.id),
            eq(customColumns.userId, ctx.user.openId)
          ))
      ));
      return { success: true };
    }),
},
```

#### 2.2.3 前端实现

**文件**: `client/src/pages/JobTracker.tsx`

```tsx
// 添加 Add Column 弹窗组件
function AddColumnDialog({ open, onOpenChange, onAdd }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('bg-gray-100');
  
  const colors = [
    { value: 'bg-gray-100', label: 'Gray' },
    { value: 'bg-blue-100', label: 'Blue' },
    { value: 'bg-green-100', label: 'Green' },
    { value: 'bg-yellow-100', label: 'Yellow' },
    { value: 'bg-purple-100', label: 'Purple' },
    { value: 'bg-pink-100', label: 'Pink' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Column</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Column Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Phone Screen"
            />
          </div>
          <div>
            <Label>Color</Label>
            <Select value={color} onValueChange={setColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colors.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded ${c.value}`} />
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onAdd({ name, color })}>
            Add Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 在 JobTracker 组件中使用
function JobTracker() {
  const { data: customCols } = trpc.customColumns.list.useQuery();
  const createColumn = trpc.customColumns.create.useMutation();
  
  // 合并默认列和自定义列
  const allColumns = [
    ...DEFAULT_COLUMNS,
    ...(customCols?.map(c => ({
      id: `custom_${c.id}`,
      title: c.name,
      color: c.color,
      isCustom: true,
    })) ?? []),
  ];
  
  // ... 渲染逻辑
}
```

#### 2.2.4 测试方案

```typescript
// server/customColumns.test.ts
describe('Custom Columns', () => {
  it('should create a custom column', async () => {
    const result = await caller.customColumns.create({
      name: 'Phone Screen',
      color: 'bg-purple-100'
    });
    expect(result.name).toBe('Phone Screen');
  });

  it('should list custom columns in order', async () => {
    const columns = await caller.customColumns.list();
    expect(columns).toBeInstanceOf(Array);
    // 验证按 position 排序
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i].position).toBeGreaterThanOrEqual(columns[i-1].position);
    }
  });

  it('should delete a custom column', async () => {
    await caller.customColumns.delete({ id: columnId });
    const columns = await caller.customColumns.list();
    expect(columns.find(c => c.id === columnId)).toBeUndefined();
  });
});
```

---

### 2.3 Jobs Board - 职位详情页

**需求描述**：点击职位卡片后跳转到职位详情页，显示完整的职位信息、公司介绍和申请按钮。

**优先级**：P1  
**预估工时**：6h

#### 2.3.1 路由设计

```
/jobs/:jobId - 职位详情页
```

#### 2.3.2 后端实现

**文件**: `server/routers.ts`

```typescript
jobs: {
  // 获取职位详情
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [job] = await db.select()
        .from(jobRecommendations)
        .where(eq(jobRecommendations.id, input.id))
        .limit(1);
      
      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      }
      
      return job;
    }),

  // 获取相关职位
  getRelated: publicProcedure
    .input(z.object({ 
      jobId: z.number(),
      limit: z.number().default(5) 
    }))
    .query(async ({ input }) => {
      const [currentJob] = await db.select()
        .from(jobRecommendations)
        .where(eq(jobRecommendations.id, input.jobId));
      
      if (!currentJob) return [];
      
      // 获取同公司或同行业的职位
      return db.select()
        .from(jobRecommendations)
        .where(and(
          ne(jobRecommendations.id, input.jobId),
          or(
            eq(jobRecommendations.company, currentJob.company),
            eq(jobRecommendations.industry, currentJob.industry)
          )
        ))
        .limit(input.limit);
    }),
},
```

#### 2.3.3 前端实现

**文件**: `client/src/pages/JobDetail.tsx`

```tsx
import { useParams, Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, Building, DollarSign, Clock, ExternalLink } from 'lucide-react';

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading } = trpc.jobs.getById.useQuery({ 
    id: parseInt(jobId) 
  });
  const { data: relatedJobs } = trpc.jobs.getRelated.useQuery({ 
    jobId: parseInt(jobId) 
  });
  const saveToTracker = trpc.jobTracker.create.useMutation();

  if (isLoading) {
    return <JobDetailSkeleton />;
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  return (
    <div className="container max-w-4xl py-8">
      {/* 返回按钮 */}
      <Link href="/jobs">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Button>
      </Link>

      {/* 职位头部 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{job.position}</CardTitle>
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Building className="w-4 h-4" />
                <span>{job.company}</span>
              </div>
            </div>
            {job.matchPercentage && (
              <Badge variant="secondary" className="text-lg">
                {job.matchPercentage}% Match
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 职位元信息 */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{job.location}</span>
            </div>
            {job.salaryRange && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span>{job.salaryRange}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{job.jobType}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button 
              onClick={() => saveToTracker.mutate({
                company: job.company,
                position: job.position,
                location: job.location,
                linkedinUrl: job.linkedinUrl,
              })}
              disabled={saveToTracker.isPending}
            >
              Save to Tracker
            </Button>
            {job.linkedinUrl && (
              <Button variant="outline" asChild>
                <a href={job.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on LinkedIn
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 职位描述 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            {job.description}
          </div>
        </CardContent>
      </Card>

      {/* 相关职位 */}
      {relatedJobs && relatedJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Related Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {relatedJobs.map(relatedJob => (
                <Link key={relatedJob.id} href={`/jobs/${relatedJob.id}`}>
                  <div className="p-3 rounded-lg border hover:bg-accent cursor-pointer">
                    <div className="font-medium">{relatedJob.position}</div>
                    <div className="text-sm text-muted-foreground">
                      {relatedJob.company} · {relatedJob.location}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**路由注册**: `client/src/App.tsx`

```tsx
<Route path="/jobs/:jobId" component={JobDetail} />
```

#### 2.3.4 测试方案

```typescript
// server/jobs.test.ts
describe('Jobs - Detail Page', () => {
  it('should get job by id', async () => {
    const job = await caller.jobs.getById({ id: 1 });
    expect(job).toHaveProperty('position');
    expect(job).toHaveProperty('company');
    expect(job).toHaveProperty('description');
  });

  it('should return 404 for non-existent job', async () => {
    await expect(caller.jobs.getById({ id: 99999 }))
      .rejects.toThrow('NOT_FOUND');
  });

  it('should get related jobs', async () => {
    const related = await caller.jobs.getRelated({ jobId: 1, limit: 5 });
    expect(related.length).toBeLessThanOrEqual(5);
  });
});
```

---

### 2.4 AI Toolbox - View History

**需求描述**：在 AI Toolbox 各功能页面添加 "View History" 按钮，允许用户查看历史生成记录。

**优先级**：P0  
**预估工时**：2h

#### 2.4.1 数据库设计

**新建表**: `ai_toolbox_history`

```sql
CREATE TABLE ai_toolbox_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tool_type ENUM('email', 'elevator_pitch', 'linkedin_headline', 'linkedin_about', 'linkedin_post', 'personal_brand') NOT NULL,
  input_data JSON NOT NULL,
  output_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_tool (user_id, tool_type),
  INDEX idx_created_at (created_at)
);
```

#### 2.4.2 后端实现

```typescript
aiToolboxHistory: {
  // 保存生成记录
  save: protectedProcedure
    .input(z.object({
      toolType: z.enum(['email', 'elevator_pitch', 'linkedin_headline', 'linkedin_about', 'linkedin_post', 'personal_brand']),
      inputData: z.record(z.any()),
      outputContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await db.insert(aiToolboxHistory).values({
        userId: ctx.user.openId,
        toolType: input.toolType,
        inputData: input.inputData,
        outputContent: input.outputContent,
      });
      return { id: result.insertId };
    }),

  // 获取历史记录
  list: protectedProcedure
    .input(z.object({
      toolType: z.enum(['email', 'elevator_pitch', 'linkedin_headline', 'linkedin_about', 'linkedin_post', 'personal_brand']),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      return db.select()
        .from(aiToolboxHistory)
        .where(and(
          eq(aiToolboxHistory.userId, ctx.user.openId),
          eq(aiToolboxHistory.toolType, input.toolType)
        ))
        .orderBy(desc(aiToolboxHistory.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  // 删除记录
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(aiToolboxHistory)
        .where(and(
          eq(aiToolboxHistory.id, input.id),
          eq(aiToolboxHistory.userId, ctx.user.openId)
        ));
      return { success: true };
    }),
},
```

#### 2.4.3 前端实现

```tsx
// components/ViewHistorySheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { History, Trash2, Copy } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatDistanceToNow } from 'date-fns';

interface ViewHistorySheetProps {
  toolType: 'email' | 'elevator_pitch' | 'linkedin_headline' | 'linkedin_about' | 'linkedin_post' | 'personal_brand';
  onSelect?: (content: string) => void;
}

export function ViewHistorySheet({ toolType, onSelect }: ViewHistorySheetProps) {
  const { data: history, refetch } = trpc.aiToolboxHistory.list.useQuery({ toolType });
  const deleteHistory = trpc.aiToolboxHistory.delete.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="w-4 h-4 mr-2" />
          View History
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Generation History</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {history?.map((item) => (
            <div key={item.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(item.outputContent);
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteHistory.mutate({ id: item.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm line-clamp-4">{item.outputContent}</p>
              {onSelect && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 p-0"
                  onClick={() => onSelect(item.outputContent)}
                >
                  Use this content
                </Button>
              )}
            </div>
          ))}
          {(!history || history.length === 0) && (
            <div className="text-center text-muted-foreground py-8">
              No history yet
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

### 2.5 AI Toolbox - Import from Board

**需求描述**：在 AI Toolbox 各功能页面添加 "Import from Board" 按钮，允许用户从 Job Tracker 导入职位信息自动填充表单。

**优先级**：P0  
**预估工时**：2h

#### 2.5.1 前端实现

```tsx
// components/ImportFromBoardDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';

interface ImportFromBoardDialogProps {
  onSelect: (job: { company: string; position: string; description?: string }) => void;
}

export function ImportFromBoardDialog({ onSelect }: ImportFromBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: jobs } = trpc.jobTracker.list.useQuery();

  const filteredJobs = jobs?.filter(job => 
    job.company.toLowerCase().includes(search.toLowerCase()) ||
    job.position.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Import from Board
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import from Job Tracker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredJobs?.map((job) => (
              <div
                key={job.id}
                className="p-3 border rounded-lg cursor-pointer hover:bg-accent"
                onClick={() => {
                  onSelect({
                    company: job.company,
                    position: job.position,
                    description: job.description,
                  });
                  setOpen(false);
                }}
              >
                <div className="font-medium">{job.position}</div>
                <div className="text-sm text-muted-foreground">{job.company}</div>
              </div>
            ))}
            {(!filteredJobs || filteredJobs.length === 0) && (
              <div className="text-center text-muted-foreground py-4">
                No jobs found in your tracker
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**使用示例**：

```tsx
// pages/EmailWriter.tsx
function EmailWriter() {
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <ViewHistorySheet toolType="email" />
        <ImportFromBoardDialog 
          onSelect={(job) => {
            setCompany(job.company);
            setPosition(job.position);
          }} 
        />
      </div>
      {/* 表单内容 */}
    </div>
  );
}
```

---

### 2.6 Networking 模块

**需求描述**：完整的人脉管理模块，包括联系人管理、互动记录、跟进提醒等功能。

**优先级**：P1  
**预估工时**：16h

#### 2.6.1 数据库设计

**表 1**: `contacts`

```sql
CREATE TABLE contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  position VARCHAR(255),
  linkedin_url VARCHAR(500),
  relationship_type ENUM('recruiter', 'hiring_manager', 'referral', 'colleague', 'other') DEFAULT 'other',
  status ENUM('to_contact', 'contacted', 'replied', 'meeting_scheduled', 'followed_up') DEFAULT 'to_contact',
  notes TEXT,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);
```

**表 2**: `contact_interactions`

```sql
CREATE TABLE contact_interactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NOT NULL,
  interaction_type ENUM('email', 'call', 'meeting', 'linkedin_message', 'other') NOT NULL,
  content TEXT,
  interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  INDEX idx_contact_id (contact_id),
  INDEX idx_follow_up_date (follow_up_date)
);
```

#### 2.6.2 后端实现

```typescript
networking: {
  contacts: {
    list: protectedProcedure
      .input(z.object({
        status: z.enum(['to_contact', 'contacted', 'replied', 'meeting_scheduled', 'followed_up']).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        let query = db.select().from(contacts).where(eq(contacts.userId, ctx.user.openId));
        
        if (input?.status) {
          query = query.where(eq(contacts.status, input.status));
        }
        if (input?.search) {
          query = query.where(or(
            like(contacts.name, `%${input.search}%`),
            like(contacts.company, `%${input.search}%`)
          ));
        }
        
        return query.orderBy(desc(contacts.updatedAt));
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        position: z.string().optional(),
        linkedinUrl: z.string().url().optional(),
        relationshipType: z.enum(['recruiter', 'hiring_manager', 'referral', 'colleague', 'other']).optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [result] = await db.insert(contacts).values({
          userId: ctx.user.openId,
          ...input,
          tags: input.tags ? JSON.stringify(input.tags) : null,
        });
        return { id: result.insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        position: z.string().optional(),
        linkedinUrl: z.string().url().optional(),
        relationshipType: z.enum(['recruiter', 'hiring_manager', 'referral', 'colleague', 'other']).optional(),
        status: z.enum(['to_contact', 'contacted', 'replied', 'meeting_scheduled', 'followed_up']).optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.update(contacts)
          .set({
            ...data,
            tags: data.tags ? JSON.stringify(data.tags) : undefined,
          })
          .where(and(
            eq(contacts.id, id),
            eq(contacts.userId, ctx.user.openId)
          ));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.delete(contacts)
          .where(and(
            eq(contacts.id, input.id),
            eq(contacts.userId, ctx.user.openId)
          ));
        return { success: true };
      }),
  },

  interactions: {
    list: protectedProcedure
      .input(z.object({ contactId: z.number() }))
      .query(async ({ ctx, input }) => {
        // 验证联系人属于当前用户
        const [contact] = await db.select()
          .from(contacts)
          .where(and(
            eq(contacts.id, input.contactId),
            eq(contacts.userId, ctx.user.openId)
          ));
        
        if (!contact) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        
        return db.select()
          .from(contactInteractions)
          .where(eq(contactInteractions.contactId, input.contactId))
          .orderBy(desc(contactInteractions.interactionDate));
      }),

    create: protectedProcedure
      .input(z.object({
        contactId: z.number(),
        interactionType: z.enum(['email', 'call', 'meeting', 'linkedin_message', 'other']),
        content: z.string().optional(),
        followUpDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 验证联系人属于当前用户
        const [contact] = await db.select()
          .from(contacts)
          .where(and(
            eq(contacts.id, input.contactId),
            eq(contacts.userId, ctx.user.openId)
          ));
        
        if (!contact) {
          throw new TRPCError({ code: 'NOT_FOUND' });
        }
        
        const [result] = await db.insert(contactInteractions).values(input);
        return { id: result.insertId };
      }),
  },

  // 获取需要跟进的联系人
  getFollowUps: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    return db.select({
      contact: contacts,
      interaction: contactInteractions,
    })
      .from(contactInteractions)
      .innerJoin(contacts, eq(contactInteractions.contactId, contacts.id))
      .where(and(
        eq(contacts.userId, ctx.user.openId),
        lte(contactInteractions.followUpDate, today)
      ))
      .orderBy(contactInteractions.followUpDate);
  }),
},
```

---

## 三、Chrome Extension 功能实现

### 3.1 Extension 架构概述

UHired Chrome Extension 采用 Manifest V3 架构，主要包含以下组件：

| 组件 | 文件 | 功能 |
|------|------|------|
| Background Service Worker | `background.js` | 处理后台任务、API 调用 |
| Content Script | `content.js` | 注入 LinkedIn 页面，抓取职位信息 |
| Popup | `popup.html/js` | 扩展弹窗界面 |
| Side Panel | `sidepanel.html/js` | 侧边栏界面（可选） |

### 3.2 Tailor Resume 功能

**需求描述**：在 LinkedIn 职位页面点击 "Tailor Resume" 按钮后，自动提取 JD 信息并跳转到 UHired Resume Builder 进行简历定制。

**预估工时**：4h

#### 3.2.1 Content Script 实现

```javascript
// content.js - LinkedIn 职位页面注入

// 提取职位信息
function extractJobInfo() {
  const jobTitle = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim();
  const company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim();
  const location = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim();
  const description = document.querySelector('.jobs-description__content')?.textContent?.trim();
  const linkedinUrl = window.location.href;

  return {
    jobTitle,
    company,
    location,
    description,
    linkedinUrl,
  };
}

// 注入 Tailor Resume 按钮
function injectTailorResumeButton() {
  const actionsContainer = document.querySelector('.jobs-apply-button--top-card');
  if (!actionsContainer || document.querySelector('#uhired-tailor-resume-btn')) return;

  const button = document.createElement('button');
  button.id = 'uhired-tailor-resume-btn';
  button.className = 'uhired-btn uhired-btn-primary';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
    Tailor Resume
  `;

  button.addEventListener('click', () => {
    const jobInfo = extractJobInfo();
    // 发送消息到 background script
    chrome.runtime.sendMessage({
      type: 'TAILOR_RESUME',
      payload: jobInfo,
    });
  });

  actionsContainer.appendChild(button);
}

// 监听页面变化
const observer = new MutationObserver(() => {
  if (window.location.href.includes('/jobs/')) {
    injectTailorResumeButton();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
```

#### 3.2.2 Background Script 实现

```javascript
// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TAILOR_RESUME') {
    const { jobTitle, company, description, linkedinUrl } = message.payload;
    
    // 存储 JD 信息到 storage
    chrome.storage.local.set({ 
      pendingTailorJob: message.payload 
    }, () => {
      // 打开 UHired Resume Builder 页面
      const uhiredUrl = `${UHIRED_BASE_URL}/resume-builder/tailor?source=extension`;
      chrome.tabs.create({ url: uhiredUrl });
    });
  }
});
```

#### 3.2.3 Web 端接收逻辑

```typescript
// pages/ResumeBuilder.tsx

useEffect(() => {
  // 检查是否从 Extension 跳转
  const params = new URLSearchParams(window.location.search);
  if (params.get('source') === 'extension') {
    // 从 Extension 获取 JD 信息
    window.addEventListener('message', (event) => {
      if (event.data.type === 'UHIRED_JOB_INFO') {
        setTargetJob(event.data.payload);
        // 自动开始简历定制流程
        startTailorProcess(event.data.payload);
      }
    });
    
    // 通知 Extension 页面已准备好
    window.postMessage({ type: 'UHIRED_READY' }, '*');
  }
}, []);
```

---

### 3.3 View Details 功能

**需求描述**：在 Extension 弹窗中直接显示职位详情，无需跳转页面。

**预估工时**：2h

#### 3.3.1 Popup 界面实现

```html
<!-- popup.html -->
<div id="job-details-panel" class="hidden">
  <div class="panel-header">
    <button id="back-btn" class="icon-btn">
      <svg><!-- 返回图标 --></svg>
    </button>
    <h2>Job Details</h2>
  </div>
  <div class="panel-content">
    <div id="job-title" class="job-title"></div>
    <div id="job-company" class="job-company"></div>
    <div id="job-location" class="job-meta"></div>
    <div id="job-salary" class="job-meta"></div>
    <div class="divider"></div>
    <div id="job-description" class="job-description"></div>
    <div class="actions">
      <button id="save-job-btn" class="btn btn-primary">Save to Tracker</button>
      <button id="tailor-resume-btn" class="btn btn-secondary">Tailor Resume</button>
    </div>
  </div>
</div>
```

```javascript
// popup.js

// 显示职位详情
function showJobDetails(jobInfo) {
  document.getElementById('job-title').textContent = jobInfo.jobTitle;
  document.getElementById('job-company').textContent = jobInfo.company;
  document.getElementById('job-location').textContent = jobInfo.location;
  document.getElementById('job-salary').textContent = jobInfo.salary || 'Not specified';
  document.getElementById('job-description').textContent = jobInfo.description;
  
  document.getElementById('main-panel').classList.add('hidden');
  document.getElementById('job-details-panel').classList.remove('hidden');
}

// 返回主界面
document.getElementById('back-btn').addEventListener('click', () => {
  document.getElementById('job-details-panel').classList.add('hidden');
  document.getElementById('main-panel').classList.remove('hidden');
});

// 获取当前页面职位信息
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0].url.includes('linkedin.com/jobs/')) {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_JOB_INFO' }, (response) => {
      if (response) {
        document.getElementById('view-details-btn').addEventListener('click', () => {
          showJobDetails(response);
        });
      }
    });
  }
});
```

---

### 3.4 AI Cover Letter Generator

**需求描述**：基于当前职位信息自动生成求职信。

**预估工时**：4h

#### 3.4.1 API 设计

```typescript
// server/routers.ts

aiToolbox: {
  generateCoverLetter: protectedProcedure
    .input(z.object({
      jobTitle: z.string(),
      company: z.string(),
      jobDescription: z.string(),
      resumeContent: z.string().optional(),
      tone: z.enum(['professional', 'enthusiastic', 'creative']).default('professional'),
    }))
    .mutation(async ({ ctx, input }) => {
      const prompt = `Generate a professional cover letter for the following job:

Job Title: ${input.jobTitle}
Company: ${input.company}
Job Description: ${input.jobDescription}

${input.resumeContent ? `Candidate's Resume:\n${input.resumeContent}` : ''}

Requirements:
- Tone: ${input.tone}
- Length: 3-4 paragraphs
- Highlight relevant skills and experience
- Show enthusiasm for the role and company
- Include a strong opening and closing

Generate the cover letter:`;

      const response = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are an expert career coach and professional writer.' },
          { role: 'user', content: prompt },
        ],
      });

      const coverLetter = response.choices[0].message.content;

      // 保存到历史记录
      await db.insert(aiToolboxHistory).values({
        userId: ctx.user.openId,
        toolType: 'cover_letter',
        inputData: input,
        outputContent: coverLetter,
      });

      return { coverLetter };
    }),
},
```

#### 3.4.2 Extension 集成

```javascript
// popup.js

document.getElementById('generate-cover-letter-btn').addEventListener('click', async () => {
  const jobInfo = await getCurrentJobInfo();
  
  // 显示加载状态
  showLoading('Generating cover letter...');
  
  try {
    const response = await fetch(`${UHIRED_API_URL}/api/trpc/aiToolbox.generateCoverLetter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({
        jobTitle: jobInfo.jobTitle,
        company: jobInfo.company,
        jobDescription: jobInfo.description,
      }),
    });
    
    const result = await response.json();
    showCoverLetterResult(result.coverLetter);
  } catch (error) {
    showError('Failed to generate cover letter');
  }
});
```

---

### 3.5 Summarize Job Description

**需求描述**：AI 自动提取职位描述的关键信息，生成简洁摘要。

**预估工时**：3h

#### 3.5.1 API 设计

```typescript
aiToolbox: {
  summarizeJobDescription: protectedProcedure
    .input(z.object({
      jobDescription: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const response = await invokeLLM({
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing job descriptions and extracting key information.' 
          },
          { 
            role: 'user', 
            content: `Analyze this job description and provide a structured summary:

${input.jobDescription}

Provide the summary in the following JSON format:
{
  "keyResponsibilities": ["responsibility 1", "responsibility 2", ...],
  "requiredSkills": ["skill 1", "skill 2", ...],
  "preferredSkills": ["skill 1", "skill 2", ...],
  "experienceLevel": "entry/mid/senior/lead",
  "workType": "remote/hybrid/onsite",
  "teamSize": "small/medium/large/unknown",
  "keyHighlights": ["highlight 1", "highlight 2", ...],
  "potentialChallenges": ["challenge 1", "challenge 2", ...],
  "summary": "2-3 sentence summary of the role"
}` 
          },
        ],
        response_format: { type: 'json_object' },
      });

      const summary = JSON.parse(response.choices[0].message.content);
      return summary;
    }),
},
```

---

### 3.6 Find out Who's Hiring

**需求描述**：查找当前公司的招聘人员和招聘经理。

**预估工时**：4h

#### 3.6.1 实现方案

使用 LinkedIn X-ray Search 技术，通过 Google 搜索 LinkedIn 个人资料。

```typescript
// server/routers.ts

networking: {
  findRecruiters: protectedProcedure
    .input(z.object({
      company: z.string(),
      role: z.string().optional(),
      location: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // 构建 X-ray 搜索查询
      const searchTerms = [
        `site:linkedin.com/in/`,
        `"${input.company}"`,
        `("recruiter" OR "talent acquisition" OR "hiring manager" OR "HR")`,
      ];
      
      if (input.role) {
        searchTerms.push(`"${input.role}"`);
      }
      if (input.location) {
        searchTerms.push(`"${input.location}"`);
      }
      
      const query = searchTerms.join(' ');
      
      // 使用 Tavily Search API
      const results = await tavilySearch({
        query,
        max_results: 10,
        include_domains: ['linkedin.com'],
      });
      
      // 解析搜索结果
      return results.map(result => ({
        name: extractNameFromLinkedIn(result.title),
        title: extractTitleFromLinkedIn(result.snippet),
        linkedinUrl: result.url,
        company: input.company,
      }));
    }),
},
```

---

## 四、测试策略

### 4.1 单元测试

每个功能模块都需要编写单元测试，覆盖以下场景：

| 测试类型 | 覆盖场景 |
|---------|---------|
| 正常流程 | 功能正常执行的主要路径 |
| 边界条件 | 空值、最大值、最小值 |
| 错误处理 | 无效输入、权限不足、资源不存在 |
| 并发场景 | 多用户同时操作 |

### 4.2 E2E 测试

使用 Playwright 进行端到端测试：

```typescript
// e2e/jobTracker.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Job Tracker', () => {
  test('should add rejected column', async ({ page }) => {
    await page.goto('/job-tracker');
    
    // 验证 Rejected 列存在
    await expect(page.locator('[data-column="rejected"]')).toBeVisible();
  });

  test('should drag job to rejected column', async ({ page }) => {
    await page.goto('/job-tracker');
    
    // 拖拽职位卡片到 Rejected 列
    const jobCard = page.locator('[data-job-id="1"]');
    const rejectedColumn = page.locator('[data-column="rejected"]');
    
    await jobCard.dragTo(rejectedColumn);
    
    // 验证职位状态已更新
    await expect(jobCard).toHaveAttribute('data-status', 'rejected');
  });
});
```

### 4.3 Extension 测试

使用 Puppeteer 进行 Extension 测试：

```javascript
// extension-tests/tailor-resume.test.js
const puppeteer = require('puppeteer');

describe('Tailor Resume Button', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    page = await browser.newPage();
  });

  test('should inject button on LinkedIn job page', async () => {
    await page.goto('https://www.linkedin.com/jobs/view/123456');
    
    // 等待按钮注入
    await page.waitForSelector('#uhired-tailor-resume-btn');
    
    const button = await page.$('#uhired-tailor-resume-btn');
    expect(button).not.toBeNull();
  });

  afterAll(async () => {
    await browser.close();
  });
});
```

---

## 五、实施计划

### 5.1 Phase 1: 核心功能（Week 1）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| Job Tracker - Rejected 列 | 1h | P0 |
| AI Toolbox - View History | 2h | P0 |
| AI Toolbox - Import from Board | 2h | P0 |
| Extension - Tailor Resume | 4h | P0 |
| Extension - View Details | 2h | P0 |
| **小计** | **11h** | |

### 5.2 Phase 2: 增强功能（Week 2）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| Job Tracker - Add Column | 4h | P1 |
| Jobs Board - 职位详情页 | 6h | P1 |
| Extension - AI Cover Letter | 4h | P1 |
| Extension - Summarize JD | 3h | P1 |
| **小计** | **17h** | |

### 5.3 Phase 3: 完整功能（Week 3-4）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| Networking 模块 | 16h | P1 |
| Extension - Find Recruiters | 4h | P1 |
| Extension - LinkedIn Optimization | 6h | P2 |
| Chrome Extension 入口页面 | 2h | P1 |
| **小计** | **28h** | |

### 5.4 总工时

| 阶段 | 工时 |
|------|------|
| Phase 1 | 11h |
| Phase 2 | 17h |
| Phase 3 | 28h |
| 测试和修复 | 9h |
| **总计** | **65h** |

---

## 六、风险和依赖

### 6.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LinkedIn 页面结构变化 | Extension 功能失效 | 定期监控，使用多选择器策略 |
| LLM API 响应延迟 | 用户体验下降 | 添加加载状态，实现流式响应 |
| 数据库迁移失败 | 功能无法上线 | 先在测试环境验证，准备回滚方案 |

### 6.2 外部依赖

| 依赖 | 用途 | 备选方案 |
|------|------|---------|
| Tavily Search API | Find Recruiters 功能 | 使用 Google Custom Search API |
| Apify | LinkedIn 数据抓取 | 使用 Bright Data 或自建爬虫 |
| OpenAI API | AI 功能 | 使用 Claude 或本地模型 |

---

**文档结束**
