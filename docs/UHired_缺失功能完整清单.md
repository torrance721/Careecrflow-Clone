# UHired 与 Careerflow.ai 缺失功能完整清单

**文档版本**: v1.0  
**更新日期**: 2026-01-12  
**作者**: Manus AI

---

## 一、侧边栏导航对比

### Careerflow.ai 侧边栏导航
1. Home
2. Jobs (Beta)
3. Resume Builder
4. Job Tracker
5. Mock Interviews
6. Application Materials (展开)
7. Networking (展开)
8. AI Toolbox (展开)
   - Personal Brand Statement
   - Email Writer
   - Elevator Pitch
   - LinkedIn Headline
   - LinkedIn About
   - LinkedIn Post
9. Chrome Extension
10. Suggest a Feature
11. Report a bug

### UHired 侧边栏导航
1. Home
2. Jobs (Beta)
3. Resume Builder
4. Job Tracker
5. Mock Interviews
6. Application Materials (展开)
7. AI Toolbox (展开)
   - Personal Brand Statement
   - Email Writer
   - Elevator Pitch
   - LinkedIn Headline
   - LinkedIn About
   - LinkedIn Post
8. Suggest a Feature
9. Report a bug

### 缺失项
| 功能 | Careerflow | UHired | 状态 |
|------|------------|--------|------|
| Networking 模块 | ✅ | ❌ | **缺失** |
| Chrome Extension 入口 | ✅ | ❌ | **缺失** |

---

## 二、Dashboard 页面对比

### Careerflow.ai Dashboard 独有功能

| 功能 | 描述 | UHired 状态 |
|------|------|-------------|
| Quick Stats 区域 | 显示 Jobs Tracker 和 Networking Tracker 快捷入口 | ❌ 缺失 |
| Resources 区域 | 显示博客文章/资源推荐，带轮播 | ❌ 缺失 |
| Chrome Extension 推广卡片 | "Supercharge LinkedIn with Careerflow Chrome Extension" | ❌ 缺失 |
| 专家简历服务推广 | "Human-crafted. ATS-optimized. Interview-ready!" | ❌ 缺失 |
| Intercom 客服聊天 | 右下角客服聊天按钮 | ❌ 缺失 |

---

## 三、Networking 模块（完全缺失）

Careerflow.ai 的 Networking 模块是一个独立的功能模块，用于管理求职过程中的人脉关系。

### 3.1 Networking 模块功能

| 功能 | 描述 |
|------|------|
| Contacts 管理 | 添加、编辑、删除联系人 |
| Contact 分类 | 按公司、职位、关系类型分类 |
| 互动记录 | 记录与联系人的互动历史 |
| Follow-up 提醒 | 设置跟进提醒 |
| LinkedIn 导入 | 从 LinkedIn 导入联系人 |
| 邮件模板 | 快速发送 Networking 邮件 |

### 3.2 Networking Tracker 功能

| 功能 | 描述 |
|------|------|
| Add Contact | 添加新联系人 |
| Contact 卡片 | 显示联系人信息 |
| 状态追踪 | 追踪联系状态（待联系、已联系、已回复等） |
| 统计面板 | 显示联系人数量、回复率等 |

### 3.3 Find Recruiters 功能（X-ray Search）

这是一个独立的工具页面，用于搜索 LinkedIn 上的招聘者和招聘经理。

| 功能 | 描述 |
|------|------|
| Company 搜索 | 输入目标公司名称 |
| Skills 筛选 | 按技能筛选招聘者 |
| Location 筛选 | 按地点筛选 |
| Role 筛选 | 按职位筛选 |
| Exact Search | 精确搜索模式 |
| Save Query | 保存搜索条件 |
| Find out who is hiring | 执行搜索 |

### 3.4 Community 功能

跳转到 Discord 社区（Careerflow Community），拥有 28,717 成员。

| 功能 | 描述 |
|------|------|
| Discord 社区 | 跳转到外部 Discord 服务器 |
| 在线交流 | 与其他求职者交流经验 |
| 资源分享 | 分享求职资源和技巧 |

---

## 四、Chrome Extension 功能（需测试）

### 4.1 Careerflow Extension 功能（来自 Chrome Web Store）

| 功能 | 描述 |
|------|------|
| LinkedIn Profile Optimization | 分析并优化 LinkedIn 个人资料 |
| One-Click Job Save | 一键保存 LinkedIn 职位到 Job Tracker |
| Auto-Fill Applications | 自动填充求职申请表 |
| Job Match Score | 显示职位匹配度评分 |
| Resume Tailoring Suggestions | 根据职位提供简历优化建议 |
| Recruiter Insights | 显示招聘者信息 |

### 4.2 UHired Extension 状态

**已完成测试**：

| 功能名称 | 描述 | UHired 状态 |
|---------|------|------------|
| Save Job to Tracker | 一键保存职位到 Job Tracker | ✅ 已实现 |
| View Job Tracker | 查看 Job Tracker | ✅ 已实现 |
| Tailor Resume | 根据 JD 定制简历 | ❌ 缺失 |
| View Details | 查看职位详情 | ❌ 缺失 |
| AI Cover Letter Generator | AI 求职信生成器 | ❌ 缺失 |
| Summarize Job Description | AI 职位描述摘要 | ❌ 缺失 |
| AI LinkedIn Post Generator | AI LinkedIn 帖子生成器 | ❌ 缺失 |
| LinkedIn Optimization | LinkedIn 个人资料优化 | ❌ 缺失 |
| Find out Who's Hiring | 查找招聘人员 | ❌ 缺失 |

### 4.3 Extension 改进优先级

**P0 优先级（核心功能）**：
1. Tailor Resume - 根据 JD 定制简历，提升求职成功率
2. View Details - 查看职位详情，无需跳转页面

**P1 优先级（增强功能）**：
3. AI Cover Letter Generator - AI 求职信生成器
4. Summarize Job Description - AI 职位描述摘要
5. Find out Who's Hiring - 查找招聘人员

**P2 优先级（可选功能）**：
6. LinkedIn Optimization - LinkedIn 个人资料优化
7. AI LinkedIn Post Generator - AI LinkedIn 帖子生成器

---

## 五、Jobs Board 模块缺失功能

| 功能 | Careerflow | UHired | 优先级 |
|------|------------|--------|--------|
| 职位详情页 | ✅ | ❌ | P1 |
| 一键申请按钮 | ✅ | ❌ | P2 |
| 职位卡片点击跳转 | ✅ | ❌ | P1 |

---

## 六、Job Tracker 模块缺失功能

| 功能 | Careerflow | UHired | 优先级 |
|------|------------|--------|--------|
| Rejected 列 | ✅ | ❌ | P0 |
| Add Column 自定义列 | ✅ | ❌ | P1 |
| 列拖拽排序 | ✅ | ❌ | P2 |

---

## 七、AI Toolbox 模块缺失功能

| 功能 | Careerflow | UHired | 优先级 |
|------|------------|--------|--------|
| View History | ✅ | ❌ | P0 |
| Import from Board | ✅ | ❌ | P0 |

---

## 八、其他缺失功能

| 功能 | 描述 | 优先级 |
|------|------|--------|
| Resources/Blog 区域 | Dashboard 显示博客文章推荐 | P2 |
| 客服聊天 (Intercom) | 右下角客服聊天按钮 | P2 |
| 专家服务推广 | 付费简历服务推广卡片 | P3 |
| Premium Plus 订阅 | 付费订阅功能 | P3 |

---

## 九、缺失功能优先级汇总

### P0 级别（高优先级）
1. Job Tracker - Rejected 列
2. AI Toolbox - View History
3. AI Toolbox - Import from Board

### P1 级别（中优先级）
1. Jobs Board - 职位详情页
2. Job Tracker - Add Column 自定义列
3. Networking 模块（完整模块）
4. Chrome Extension 入口页面

### P2 级别（低优先级）
1. Jobs Board - 一键申请按钮
2. Job Tracker - 列拖拽排序
3. Dashboard - Resources/Blog 区域
4. Dashboard - Quick Stats 区域
5. 客服聊天功能

### P3 级别（可选）
1. 专家服务推广
2. Premium Plus 订阅系统

---

## 十、工时估算

### Web 端功能

| 功能 | 预估工时 |
|------|----------|
| Rejected 列 | 1h |
| View History | 2h |
| Import from Board | 2h |
| 职位详情页 | 6h |
| Add Column 自定义列 | 4h |
| Networking 模块 | 16h |
| Chrome Extension 入口 | 2h |
| Resources 区域 | 4h |
| Quick Stats 区域 | 2h |
| **Web 端小计** | **39h** |

### Chrome Extension 功能

| 功能 | 预估工时 |
|------|----------|
| Tailor Resume | 4h |
| View Details | 2h |
| AI Cover Letter Generator | 4h |
| Summarize Job Description | 3h |
| Find out Who's Hiring | 4h |
| LinkedIn Optimization | 6h |
| AI LinkedIn Post Generator | 3h |
| **Extension 小计** | **26h** |

### 总计

| 类别 | 工时 |
|------|------|
| Web 端 | 39h |
| Extension | 26h |
| **总计** | **65h** |

---

**文档结束**
