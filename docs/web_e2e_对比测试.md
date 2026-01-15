# Web 端 E2E 对比测试记录

## 测试日期：2026-01-12

---

## 一、Careerflow.ai 全站功能测试

### 1. Dashboard (首页)

**页面结构**：
- 顶部：Logo + Premium Plus 按钮 + 用户头像
- 左侧：导航菜单（Home, Jobs, Resume Builder, Job Tracker, Mock Interviews, Application Materials, Networking, AI Toolbox, Chrome Extension, Suggest a Feature, Report a bug）
- 主内容区：
  - 欢迎语：Hi, Li
  - Tab 切换：Application Materials | Jobs | Networking | Interviews
  - Your Progress 区域（任务列表 + 进度条）
  - 右侧卡片（动态内容 + CTA 按钮）
  - Quick Stats（Jobs Tracker + Networking Tracker）
  - 资源推荐区域

**交互测试**：
- [ ] Tab 切换测试
- [ ] 任务项点击测试
- [ ] Explore All Features 按钮测试
- [ ] Quick Stats 卡片点击测试
- [ ] 资源卡片点击测试

### 2. Jobs (职位搜索)

**页面结构**：
- 顶部：Beta 标识 + 搜索框 + Filter 按钮
- 左侧：Latest Jobs 列表（1000+ results）
- 右侧：职位详情面板（点击左侧职位后显示）

**Filter 选项**：
- Posted: Start date - End date
- Location: Select location
- Clear all / Apply 按钮

**职位卡片信息**：
- 职位名称
- 公司名称
- 地点
- 发布时间（Posted X days ago）

**职位详情面板**：
- 职位名称 + 公司 + 地点 + 薪资
- Added on 日期
- Apply 按钮（蓝色）+ Save 按钮
- 职位描述

**交互测试**：
- [x] 搜索框输入
- [x] Filter 弹窗展开
- [x] 职位卡片点击显示详情
- [ ] Apply 按钮点击
- [ ] Save 按钮点击

### 3. Resume Builder (简历构建器)

**页面结构**：
- 顶部：搜索框 + Filter + Create New Resume 按钮
- Tab 切换：Base Resumes | Job Tailored Resumes
- 简历卡片列表

**简历卡片功能**：
- 预览图 + 评分（27%）
- 简历名称 + 最后编辑时间
- 操作按钮：Preview, Edit Resume, Tailor for job, Clone, Delete, Set as default

**交互测试**：
- [x] Tab 切换
- [x] 简历卡片 Hover 显示操作按钮
- [ ] Create New Resume 流程
- [ ] Edit Resume 进入编辑器

### 4. Job Tracker (职位追踪)

**页面结构**：
- 顶部：搜索框 + Filter + Add Job 按钮 + 下拉菜单
- Kanban 看板：5 列
  - Saved (0 Jobs)
  - Applied (0 Jobs)
  - Interviewing (0 Jobs)
  - Offer (0 Jobs)
  - Rejected (0 Jobs)
- 右侧：Add Column 按钮（自定义列）

**教程引导**：
- 首次进入显示教程弹窗（Step 1 of 5）
- Skip / Next 按钮

**交互测试**：
- [x] 教程引导 Skip
- [x] Kanban 列查看（5列）
- [x] Add Column 按钮
- [ ] Add Job 流程
- [ ] 卡片拖拽

### 5. Mock Interviews (模拟面试)

**页面结构**：
- 顶部：Start Mock Interview 按钮 + 搜索框
- 分类筛选：All Scenario, Technical, Behavioral, Negotiations, Screening, Situational, Case Studies, Leadership, Cultural Fit, Career Dev, Exit, Industry, Challenges
- 场景卡片列表

**场景卡片功能**：
- 场景名称（如 Software Engineering, Frontend Engineer）
- 场景描述
- 时长（25-45 Mins）
- Start Interview 按钮

**交互测试**：
- [x] 分类筛选点击
- [x] 场景卡片查看
- [ ] Start Interview 流程

### 6. Application Materials (申请材料)

待测试...

### 7. Networking (人脉管理)

待测试...

### 6. AI Toolbox (AI 工具箱)

**子功能列表**：
- Personal Brand Statement
- Email Writer
- Elevator Pitch
- LinkedIn Headline
- LinkedIn About
- LinkedIn Post

**Email Writer 页面结构**：
- View History 按钮
- Import from Board 按钮
- Company Details or Job Description 输入框
- Recipient Details 输入框
- Target Job Title 输入框
- Email Type 下拉（Job Outreach）
- Your Profile：Resume Upload / Use LinkedIn Profile
- Advanced Settings
- Generate 按钮
- 右侧：Result 显示区域

**交互测试**：
- [x] 子功能导航
- [x] View History 按钮
- [x] Import from Board 按钮
- [ ] Generate 流程

---

## 二、UHired (JobH) 全站功能测试

### 1. Dashboard (仪表盘)

**页面结构**：
- 顶部问候：Hi, Li + 行动计划提示
- 4个 Tab：Application Materials, Jobs, Networking, Interviews
- 统计卡片：Resumes Created, Jobs Tracked, Interviewing, Offers Received
- Your Progress 区域（根据 Tab 动态切换内容）
- 右侧卡片区域（根据 Tab 动态显示引导内容）
- Quick Actions 区域
- Job Pipeline 区域
- Explore All Features 弹窗

**交互测试**：
- [x] Tab 切换（内容正确切换）
- [x] Explore All Features 弹窗（6个功能卡片）
- [x] Quick Actions 点击
- [x] Job Pipeline 查看

### 2. Jobs Board (职位搜索)

**页面结构**：
- 搜索框 + Location 下拉 + All Types 下拉
- 职位卡片列表（50 jobs found）
- 每个卡片：公司 Logo、职位名称、公司、地点、薪资、时间、工作类型、技能标签、Track 按钮

**交互测试**：
- [x] 搜索框输入
- [x] 筛选下拉
- [x] Track 按钮
- [ ] 卡片点击详情

### 3. Resume Builder (简历构建器)

**页面结构**：
- Create New Resume 按钮
- Tab 切换：Base Resumes / Job Tailored
- 统计卡片：Base Resumes, Tailored Resumes, Downloads
- 简历卡片列表（名称、类型、评分、更新时间、Edit 按钮）

**交互测试**：
- [x] Tab 切换
- [x] 搜索简历
- [x] Edit 按钮
- [ ] Create New Resume 流程

### 4. Job Tracker (职位追踪)

**页面结构**：
- 标题：My 2026 Job Search
- Add Job 按钮
- 搜索框 + All Status 筛选
- Kanban 看板：Saved, Applied, Interviewing, Offer
- 统计卡片：Total Jobs, Applied, Interviewing, Offers

**交互测试**：
- [x] Add Job 按钮
- [x] 搜索筛选
- [ ] 卡片拖拽
- [ ] 卡片点击详情

### 5. Mock Interviews (模拟面试)

**页面结构**：
- Topic Practice 标题
- Language 选择器
- 职位输入框
- Start Practice 按钮
- 功能介绍：Instant Feedback, Company Match, Switch Anytime, Expert Analysis
- View Bookmarked Questions 按钮

**交互测试**：
- [x] 页面加载
- [ ] Start Practice 流程
- [ ] 语言切换

### 6. AI Toolbox (AI 工具箱)

**子功能列表**：
- Personal Brand Statement
- Email Writer
- Elevator Pitch
- LinkedIn Headline
- LinkedIn About
- LinkedIn Post

**Email Writer 页面结构**：
- Email Type 选择（Follow-up, Thank You, Networking, Application, Inquiry）
- Recipient Name 输入框
- Recipient Title 输入框
- Company Name 输入框
- Additional Context 输入框
- Tone 选择（Professional）
- Generate Email 按钮
- 右侧：Generated Email 显示区域

**交互测试**：
- [x] 子功能导航
- [x] Email Type 选择
- [x] 表单填写
- [ ] Generate Email 流程

---

## 三、功能对比汇总

### 功能完整性对比

| 模块 | Careerflow.ai | UHired (JobH) | 差异 |
|------|--------------|---------------|------|
| Dashboard | 4 Tab + 动态内容 | 4 Tab + 动态内容 | ✅ 一致 |
| Jobs | 搜索 + Filter + 详情页 | 搜索 + Filter | ⚠️ 缺详情页 |
| Resume Builder | Tab + 编辑器 + AI | Tab + 编辑器 + AI | ✅ 一致 |
| Job Tracker | Kanban + 拖拽 + 自定义列 | Kanban + 拖拽 | ⚠️ 缺自定义列 |
| Mock Interviews | 场景卡片 + 分类 | Topic Practice | ⚠️ 不同设计 |
| AI Toolbox | 6子功能 + View History | 6子功能 | ⚠️ 缺 View History |

### 交互差异对比

| 交互点 | Careerflow.ai | UHired (JobH) | 状态 |
|--------|--------------|---------------|------|
| Dashboard Tab 切换 | 内容切换 | 内容切换 | ✅ 已修复 |
| Explore All Features | 弹窗显示 | 弹窗显示 | ✅ 已修复 |
| Resume Tab 切换 | 内容切换 | 内容切换 | ✅ 一致 |
| Job Tracker 拖拽 | 支持 | 支持 | ✅ 一致 |
| AI Toolbox View History | 支持 | 不支持 | ❌ 待实现 |
| AI Toolbox Import from Board | 支持 | 不支持 | ❌ 待实现 |
| Job Tracker Add Column | 支持 | 不支持 | ❌ 待实现 |

### 待改进项

1. **AI Toolbox View History** - 添加历史记录查看功能
2. **AI Toolbox Import from Board** - 添加从 Job Tracker 导入功能
3. **Job Tracker Add Column** - 添加自定义列功能
4. **Jobs 详情页** - 添加职位详情页面
5. **Mock Interviews 场景卡片** - 考虑添加场景分类和卡片展示

---

## 四、交互差异分析

### 1. Dashboard 模块

**已修复的问题**：
- Tab 切换功能已完全对齐 Careerflow.ai
- Explore All Features 弹窗已实现
- 右侧卡片区域根据 Tab 动态显示
- 独立进度显示已实现

### 2. Jobs Board 模块

**差异点**：
- Careerflow.ai 有职位详情页，点击卡片可查看完整信息
- UHired 目前只有列表页，缺少详情页

**建议**：添加职位详情页，包含完整职位描述、公司信息、申请按钮

### 3. Resume Builder 模块

**一致性**：
- Tab 切换功能一致
- 简历编辑器功能一致
- AI 评分功能一致

### 4. Job Tracker 模块

**差异点**：
- Careerflow.ai 支持 Add Column 自定义列
- UHired 目前只有固定列（Saved, Applied, Interviewing, Offer）

**建议**：添加 Add Column 功能，允许用户自定义列名称和颜色

### 5. Mock Interviews 模块

**差异点**：
- Careerflow.ai 使用场景卡片 + 分类筛选设计
- UHired 使用 Topic Practice 输入框设计

**分析**：两种设计各有优势，UHired 的设计更灵活，可保留

### 6. AI Toolbox 模块

**差异点**：
- Careerflow.ai 有 View History 按钮，可查看历史生成记录
- Careerflow.ai 有 Import from Board 按钮，可从 Job Tracker 导入信息
- UHired 缺少这两个功能

**建议**：添加 View History 和 Import from Board 功能

---

## 五、改进优先级

| 优先级 | 改进项 | 工作量 | 影响 |
|--------|--------|--------|------|
| P0 | AI Toolbox View History | 2h | 用户体验 |
| P0 | AI Toolbox Import from Board | 2h | 效率提升 |
| P1 | Job Tracker Add Column | 3h | 功能完整性 |
| P1 | Jobs 详情页 | 4h | 功能完整性 |
| P2 | Mock Interviews 场景卡片 | 4h | 可选优化 |

---

## 六、总结

UHired (JobH) 与 Careerflow.ai 的核心功能已基本对齐，主要差异在于一些辅助功能（View History, Import from Board, Add Column）。Dashboard 模块的交互问题已全部修复，包括 Tab 切换、Explore All Features 弹窗等。

建议优先实现 P0 级别的改进项，这些功能对用户体验影响较大且工作量较小。

---

## 五、改进建议

待完成...
