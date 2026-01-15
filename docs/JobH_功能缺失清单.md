# JobH 功能缺失清单

本文档详细列出 JobH 中所有"建设中"、未实现完整、以及会导致 404 的功能点。

---

## 一、Coming Soon 页面（点击显示"建设中"）

以下路由已配置，但点击后会显示 ComingSoon 占位页面：

| 路由 | 功能名称 | 描述 |
|------|---------|------|
| `/jobs` | Jobs Board | 浏览和搜索职位机会，获取个性化职位推荐 |
| `/documents` | My Documents | 存储和管理所有求职文档 |
| `/linkedin` | LinkedIn Tools | LinkedIn 工具集合页面 |
| `/cover-letters` | Cover Letters | AI 生成个性化求职信 |
| `/personal-brand` | Personal Brand Statement | 创建个人品牌声明 |
| `/email-writer` | Email Writer | AI 辅助撰写专业邮件 |
| `/elevator-pitch` | Elevator Pitch | 生成电梯演讲稿 |
| `/linkedin-post` | LinkedIn Post Generator | 生成 LinkedIn 帖子 |
| `/suggest-feature` | Suggest a Feature | 功能建议页面 |
| `/report-bug` | Report a Bug | Bug 报告页面 |

---

## 二、按钮点击显示 "Coming Soon" Toast

以下按钮已存在于页面上，但点击后只显示 toast 提示：

### Resume Builder 页面 (`/resume-builder`)

| 按钮 | 位置 | 提示信息 |
|------|------|---------|
| LinkedIn Import | 创建简历对话框 | "LinkedIn import coming soon" |
| Upload Resume | 创建简历对话框 | "Resume upload coming soon" |
| Duplicate | 简历卡片下拉菜单 | "Duplicate feature coming soon" |
| Download PDF | 简历卡片下拉菜单 | "PDF download feature coming soon" |

### Resume Editor 页面 (`/resume-editor/:id`)

| 按钮 | 位置 | 提示信息 |
|------|------|---------|
| Share | 顶部工具栏 | "Share feature coming soon" |
| Download | 顶部工具栏 | "PDF download feature coming soon" |

### Job Tracker 页面 (`/job-tracker`)

| 按钮 | 位置 | 提示信息 |
|------|------|---------|
| Edit | 职位卡片下拉菜单 | "Edit feature coming soon" |
| Filter | 搜索栏旁边 | 无功能 (静默) |

### LinkedIn Headline 页面 (`/linkedin-headline`)

| 按钮 | 位置 | 提示信息 |
|------|------|---------|
| View History | 页面右上角 | "History feature coming soon" |

### LinkedIn About 页面 (`/linkedin-about`)

| 按钮 | 位置 | 提示信息 |
|------|------|---------|
| View History | 页面右上角 | "History feature coming soon" |

---

## 三、功能存在但未完整实现

### Dashboard 页面 (`/dashboard`)

| 功能 | 当前状态 | 缺失内容 |
|------|---------|---------|
| Progress Tracker | 静态数据 | 进度不会根据用户实际操作动态更新 |
| Todo Items | 静态数据 | 任务完成状态不会持久化 |
| Resources Section | 占位图片 | 文章图片使用 placeholder，无实际内容 |
| Explore All Features | 按钮存在 | 点击无响应 |

### Resume Editor 页面 (`/resume-editor/:id`)

| 功能 | 当前状态 | 缺失内容 |
|------|---------|---------|
| Resume Score | 静态数据 | 分数不会根据简历内容动态计算 |
| Score Breakdown | 硬编码值 | Summary 80%, Experience 75%, Skills 60%, Formatting 90% 是固定值 |
| Template Selection | UI 存在 | 选择模板后预览不会改变 |
| Color Selection | UI 存在 | 选择颜色后预览不会改变 |
| Font Selection | UI 存在 | 选择字体后预览不会改变 |
| AI Quick Actions | 按钮存在 | Generate Summary, Enhance Experience 等按钮无功能 |
| Tailor for Job | 对话框存在 | 提交后无实际 AI 处理逻辑 |

### Job Tracker 页面 (`/job-tracker`)

| 功能 | 当前状态 | 缺失内容 |
|------|---------|---------|
| Edit Job | 按钮存在 | 点击只显示 toast，无编辑对话框 |
| Filter | 按钮存在 | 点击无响应 |
| Board Title | 可编辑 | 修改后不会持久化到数据库 |
| Chrome Extension | 提示存在 | 插件未开发 |

### Resume Builder 页面 (`/resume-builder`)

| 功能 | 当前状态 | 缺失内容 |
|------|---------|---------|
| Resume Score | 显示 0/100 | 分数计算逻辑未实现 |
| Downloads Count | 显示 0 | 下载统计未实现 |

---

## 四、UI 元素无功能（静默失败）

以下 UI 元素点击后无任何反馈：

| 页面 | 元素 | 位置 |
|------|------|------|
| Dashboard | Progress Step Buttons | 顶部进度条的 Jobs/Networking/Interviews 按钮 |
| Dashboard | Feature Icons Grid | "Explore All Features" 旁边的图标 |
| Dashboard | Explore All Features Button | 功能探索卡片 |
| Job Tracker | Filter Button | 搜索栏旁边 |
| Resume Editor | Template Buttons | Design Tab 中的模板选择 |
| Resume Editor | Color Buttons | Design Tab 中的颜色选择 |
| Resume Editor | Font Dropdown | Design Tab 中的字体选择 |

---

## 五、数据/业务逻辑缺失

| 功能 | 问题描述 |
|------|---------|
| Resume Score 计算 | 简历分数始终为 0，无实际计算逻辑 |
| Progress Tracking | Dashboard 进度不会根据用户行为自动更新 |
| LinkedIn History | 生成的 Headline/About 历史记录未保存 |
| Job Board Title | 修改后的看板标题不会保存到数据库 |
| Resume Templates | 选择不同模板后预览样式不变 |
| Resume Design | 颜色和字体选择不会影响预览和导出 |

---

## 六、Chrome Extension

Chrome 插件相关功能完全未实现：

- 插件代码不存在
- manifest.json 不存在
- 一键保存职位功能不可用
- 自动填充申请表功能不可用

---

## 总结

### 按优先级分类

**P0 - 核心功能缺失（影响主要用户流程）**
1. Resume PDF Download - 简历无法导出
2. Job Edit - 无法编辑已保存的职位
3. Resume Score 计算 - 核心卖点功能未实现

**P1 - 重要功能缺失（影响用户体验）**
1. LinkedIn Import - 无法从 LinkedIn 导入简历
2. Cover Letters - 求职信生成功能
3. LinkedIn History - 生成历史无法查看
4. Resume Templates - 模板选择无效果

**P2 - 增值功能缺失（可延后实现）**
1. Jobs Board - 职位搜索功能
2. Email Writer - 邮件撰写功能
3. Personal Brand Statement - 个人品牌声明
4. Elevator Pitch - 电梯演讲稿
5. Chrome Extension - 浏览器插件

**P3 - 优化项（可选实现）**
1. Progress Tracking 动态更新
2. Dashboard Resources 真实内容
3. Filter 功能
4. Share 功能
