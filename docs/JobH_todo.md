# JobH Project TODO

## P0 前端效果完善 + 后端接口文档

### 前端交互效果
- [ ] Dashboard 卡片 hover 效果
- [ ] Dashboard 进度条动画
- [ ] Resume Builder 卡片 hover 效果
- [ ] Resume Editor Section 展开/收起动画
- [ ] Job Tracker 拖拽动画效果
- [ ] Job Tracker 卡片 hover 效果
- [ ] LinkedIn Generator 加载动画
- [ ] 弹窗打开/关闭动画
- [ ] Tab 切换动画
- [ ] 按钮点击反馈效果

### 后端 API 接口文档
- [ ] 用户认证接口文档
- [ ] Resume CRUD 接口文档
- [ ] Job Tracker CRUD 接口文档
- [ ] LinkedIn Generator AI 接口文档
- [ ] 用户设置接口文档

### 完整功能实现
- [x] 将 JobH 代码迁移到 UHWeb 项目
- [x] 修改入口指向 JobH
- [x] 编写代码分离文档
- [x] 编写后端改造需求文档
- [x] 数据库 Schema 设计和推送
- [x] Resume CRUD API 实现
- [x] Job Tracker CRUD API 实现
- [x] LinkedIn Generator AI API 实现
- [x] AI 生成功能集成 (invokeLLM)
- [x] 简历预览功能
- [x] 简历 PDF 导出功能

## P1 优先级修复（迭代 1）

- [x] Dashboard 进度追踪器
- [x] Dashboard Your Progress 卡片
- [x] LinkedIn Headline - Keywords 字段
- [x] LinkedIn Headline - Your Profile 选择
- [x] LinkedIn About - Keywords 字段
- [x] LinkedIn About - Your Profile 选择
- [x] Resume Builder - Tab 切换 (Base/Tailored)
- [x] Resume Editor - Tailor for Job 功能弹窗
- [x] Resume Editor - AI 对话框
- [ ] Job Tracker - 职位卡片拖拽 (需要添加测试职位)
- [x] Add Job - Section 选择

## P2 优先级修复（迭代 2）

- [x] LinkedIn Headline - Language 选择下拉框
- [x] LinkedIn About - Language 选择下拉框
- [x] Job Tracker - Tags 字段
- [ ] Job Tracker - Add Column 功能
- [x] Job Tracker - 标题改为 "My 2026 Job Search" 样式
- [x] Job Tracker - 列头样式改为 "X Jobs" 格式

## 本期完整实现

### Onboarding 流程
- [x] Dashboard 首页布局
- [x] 左侧边栏导航
- [x] 欢迎语和进度追踪器
- [x] Your Progress 卡片
- [x] Quick Stats 卡片
- [ ] 付费推广区域

### LinkedIn 优化器
- [x] LinkedIn Headline Generator 页面
- [x] LinkedIn About Generator 页面
- [ ] AI 生成功能集成
- [ ] 历史记录功能

### Resume Builder
- [x] 简历列表页
- [x] 创建简历流程（类型选择）
- [x] 简历编辑器主界面
- [x] Resume Content 编辑
- [x] AI Assistant 标签页
- [x] Design 标签页
- [x] Resume Score 评分面板
- [x] Tailor for Job 功能
- [x] Projects Section
- [x] Awards & Achievements Section
- [x] Certifications Section
- [x] Publications Section
- [x] Volunteering Section
- [x] Add New Section 按钮

### Job Tracker
- [x] 看板视图（Saved/Applied/Interviewing）
- [x] 添加职位弹窗
- [x] 职位卡片展示
- [x] 拖拽移动职位
- [x] 搜索和筛选功能
- [ ] 自定义列功能 (Add Column)

### Chrome Extension
- [x] 扩展基础框架 (manifest.json, popup, background)
- [x] LinkedIn Jobs 页面侧边栏
- [x] Top 5 Skills 提取
- [x] Skill Score 评分
- [x] Save Job to Tracker 功能
- [x] Tailor Resume 快捷链接
- [x] Mock Interview 快捷链接
- [x] LinkedIn Profile 分析按钮
- [x] 与 Web 应用数据同步 (background.js)

## 本期仅记录（不实现）

### Mock Interview
- [x] 截图记录完成

### AI Toolbox
- [x] Personal Brand Statement 截图记录
- [x] Email Writer 截图记录
- [x] Elevator Pitch 截图记录
- [x] LinkedIn Post Generator 截图记录
- [x] Cover Letter Generator 截图记录

## 数据库设计
- [ ] users 表
- [ ] resumes 表
- [ ] jobs 表（Job Tracker）
- [ ] linkedin_profiles 表
- [ ] generated_content 表（AI 生成内容历史）

## 迭代对比记录
- [ ] 第一轮对比
- [ ] 第二轮对比
- [ ] 第三轮对比
- [ ] 系统收敛确认
