# Careerflow 交互对比笔记

## 1. Dashboard 模块

### Careerflow Dashboard 结构
- **顶部 Tab 栏**：Application Materials | Jobs | Networking | Interviews
  - Tab 样式：椭圆形按钮，选中时有边框和背景色变化
  - Tab 之间有连接线（进度指示器样式）
  
- **Your Progress 卡片**（左侧）
  - 进度条显示 1/2
  - 任务列表：
    - ✅ Create A Base Resume（已完成，绿色勾）
    - 🔲 Optimize LinkedIn Profile（未完成）
  - 任务可点击选择

- **右侧内容区**（根据选中任务变化）
  - 标题：Resume & Profile
  - 描述：Optimize your LinkedIn profile
  - 说明文字：A well-optimized LinkedIn profile increases your visibility to recruiters by 40%
  - CTA 按钮：Optimize Profile
  - 右侧有插图

- **Quick Stats 区域**
  - Jobs Tracker 卡片
  - Networking Tracker 卡片

- **Resources 区域**
  - 文章卡片轮播

### 关键交互行为
1. **Tab 切换**：点击不同 Tab，下方内容应该切换
2. **任务选择**：点击左侧任务，右侧内容区显示对应任务详情
3. **进度追踪**：完成任务后进度条更新

### 各 Tab 内容详情

**Application Materials Tab**：
- 进度：1/2
- 任务：Create A Base Resume ✅, Optimize LinkedIn Profile
- 右侧：Resume & Profile 相关内容
- CTA：Optimize Profile

**Jobs Tab**：
- 进度：0/4
- 任务：Add a Job, Tailor Your Resume, Create a Cover Letter, Apply for a Job
- 右侧：Add Your First Job 相关内容
- CTA：Add Job

**Networking Tab**：
- 进度：0/4
- 任务：Add a Contact, Perform Contact Activity, Craft LinkedIn Post, Search For Recruiters
- 右侧：Add Someone From Your Dream Company
- CTA：Create A New Contact

**Interviews Tab**：
- 进度：0/3
- 任务：Score a Interview, Practice Mock Interview, Get a Job Offer
- 右侧：Get Your First Interview Scheduled
- CTA：Update Job Application

---

## 2. Resume Builder 页面

### 页面结构
- **顶部**：标题 "All Resumes" + 搜索框 + Filter 按钮 + Create New Resume 按钮
- **Tab 切换**：Base Resumes | Job Tailored Resumes
- **简历卡片**：
  - 简历预览缩略图
  - 标题 + "Default Resume" 标签
  - 评分百分比（27%）
  - 最后编辑时间
  - 操作按钮：Tailor for job, Clone, Delete

### 关键交互
1. **Tab 切换**：Base Resumes / Job Tailored Resumes
2. **搜索**：实时搜索简历
3. **Filter**：筛选功能
4. **卡片 Hover**：显示操作按钮
5. **右键菜单**：Preview, Edit Resume, Tailor for job, Clone, Delete, Set as default

### Resume Editor 页面

**页面结构**：
- **顶部导航**：面包屑（Base Resumes > Default > 简历名称）
- **操作按钮**：Tailor for Job, Download Resume, More options
- **Tab 切换**：Resume Content | AI Assistant | Design

**左侧 Section 列表**：
- Personal Information
- Website & Social Links
- Professional Summaries
- Work Experience
- Skills & Interests
- Projects
- Awards & Achievements
- Education
- Certifications
- Publications
- Volunteering
- + Add New Section

**每个 Section 操作**：
- View Details
- Edit
- Don't show in resume
- Add Comment
- 拖拽排序（::图标）

**右侧预览区**：
- 实时简历预览
- 用户信息显示

**右侧评分面板**：
- Resume Score（27）
- Skill Match（0）
- Comments

---

## 3. Job Tracker 页面

### 页面结构
- **顶部**：标题 "My 2026 Job Search" + 搜索框 + Filter 按钮 + Add Job 按钮
- **Kanban 看板**：横向滚动
  - Saved (0 Jobs)
  - Applied (0 Jobs)
  - Interviewing (0 Jobs)
  - Offer (0 Jobs)
  - Rejected (0 Jobs)
  - + Add Column

### 关键交互
1. **拖拽卡片**：在列之间拖拽迁移状态
2. **添加工作**：Add Job 按钮打开弹窗
3. **搜索**：实时搜索工作
4. **Filter**：筛选功能
5. **自定义列**：Add Column 添加新状态
6. **教程引导**：新用户首次进入有 5 步教程

---

## 待记录
- [x] Jobs Tab 内容
- [x] Networking Tab 内容
- [x] Interviews Tab 内容
- [x] Resume Builder 页面
- [x] Job Tracker 页面
- [x] AI Toolbox 页面

---

## 4. AI Toolbox 页面

### 子功能列表
- Personal Brand Statement
- Email Writer
- Elevator Pitch
- LinkedIn Headline
- LinkedIn About
- LinkedIn Post

### Email Writer 页面结构

**左侧输入区**：
- Company Details or Job Description（文本框）+ Import from Board 按钮
- Recipient Details（输入框）
- Target Job Title*（输入框）
- Email Type：Job Outreach（下拉选择）
- Your Profile：Resume Upload | Use LinkedIn Profile
- Advanced Settings（可展开）
- Generate 按钮

**右侧结果区**：
- Result 标题
- AI 生成内容显示区

**顶部操作**：
- View History 按钮

### 关键交互
1. **表单填写**：多个输入字段
2. **导入功能**：Import from Board 从 Job Tracker 导入
3. **简历上传**：Choose or Upload
4. **生成内容**：点击 Generate 后右侧显示结果
5. **历史记录**：View History 查看之前生成的内容


---

## 5. Chrome Extension 对比

### Careerflow Extension 特点
- **浮动按钮**：页面右下角显示 "C" 图标的圆形按钮
- **Shadow DOM**：使用 Shadow DOM 隔离样式，避免与网站样式冲突
- **功能面板**：点击浮动按钮展开功能面板
- **支持平台**：LinkedIn, Indeed, Glassdoor

### Careerflow Extension 功能
1. **Save Job** - 一键保存职位到 Job Tracker
2. **Tailor Resume** - 跳转到简历定制页面
3. **Cover Letter** - 跳转到求职信生成页面
4. **LinkedIn Profile Score** - LinkedIn 个人资料评分
5. **Auto-fill Applications** - 自动填充求职申请表

### UHired Extension 实现状态 (2026-01-12)

| 功能 | Careerflow | UHired | 状态 |
|------|------------|--------|------|
| 浮动按钮 | ✅ | ✅ | 已实现 |
| Shadow DOM 样式隔离 | ✅ | ✅ | 已实现 |
| 面板展开/收起动画 | ✅ | ✅ | 已实现 |
| Save Job | ✅ | ✅ | 已实现 |
| Tailor Resume | ✅ | ✅ | 已实现 |
| Cover Letter | ✅ | ✅ | 已实现 |
| LinkedIn 职位信息提取 | ✅ | ✅ | 已实现 |
| Indeed 支持 | ✅ | ⏳ | 待实现 |
| Glassdoor 支持 | ✅ | ⏳ | 待实现 |
| LinkedIn Profile Score | ✅ | ⏳ | 待实现 |
| Auto-fill Applications | ✅ | ❌ | 未计划 |

### UHired Extension 技术实现

**浮动按钮 (floating-button.js)**:
- 使用 IIFE 包装防止多次初始化
- Shadow DOM 隔离样式
- 内联 CSS 样式注入
- 支持键盘快捷键 Alt+J

**职位信息提取**:
- 从 LinkedIn 页面 DOM 提取公司名和职位名
- 支持多种选择器匹配不同页面结构
- URL 参数传递职位信息到 Web 端

**测试结果**:
- LinkedIn 浮动按钮显示 ✅
- 面板展开/收起 ✅
- Tailor Resume 跳转 ✅
- 职位信息提取 (Anthropic AI Safety Fellow) ✅

---

## 6. E2E 测试总结 (2026-01-12)

### Dashboard 测试
| 功能 | 状态 |
|------|------|
| Application Materials Tab | ✅ 通过 |
| Jobs Tab | ✅ 通过 |
| Networking Tab | ✅ 通过 |
| Interviews Tab | ✅ 通过 |
| Tab 切换进度更新 | ✅ 通过 |
| Explore All Features 弹窗 | ✅ 通过 |

### Job Tracker 测试
| 功能 | 状态 |
|------|------|
| 5 列看板显示 | ✅ 通过 |
| Rejected 列 (红色) | ✅ 通过 (需滚动) |
| 添加职位 | ✅ 通过 |
| 拖拽移动 | ✅ 通过 |

### AI Toolbox 测试
| 功能 | 状态 |
|------|------|
| View History 按钮 | ✅ 通过 |
| Import from Board 按钮 | ✅ 通过 |
| 职位自动填充 | ✅ 通过 |

### Chrome Extension 测试
| 功能 | 状态 |
|------|------|
| 浮动按钮显示 | ✅ 通过 |
| 面板展开/收起 | ✅ 通过 |
| Save Job | ✅ 通过 |
| Tailor Resume | ✅ 通过 |
| Cover Letter | ✅ 通过 |
| LinkedIn 职位信息提取 | ✅ 通过 |
