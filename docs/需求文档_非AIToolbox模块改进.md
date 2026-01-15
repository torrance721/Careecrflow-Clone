# UHired 功能改进需求文档

**文档版本**: v1.0  
**更新日期**: 2026-01-12  
**作者**: Manus AI  
**范围**: Jobs Board、Job Tracker、Mock Interviews 模块

---

## 一、文档概述

本需求文档基于 Careerflow.ai vs UHired 差异点分析，详细定义了三个核心模块的功能改进需求。文档不包含 AI Toolbox 模块，该模块将在后续独立文档中定义。

---

## 二、Jobs Board 模块改进

### 2.1 需求背景

当前 UHired 的 Jobs Board 模块仅提供职位列表页，用户点击职位卡片后无法查看完整的职位详情。Careerflow.ai 提供了完整的职位详情页，包含职位描述、公司信息、申请按钮等功能，用户体验更加完善。

### 2.2 功能需求：职位详情页

#### 2.2.1 页面入口

用户在 Jobs Board 列表页点击任意职位卡片时，应跳转到该职位的详情页。页面 URL 格式建议为 `/jobs/:jobId`，其中 `jobId` 为职位的唯一标识符。

#### 2.2.2 页面结构

职位详情页应包含以下区域：

| 区域 | 内容 | 优先级 |
|------|------|--------|
| 顶部信息区 | 公司 Logo、职位名称、公司名称、地点、薪资范围、发布时间 | P0 |
| 操作按钮区 | Track 按钮、Apply 按钮、Share 按钮、Save 按钮 | P0 |
| 职位描述区 | 完整的职位描述文本，支持 Markdown 渲染 | P0 |
| 职位要求区 | 技能要求、经验要求、学历要求 | P0 |
| 公司信息区 | 公司简介、公司规模、行业、公司网站链接 | P1 |
| 福利待遇区 | 福利列表（如有数据） | P2 |
| 相似职位区 | 推荐 3-5 个相似职位卡片 | P2 |

#### 2.2.3 交互行为

| 交互点 | 行为描述 | 优先级 |
|--------|----------|--------|
| Track 按钮点击 | 将职位添加到 Job Tracker 的 Saved 列，按钮状态变为 "Tracked"，显示成功 Toast | P0 |
| Apply 按钮点击 | 跳转到职位原始链接（LinkedIn/公司官网），在新标签页打开 | P0 |
| Share 按钮点击 | 显示分享弹窗，支持复制链接、分享到社交媒体 | P1 |
| Save 按钮点击 | 收藏职位到用户的收藏列表（可选功能） | P2 |
| 返回按钮点击 | 返回 Jobs Board 列表页，保持之前的筛选状态 | P0 |
| 相似职位卡片点击 | 跳转到对应职位的详情页 | P2 |

#### 2.2.4 数据需求

职位详情页需要以下数据字段：

```typescript
interface JobDetail {
  id: string;
  title: string;
  company: {
    name: string;
    logo: string;
    description: string;
    size: string;
    industry: string;
    website: string;
  };
  location: string;
  salaryRange: string;
  jobType: string; // Full-time, Part-time, Contract, Internship
  workMode: string; // Remote, Onsite, Hybrid
  postedAt: Date;
  description: string; // Markdown 格式
  requirements: {
    skills: string[];
    experience: string;
    education: string;
  };
  benefits: string[];
  applyUrl: string;
  isTracked: boolean;
}
```

#### 2.2.5 API 需求

| 端点 | 方法 | 描述 |
|------|------|------|
| `jobs.getById` | Query | 根据 jobId 获取职位详情 |
| `jobs.track` | Mutation | 将职位添加到 Job Tracker |
| `jobs.untrack` | Mutation | 从 Job Tracker 移除职位 |
| `jobs.getSimilar` | Query | 获取相似职位列表 |

#### 2.2.6 UI 设计参考

页面布局建议采用两栏设计：
- **左侧主内容区（70%）**：职位描述、要求、福利
- **右侧信息卡片（30%）**：公司信息、操作按钮、相似职位

移动端采用单栏布局，操作按钮固定在底部。

#### 2.2.7 验收标准

1. 用户点击职位卡片后能正确跳转到详情页
2. 详情页显示完整的职位信息
3. Track 按钮功能正常，状态正确更新
4. Apply 按钮能正确跳转到原始链接
5. 返回按钮能正确返回列表页
6. 页面在移动端和桌面端都能正常显示

---

## 三、Job Tracker 模块改进

### 3.1 需求背景

当前 UHired 的 Job Tracker 模块提供了基础的 Kanban 看板功能，包含 Saved、Applied、Interviewing、Offer 四个固定列。Careerflow.ai 额外提供了 Rejected 列和 Add Column 自定义列功能，使用户能够更灵活地管理求职流程。

### 3.2 功能需求 1：Rejected 列

#### 3.2.1 需求描述

在现有的 Kanban 看板中添加 "Rejected" 列，用于记录被拒绝的职位申请。该列应位于 Offer 列之后，作为求职流程的最终状态之一。

#### 3.2.2 列配置

| 属性 | 值 |
|------|-----|
| 列名称 | Rejected |
| 列颜色 | 红色 (#EF4444) |
| 列位置 | Offer 列之后（最右侧） |
| 默认展开 | 是 |

#### 3.2.3 交互行为

| 交互点 | 行为描述 |
|--------|----------|
| 拖拽卡片到 Rejected 列 | 卡片移动到 Rejected 列，更新数据库状态 |
| 从 Rejected 列拖出卡片 | 卡片移动到目标列，更新数据库状态 |
| 统计卡片更新 | 顶部统计区域不显示 Rejected 数量（避免负面情绪） |

#### 3.2.4 数据库变更

需要更新 `job_applications` 表的 `status` 枚举，添加 `rejected` 值：

```sql
ALTER TABLE job_applications 
MODIFY COLUMN status ENUM('saved', 'applied', 'interviewing', 'offer', 'rejected') 
DEFAULT 'saved';
```

#### 3.2.5 验收标准

1. Kanban 看板显示 Rejected 列
2. 卡片可以拖拽到 Rejected 列
3. 卡片可以从 Rejected 列拖出
4. 数据库正确保存 rejected 状态

### 3.3 功能需求 2：Add Column 自定义列

#### 3.3.1 需求描述

允许用户在 Kanban 看板中添加自定义列，以适应不同用户的求职流程。例如，用户可能需要添加 "Phone Screen"、"Onsite"、"Negotiation" 等自定义阶段。

#### 3.3.2 入口设计

在 Kanban 看板最右侧（Rejected 列之后）显示 "+" 按钮，点击后弹出添加列的对话框。

#### 3.3.3 添加列对话框

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 列名称 | 文本输入 | 是 | 最大 20 字符 |
| 列颜色 | 颜色选择器 | 是 | 提供 8 个预设颜色 |
| 列位置 | 下拉选择 | 是 | 选择插入位置（在哪个列之后） |

#### 3.3.4 预设颜色

| 颜色名称 | 颜色值 |
|----------|--------|
| 蓝色 | #3B82F6 |
| 绿色 | #22C55E |
| 黄色 | #EAB308 |
| 橙色 | #F97316 |
| 红色 | #EF4444 |
| 紫色 | #A855F7 |
| 粉色 | #EC4899 |
| 灰色 | #6B7280 |

#### 3.3.5 交互行为

| 交互点 | 行为描述 |
|--------|----------|
| 点击 "+" 按钮 | 打开添加列对话框 |
| 填写表单并点击确认 | 创建新列，刷新看板 |
| 点击取消 | 关闭对话框，不做任何操作 |
| 列标题右键菜单 | 显示编辑/删除选项（仅自定义列） |
| 编辑列 | 打开编辑对话框，可修改名称和颜色 |
| 删除列 | 确认对话框，删除后卡片移动到 Saved 列 |
| 拖拽列 | 调整列顺序（可选功能，P2） |

#### 3.3.6 数据库设计

需要创建新表存储自定义列配置：

```sql
CREATE TABLE job_tracker_columns (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL,
  position INT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

系统默认列（Saved, Applied, Interviewing, Offer, Rejected）的 `is_system` 为 `true`，不可删除。

#### 3.3.7 API 需求

| 端点 | 方法 | 描述 |
|------|------|------|
| `jobTracker.getColumns` | Query | 获取用户的所有列配置 |
| `jobTracker.createColumn` | Mutation | 创建自定义列 |
| `jobTracker.updateColumn` | Mutation | 更新列配置（名称、颜色、位置） |
| `jobTracker.deleteColumn` | Mutation | 删除自定义列 |
| `jobTracker.reorderColumns` | Mutation | 调整列顺序 |

#### 3.3.8 验收标准

1. 用户可以点击 "+" 按钮添加自定义列
2. 自定义列显示在看板中，颜色正确
3. 卡片可以拖拽到自定义列
4. 用户可以编辑自定义列的名称和颜色
5. 用户可以删除自定义列，卡片正确迁移
6. 系统默认列不可删除
7. 列配置在用户重新登录后保持

---

## 四、Mock Interviews 模块改进（可选）

### 4.1 需求背景

当前 UHired 的 Mock Interviews 模块采用 "Topic Practice" 输入框设计，用户输入目标职位后开始练习。Careerflow.ai 采用场景卡片设计，提供预设的面试场景供用户选择。两种设计各有优势，本需求为可选实现。

### 4.2 功能需求：场景卡片快捷入口

#### 4.2.1 需求描述

在现有的职位输入框上方添加场景卡片快捷入口，提供常见面试场景的快速选择。用户可以直接点击场景卡片开始练习，也可以继续使用输入框输入自定义职位。

#### 4.2.2 场景卡片列表

| 场景名称 | 图标 | 描述 | 预设职位 |
|----------|------|------|----------|
| Behavioral | 🎯 | 行为面试问题 | General Behavioral Interview |
| Technical | 💻 | 技术面试问题 | Software Engineer |
| Case Study | 📊 | 案例分析面试 | Management Consultant |
| Product | 🚀 | 产品经理面试 | Product Manager |
| Leadership | 👔 | 领导力面试 | Senior Manager |
| General | 💼 | 通用面试问题 | General Interview |

#### 4.2.3 页面布局

```
┌─────────────────────────────────────────────────────────┐
│                    Start Topic Practice                  │
│         Enter your target position or select a scene     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ 🎯      │ │ 💻      │ │ 📊      │ │ 🚀      │        │
│  │Behavioral│ │Technical│ │Case Study│ │ Product │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│  ┌─────────┐ ┌─────────┐                                │
│  │ 👔      │ │ 💼      │                                │
│  │Leadership│ │ General │                                │
│  └─────────┘ └─────────┘                                │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │ e.g., Product Manager at Google                     ││
│  └─────────────────────────────────────────────────────┘│
│                    [ Start Practice → ]                  │
└─────────────────────────────────────────────────────────┘
```

#### 4.2.4 交互行为

| 交互点 | 行为描述 |
|--------|----------|
| 点击场景卡片 | 将预设职位填入输入框，高亮选中的卡片 |
| 在输入框输入 | 取消场景卡片的选中状态 |
| 点击 Start Practice | 使用输入框中的职位开始练习 |

#### 4.2.5 验收标准

1. 场景卡片正确显示在输入框上方
2. 点击场景卡片能正确填充预设职位
3. 用户可以修改预设职位后开始练习
4. 输入框输入时取消卡片选中状态
5. 移动端卡片布局正确（2x3 或滚动）

---

## 五、优先级和工时估算

| 需求 | 模块 | 优先级 | 预估工时 | 依赖 |
|------|------|--------|----------|------|
| 职位详情页 | Jobs Board | P1 | 6h | 无 |
| Rejected 列 | Job Tracker | P0 | 1h | 无 |
| Add Column 自定义列 | Job Tracker | P1 | 4h | 无 |
| 场景卡片快捷入口 | Mock Interviews | P2 | 2h | 无 |

**总预估工时**: 13h

**建议实施顺序**:
1. Rejected 列（1h）- 最简单，快速完成
2. Add Column 自定义列（4h）- 提升 Job Tracker 灵活性
3. 职位详情页（6h）- 完善 Jobs Board 功能
4. 场景卡片快捷入口（2h）- 可选优化

---

## 六、技术实现建议

### 6.1 Jobs Board 职位详情页

建议使用 React Router 的动态路由实现：

```tsx
// App.tsx
<Route path="/jobs/:jobId" component={JobDetail} />

// JobDetail.tsx
const { jobId } = useParams();
const { data: job } = trpc.jobs.getById.useQuery({ id: jobId });
```

### 6.2 Job Tracker 自定义列

建议使用 Zustand 或 Context 管理列配置状态，配合 React DnD 实现拖拽功能：

```tsx
// useJobTrackerColumns.ts
const useJobTrackerColumns = create((set) => ({
  columns: [],
  addColumn: (column) => set((state) => ({ 
    columns: [...state.columns, column] 
  })),
  // ...
}));
```

### 6.3 数据库迁移

建议使用 Drizzle 的迁移功能：

```bash
pnpm db:push
```

---

## 七、风险和注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 职位详情数据不完整 | 详情页显示空白 | 添加默认值和占位符 |
| 自定义列过多影响性能 | 看板加载缓慢 | 限制最多 10 个自定义列 |
| 删除列时数据丢失 | 用户卡片丢失 | 删除前确认，卡片迁移到 Saved |
| 移动端布局问题 | 用户体验差 | 优先测试移动端 |

---

## 八、附录

### 8.1 参考资料

- Careerflow.ai Job Tracker: https://app.careerflow.ai/jobtracker
- Careerflow.ai Jobs: https://app.careerflow.ai/jobs
- UHired 差异点文档: `/docs/Careerflow_vs_UHired_详细差异点文档.md`

### 8.2 相关文档

- 整体交互改进方案: `/docs/整体交互改进方案.md`
- Web E2E 对比测试: `/docs/web_e2e_对比测试.md`

---

**文档结束**
