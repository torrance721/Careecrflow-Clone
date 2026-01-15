# UHired 功能实现方案

**版本**: 1.0  
**日期**: 2026年1月13日  
**状态**: 待确认

---

## 1. 当前实现状态

| 模块 | 状态 | 说明 |
|-----|------|------|
| Dashboard | ✅ 完成 | 4 Tab 切换、进度追踪、Quick Actions |
| Resume Builder | ✅ 完成 | 创建/编辑简历、AI 优化、评分 |
| Job Tracker | ✅ 完成 | Kanban 看板（5 列含 Rejected）、拖拽 |
| AI Toolbox | ✅ 完成 | Email Writer、Cover Letter、LinkedIn Generator |
| Chrome Extension | ⚠️ 部分完成 | 浮动按钮、Save Job、Tailor Resume 跳转 |
| UI 设计 | ⚠️ 需改版 | 当前蓝色主题，需改为橙红色新设计 |

---

## 2. 待实现功能清单

### 第一部分：Chrome Extension 技能分析功能

| 迭代 | 功能 | 预计时间 |
|-----|------|---------|
| 迭代 1 | 后端技能分析 API | 2-3 小时 |
| 迭代 2 | Extension 技能分析 UI | 2-3 小时 |
| 迭代 3 | 简历选择器 + 缓存 | 1-2 小时 |
| 迭代 4 | Indeed/Glassdoor 支持 | 2-3 小时 |

### 第二部分：UI 改版（新设计风格）

| 迭代 | 功能 | 预计时间 |
|-----|------|---------|
| 迭代 5 | 全局配色 + 侧边栏改版 | 2-3 小时 |
| 迭代 6 | Dashboard 页面改版 | 2-3 小时 |
| 迭代 7 | Resume Builder 页面改版 | 2-3 小时 |
| 迭代 8 | Job Tracker 页面改版 | 2-3 小时 |
| 迭代 9 | AI Toolbox 页面改版 | 2-3 小时 |
| 迭代 10 | Chrome Extension UI 改版 | 1-2 小时 |

---

## 3. 迭代详情

---

### 迭代 1：后端技能分析 API

**功能说明**：创建后端 API，使用 LLM 分析职位描述和用户简历，返回技能匹配结果。

| 功能 | 模型 | 说明 |
|-----|------|------|
| 职位技能提取 | GPT-3.5 | 从职位描述提取技能关键词 |
| 简历技能提取 | GPT-3.5 | 从用户简历提取技能关键词 |
| 技能匹配分析 | GPT-4 | 语义匹配，返回匹配度和缺失技能 |

**API 设计**：

```typescript
// 输入
interface SkillAnalysisInput {
  jobDescription: string;  // 职位描述文本
  resumeId?: string;       // 可选，指定简历 ID
}

// 输出
interface SkillAnalysisOutput {
  score: number;           // 0-100 匹配分数
  strongMatch: string[];   // 强匹配技能
  partialMatch: Array<{    // 部分匹配
    resume: string;
    job: string;
  }>;
  missing: string[];       // 缺失技能
  cached: boolean;         // 是否来自缓存
}
```

**完成度检查**：
- [ ] 创建 `server/skillAnalysis.ts` 服务文件
- [ ] 实现 `extractJobSkills()` 函数（GPT-3.5）
- [ ] 实现 `extractResumeSkills()` 函数（GPT-3.5）
- [ ] 实现 `analyzeSkillMatch()` 函数（GPT-4）
- [ ] 创建 tRPC 路由 `skillAnalysis.analyze`
- [ ] 创建 `skill_analysis_cache` 数据库表
- [ ] 实现缓存逻辑（相同职位+简历不重复分析）
- [ ] 单元测试：技能提取准确性
- [ ] 单元测试：匹配分析正确性
- [ ] 单元测试：缓存命中逻辑

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| API 调用成功 | 发送职位描述到 API | 返回 score, strongMatch, missing |
| 技能提取 | 发送 "React, Node.js, AWS" 职位 | 提取出 React, Node.js, AWS |
| 匹配分析 | 简历有 React，职位要 React | strongMatch 包含 React |
| 缓存命中 | 相同输入调用两次 | 第二次 cached=true |
| 无简历处理 | 不传 resumeId | 返回错误提示 |

**自动化测试用例**：
```typescript
// server/skillAnalysis.test.ts
- test('extractJobSkills 正确提取技能')
- test('extractResumeSkills 正确提取技能')
- test('analyzeSkillMatch 返回正确匹配结果')
- test('缓存命中时不调用 LLM')
- test('无简历时返回错误')
```

---

### 迭代 2：Extension 技能分析 UI

**功能说明**：在 Chrome Extension 浮动面板中添加技能分析 UI，显示匹配结果。

| 功能 | 说明 |
|-----|------|
| 技能分析面板 | 替换当前简单面板，显示详细分析 |
| 匹配分数 | 圆形进度条显示 0-100 分 |
| 技能列表 | 可折叠的 Strong/Partial/Missing 列表 |
| 加载状态 | 分析中显示骨架屏 |

**UI 状态设计**：

| 状态 | 显示内容 |
|-----|---------|
| 未登录 | "Please login to analyze" + 登录按钮 |
| 无简历 | "Upload a resume first" + 跳转按钮 |
| 加载中 | 骨架屏 + "Analyzing skills..." |
| 分析完成 | 分数 + 技能列表 |
| 分析失败 | 错误信息 + 重试按钮 |

**完成度检查**：
- [ ] 创建 `floating-panel-v2.js` 新版面板
- [ ] 实现圆形进度条组件（SVG）
- [ ] 实现可折叠技能列表组件
- [ ] 实现 5 种 UI 状态切换
- [ ] 调用后端 API 获取分析结果
- [ ] 添加加载骨架屏动画
- [ ] 添加错误处理和重试逻辑
- [ ] 更新 manifest.json 版本号

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 面板展开 | 点击浮动按钮 | 显示技能分析面板 |
| 加载状态 | 打开面板时 | 显示骨架屏 |
| 分析完成 | 等待 API 返回 | 显示分数和技能列表 |
| 技能折叠 | 点击 "Strong Match" | 展开/折叠技能列表 |
| 未登录状态 | 未登录时打开 | 显示登录提示 |
| 无简历状态 | 无简历时打开 | 显示上传提示 |

**自动化测试用例**：
```typescript
// chrome-extension/tests/panel.test.js
- test('面板正确渲染')
- test('加载状态显示骨架屏')
- test('分析完成显示结果')
- test('技能列表可折叠')
- test('未登录显示提示')
```

---

### 迭代 3：简历选择器 + 缓存

**功能说明**：支持用户在 Extension 中切换简历，并实现本地缓存减少 API 调用。

| 功能 | 说明 |
|-----|------|
| 简历选择器 | 下拉菜单显示用户所有简历 |
| 切换简历 | 选择后重新分析 |
| 本地缓存 | chrome.storage 缓存分析结果 |
| 缓存过期 | 24 小时后自动过期 |

**完成度检查**：
- [ ] 创建简历选择器下拉组件
- [ ] 调用 API 获取用户简历列表
- [ ] 实现简历切换逻辑
- [ ] 实现 chrome.storage 本地缓存
- [ ] 实现缓存 key 生成（jobUrl + resumeId）
- [ ] 实现 24 小时缓存过期
- [ ] 切换简历时清除旧缓存

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 简历列表 | 打开选择器 | 显示用户所有简历 |
| 切换简历 | 选择不同简历 | 重新分析并更新结果 |
| 缓存命中 | 相同职位+简历再次打开 | 立即显示结果（无加载） |
| 缓存过期 | 24 小时后打开 | 重新分析 |

**自动化测试用例**：
```typescript
// chrome-extension/tests/cache.test.js
- test('缓存正确存储')
- test('缓存正确读取')
- test('缓存过期后重新分析')
- test('切换简历清除缓存')
```

---

### 迭代 4：Indeed/Glassdoor 支持

**功能说明**：扩展浮动按钮支持 Indeed 和 Glassdoor 网站。

| 网站 | 职位信息提取 | 说明 |
|-----|-------------|------|
| LinkedIn | ✅ 已实现 | 公司名、职位名、描述 |
| Indeed | 待实现 | 需要分析页面结构 |
| Glassdoor | 待实现 | 需要分析页面结构 |

**完成度检查**：
- [ ] 分析 Indeed 职位页面 DOM 结构
- [ ] 创建 `content/indeed.js` 内容脚本
- [ ] 实现 Indeed 职位信息提取
- [ ] 分析 Glassdoor 职位页面 DOM 结构
- [ ] 创建 `content/glassdoor.js` 内容脚本
- [ ] 实现 Glassdoor 职位信息提取
- [ ] 更新 manifest.json 添加新网站权限
- [ ] 测试三个网站的浮动按钮

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| Indeed 按钮 | 访问 Indeed 职位页 | 显示浮动按钮 |
| Indeed 提取 | 点击分析 | 正确提取职位信息 |
| Glassdoor 按钮 | 访问 Glassdoor 职位页 | 显示浮动按钮 |
| Glassdoor 提取 | 点击分析 | 正确提取职位信息 |

**自动化测试用例**：
```typescript
// chrome-extension/tests/sites.test.js
- test('Indeed 职位信息提取')
- test('Glassdoor 职位信息提取')
- test('三个网站浮动按钮显示')
```

---

### 迭代 5：全局配色 + 侧边栏改版

**功能说明**：更新全局配色方案和侧边栏样式，应用新设计风格。

| 项目 | 旧值 | 新值 |
|-----|------|------|
| 主色 | `#3B82F6` (蓝色) | `#FF5A36` (橙红色) |
| 背景色 | `#F8FAFC` | `#0F0F11` |
| 卡片背景 | `#FFFFFF` | `#161618` |
| 边框色 | `#E2E8F0` | `#2C2C2E` |
| 文字色 | `#1E293B` | `#FFFFFF` |

**完成度检查**：
- [ ] 更新 `client/src/index.css` CSS 变量
- [ ] 更新 ThemeProvider 默认主题为 dark
- [ ] 更新侧边栏背景色和边框
- [ ] 更新侧边栏图标颜色
- [ ] 更新侧边栏 hover 效果
- [ ] 更新侧边栏 active 状态样式
- [ ] 更新用户头像区域样式
- [ ] 测试所有页面配色一致性

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 背景色 | 查看页面背景 | 深黑色 `#0F0F11` |
| 主色按钮 | 查看主要按钮 | 橙红色 `#FF5A36` |
| 侧边栏 | 查看侧边栏 | 深色背景，白色图标 |
| 卡片 | 查看卡片组件 | 深灰色背景 `#161618` |
| 文字对比度 | 查看所有文字 | 清晰可读（白色/灰色） |

**自动化测试用例**：
```typescript
// client/src/__tests__/Theme.test.tsx
- test('CSS 变量正确设置')
- test('深色主题正确应用')
- test('文字对比度符合 WCAG')
```

---

### 迭代 6：Dashboard 页面改版

**功能说明**：重新设计 Dashboard 页面，应用新设计风格。

| 组件 | 改动 |
|-----|------|
| 顶部标题 | 渐变色标题 + 发光效果 |
| Tab 切换 | 圆角按钮样式 |
| 进度卡片 | 深色背景 + 橙红色进度条 |
| Quick Actions | 图标按钮 + hover 发光 |
| 任务清单 | 深色卡片 + 勾选动画 |

**完成度检查**：
- [ ] 更新 Dashboard 页面背景
- [ ] 更新 Tab 切换组件样式
- [ ] 更新进度卡片样式
- [ ] 更新 Quick Actions 按钮样式
- [ ] 更新任务清单卡片样式
- [ ] 添加渐变色标题效果
- [ ] 添加按钮 hover 发光效果
- [ ] 测试 4 个 Tab 切换正常

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 页面加载 | 访问 Dashboard | 显示新设计风格 |
| Tab 切换 | 点击各 Tab | 内容正确切换，样式正确 |
| 进度显示 | 查看进度卡片 | 橙红色进度条 |
| 按钮交互 | hover 按钮 | 显示发光效果 |

**自动化测试用例**：
```typescript
// client/src/__tests__/Dashboard.test.tsx
- test('Dashboard 正确渲染')
- test('Tab 切换功能正常')
- test('进度卡片显示正确')
```

---

### 迭代 7：Resume Builder 页面改版

**功能说明**：重新设计 Resume Builder 页面，应用新设计风格。

| 组件 | 改动 |
|-----|------|
| 编辑器区域 | 深色背景 + 高亮边框 |
| 预览区域 | 白色简历预览（保持可读性） |
| AI 助手 | 橙红色按钮 + 发光效果 |
| 评分卡片 | 圆形进度 + 渐变色 |

**完成度检查**：
- [ ] 更新编辑器区域样式
- [ ] 更新预览区域样式（保持白色背景）
- [ ] 更新 AI 助手按钮样式
- [ ] 更新评分卡片样式
- [ ] 更新简历列表样式
- [ ] 测试编辑功能正常
- [ ] 测试 AI 优化功能正常

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 页面加载 | 访问 Resume Builder | 显示新设计风格 |
| 编辑功能 | 编辑简历内容 | 正常保存和预览 |
| AI 优化 | 点击 AI 按钮 | 正常生成优化建议 |
| 评分显示 | 查看评分卡片 | 显示正确分数 |

**自动化测试用例**：
```typescript
// client/src/__tests__/ResumeBuilder.test.tsx
- test('Resume Builder 正确渲染')
- test('编辑功能正常')
- test('AI 优化功能正常')
```

---

### 迭代 8：Job Tracker 页面改版

**功能说明**：重新设计 Job Tracker Kanban 看板，应用新设计风格。

| 组件 | 改动 |
|-----|------|
| 列标题 | 深色背景 + 彩色标签 |
| 职位卡片 | 深色卡片 + 悬浮效果 |
| 拖拽效果 | 发光边框 + 阴影 |
| 添加按钮 | 橙红色 + 图标 |

**完成度检查**：
- [ ] 更新 Kanban 列样式
- [ ] 更新职位卡片样式
- [ ] 更新拖拽效果样式
- [ ] 更新添加按钮样式
- [ ] 更新空状态样式
- [ ] 测试拖拽功能正常
- [ ] 测试 5 列（含 Rejected）显示正常

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 页面加载 | 访问 Job Tracker | 显示新设计风格 |
| 5 列显示 | 滚动查看 | 显示所有 5 列 |
| 拖拽功能 | 拖拽职位卡片 | 正常移动，显示效果 |
| 添加职位 | 点击添加按钮 | 弹出添加表单 |

**自动化测试用例**：
```typescript
// client/src/__tests__/JobTracker.test.tsx
- test('Job Tracker 正确渲染')
- test('5 列正确显示')
- test('拖拽功能正常')
```

---

### 迭代 9：AI Toolbox 页面改版

**功能说明**：重新设计 AI Toolbox 各页面，应用新设计风格。

| 页面 | 改动 |
|-----|------|
| Email Writer | 深色表单 + 橙红色按钮 |
| Cover Letter | 深色编辑器 + 预览 |
| LinkedIn Generator | 深色卡片 + 评分 |

**完成度检查**：
- [ ] 更新 Email Writer 页面样式
- [ ] 更新 Cover Letter 页面样式
- [ ] 更新 LinkedIn Generator 页面样式
- [ ] 更新 View History 弹窗样式
- [ ] 更新 Import from Board 弹窗样式
- [ ] 测试各功能正常

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| Email Writer | 访问页面 | 显示新设计风格 |
| Cover Letter | 访问页面 | 显示新设计风格 |
| LinkedIn Generator | 访问页面 | 显示新设计风格 |
| View History | 点击按钮 | 弹窗显示新样式 |
| Import from Board | 点击按钮 | 弹窗显示新样式 |

**自动化测试用例**：
```typescript
// client/src/__tests__/AIToolbox.test.tsx
- test('Email Writer 正确渲染')
- test('Cover Letter 正确渲染')
- test('LinkedIn Generator 正确渲染')
```

---

### 迭代 10：Chrome Extension UI 改版

**功能说明**：更新 Chrome Extension 浮动按钮和面板样式，与网站风格一致。

| 组件 | 改动 |
|-----|------|
| 浮动按钮 | 橙红色 + 发光效果 |
| 面板背景 | 深色背景 |
| 按钮样式 | 橙红色渐变 |
| 技能列表 | 深色卡片 |

**完成度检查**：
- [ ] 更新浮动按钮颜色为橙红色
- [ ] 更新面板背景为深色
- [ ] 更新按钮样式为橙红色渐变
- [ ] 更新技能列表样式
- [ ] 更新进度条颜色
- [ ] 测试三个网站样式一致

**E2E 测试方案**：

| 测试项 | 测试方法 | 预期结果 |
|-------|---------|----------|
| 浮动按钮 | 查看按钮颜色 | 橙红色 |
| 面板样式 | 打开面板 | 深色背景 |
| 按钮交互 | hover 按钮 | 发光效果 |

**自动化测试用例**：
```typescript
// chrome-extension/tests/ui.test.js
- test('浮动按钮样式正确')
- test('面板样式正确')
```

---

## 4. 实现顺序和依赖关系

```
迭代 1 (后端 API)
    ↓
迭代 2 (Extension UI) ← 依赖迭代 1
    ↓
迭代 3 (简历选择器) ← 依赖迭代 2
    ↓
迭代 4 (多网站支持) ← 依赖迭代 2

迭代 5 (全局配色) ← 独立
    ↓
迭代 6 (Dashboard) ← 依赖迭代 5
    ↓
迭代 7 (Resume Builder) ← 依赖迭代 5
    ↓
迭代 8 (Job Tracker) ← 依赖迭代 5
    ↓
迭代 9 (AI Toolbox) ← 依赖迭代 5
    ↓
迭代 10 (Extension UI) ← 依赖迭代 5
```

---

## 5. 风险和注意事项

### 技术风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| LLM 响应慢 | 用户体验差 | 添加加载动画，实现缓存 |
| LinkedIn 页面结构变化 | 信息提取失败 | 使用多种选择器作为后备 |
| 深色主题文字对比度 | 可读性差 | 测试 WCAG 对比度标准 |

### API 成本

| 场景 | 成本估算 |
|-----|---------|
| 单次技能分析 | ~$0.016 |
| 缓存命中 | ~$0.01 (只有匹配分析) |
| 1000 用户/天 | ~$160/天 |

### 兼容性

| 浏览器 | 支持状态 |
|-------|---------|
| Chrome | ✅ 完全支持 |
| Edge | ✅ 完全支持 |
| Firefox | ⚠️ 需要适配 manifest v2 |
| Safari | ❌ 不支持 |

---

## 6. 验收标准

### 每个迭代的验收流程

1. **完成度检查**：所有 checkbox 勾选
2. **E2E 测试**：所有测试项通过
3. **自动化测试**：所有单元测试通过
4. **视觉检查**：UI 与设计稿一致
5. **保存检查点**：`webdev_save_checkpoint`

### 最终验收标准

- [ ] Chrome Extension 技能分析功能完整可用
- [ ] 三个网站（LinkedIn/Indeed/Glassdoor）支持
- [ ] 所有页面应用新设计风格
- [ ] 文字对比度符合 WCAG AA 标准
- [ ] 所有 E2E 测试通过
- [ ] 所有单元测试通过

---

## 7. 附录

### A. 新设计配色参考

```css
/* 主色 */
--primary: #FF5A36;
--primary-hover: #FF7A5C;
--primary-glow: rgba(255, 90, 54, 0.4);

/* 背景 */
--background: #0F0F11;
--card: #161618;
--card-hover: #1C1C1E;

/* 边框 */
--border: #2C2C2E;
--border-hover: #3C3C3E;

/* 文字 */
--foreground: #FFFFFF;
--muted: #A1A1A6;
--muted-foreground: #6B6B70;

/* 渐变 */
--gradient-primary: linear-gradient(135deg, #FF5A36, #FF8F6B);
```

### B. 可复用代码

| 文件 | 功能 | 复用方式 |
|-----|------|---------|
| `server/agents/react/jobRecommendationAgent.ts` | `analyze_skill_match` | 直接复用逻辑 |
| `server/resumeParser.ts` | 简历解析 | 获取简历文本 |
| `server/db.ts` | `getResumesByUser` | 获取用户简历列表 |
| `server/_core/llm.ts` | `invokeLLM` | LLM 调用 |

### C. 参考资料

- Careerflow Extension 交互分析：`docs/extension_comparison.md`
- 新设计风格参考：`/home/ubuntu/design_reference/App.tsx`
- 原 PRD 文档：`docs/extension_skill_analysis_prd.md`, `docs/ui_redesign_prd.md`
