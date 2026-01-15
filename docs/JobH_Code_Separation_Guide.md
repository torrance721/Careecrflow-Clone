# JobH 代码分离指南

## 概述

本文档说明如何将 JobH（Careerflow 克隆）功能代码从 UHWeb 项目中分离出来，部署为独立项目。

---

## 当前架构

JobH 功能目前集成在 UHWeb 项目中，共享以下资源：

| 资源类型 | 共享状态 | 说明 |
|---------|---------|------|
| 数据库 | 共享 | 使用 UHWeb 的 MySQL 数据库 |
| 认证系统 | 共享 | 使用 Manus OAuth |
| 前端框架 | 共享 | React 19 + Tailwind 4 |
| 后端框架 | 共享 | Express + tRPC |
| LLM API | 共享 | Manus 内置 LLM 服务 |

---

## 文件结构

### JobH 专属文件

```
client/src/pages/
├── Dashboard.tsx           # JobH 主页
├── ResumeBuilder.tsx       # 简历列表页
├── ResumeEditor.tsx        # 简历编辑器
├── JobTracker.tsx          # 职位追踪看板
├── LinkedInHeadline.tsx    # LinkedIn 标题生成器
├── LinkedInAbout.tsx       # LinkedIn 简介生成器

client/src/components/
├── DashboardLayout.tsx     # JobH 侧边栏布局（与 UHired 共用但可分离）

server/
├── resumePdfGenerator.ts   # 简历 PDF 生成服务

drizzle/schema.ts           # 包含 JobH 相关表定义（需分离）
server/db.ts                # 包含 JobH 数据库函数（需分离）
server/routers.ts           # 包含 JobH tRPC 路由（需分离）
```

### 共用文件（需复制）

```
client/src/components/ui/   # shadcn/ui 组件
client/src/_core/           # 核心 hooks 和 utils
server/_core/               # 核心服务（OAuth、LLM、env）
```

---

## 分离步骤

### 步骤 1：创建新项目

```bash
# 在 Manus 平台创建新的 Web 项目
# 选择 "Web App with Database and Auth" 模板
```

### 步骤 2：复制前端文件

```bash
# 复制 JobH 页面
cp client/src/pages/Dashboard.tsx       新项目/client/src/pages/
cp client/src/pages/ResumeBuilder.tsx   新项目/client/src/pages/
cp client/src/pages/ResumeEditor.tsx    新项目/client/src/pages/
cp client/src/pages/JobTracker.tsx      新项目/client/src/pages/
cp client/src/pages/LinkedInHeadline.tsx 新项目/client/src/pages/
cp client/src/pages/LinkedInAbout.tsx   新项目/client/src/pages/

# 复制布局组件
cp client/src/components/DashboardLayout.tsx 新项目/client/src/components/
```

### 步骤 3：分离数据库 Schema

从 `drizzle/schema.ts` 中提取以下表定义：

```typescript
// JobH 专属表
export const resumes = mysqlTable('resumes', { ... });
export const trackedJobs = mysqlTable('tracked_jobs', { ... });
export const linkedinContent = mysqlTable('linkedin_content', { ... });
export const jobhUserProfiles = mysqlTable('jobh_user_profiles', { ... });
```

### 步骤 4：分离数据库函数

从 `server/db.ts` 中提取以下函数：

```typescript
// Resume Functions
createResume()
getResumesByUser()
getResumeById()
updateResume()
deleteResume()

// Job Tracker Functions
createTrackedJob()
getTrackedJobsByUser()
getTrackedJobById()
updateTrackedJob()
deleteTrackedJob()
getTrackedJobsByStatus()

// LinkedIn Content Functions
createLinkedinContent()
getLinkedinContentByUser()
toggleLinkedinContentFavorite()

// User Profile Functions
getOrCreateJobhProfile()
updateJobhProfile()
completeOnboarding()
getJobhUserStats()
```

### 步骤 5：分离 tRPC 路由

从 `server/routers.ts` 中提取以下路由：

```typescript
// JobH Routes
resume: router({ ... })
jobTracker: router({ ... })
linkedin: router({ ... })
jobhProfile: router({ ... })
```

### 步骤 6：更新路由配置

在新项目的 `App.tsx` 中配置路由：

```typescript
<Route path="/" component={Dashboard} />
<Route path="/dashboard" component={Dashboard} />
<Route path="/job-tracker" component={JobTracker} />
<Route path="/linkedin-headline" component={LinkedInHeadline} />
<Route path="/linkedin-about" component={LinkedInAbout} />
<Route path="/resume-builder" component={ResumeBuilder} />
<Route path="/resume-editor/:id" component={ResumeEditor} />
```

### 步骤 7：复制 PDF 生成服务

```bash
cp server/resumePdfGenerator.ts 新项目/server/
```

---

## 数据迁移

如果需要迁移现有数据，使用以下 SQL：

```sql
-- 导出 JobH 相关数据
SELECT * FROM resumes INTO OUTFILE '/tmp/resumes.csv';
SELECT * FROM tracked_jobs INTO OUTFILE '/tmp/tracked_jobs.csv';
SELECT * FROM linkedin_content INTO OUTFILE '/tmp/linkedin_content.csv';
SELECT * FROM jobh_user_profiles INTO OUTFILE '/tmp/jobh_user_profiles.csv';

-- 在新数据库中导入
LOAD DATA INFILE '/tmp/resumes.csv' INTO TABLE resumes;
-- ... 其他表类似
```

---

## 环境变量

新项目需要以下环境变量（由 Manus 平台自动注入）：

| 变量名 | 说明 |
|-------|------|
| DATABASE_URL | 数据库连接字符串 |
| JWT_SECRET | JWT 签名密钥 |
| VITE_APP_ID | OAuth 应用 ID |
| OAUTH_SERVER_URL | OAuth 服务器地址 |
| BUILT_IN_FORGE_API_URL | LLM API 地址 |
| BUILT_IN_FORGE_API_KEY | LLM API 密钥 |

---

## Chrome Extension 配置

Chrome Extension 代码位于 `/home/ubuntu/JobH/chrome-extension/`，需要更新以下配置：

1. **manifest.json** - 更新 `host_permissions` 指向新域名
2. **popup.js** - 更新 `API_BASE_URL` 指向新后端
3. **content.js** - 更新 `API_BASE_URL` 指向新后端
4. **background.js** - 更新 `API_BASE_URL` 指向新后端

---

## 注意事项

1. **用户数据隔离**：分离后，用户需要重新登录，数据不会自动迁移
2. **LLM API**：新项目会获得独立的 LLM API 配额
3. **数据库**：新项目会获得独立的数据库实例
4. **域名**：新项目会获得新的 `xxx.manus.space` 域名

---

## 联系方式

如有问题，请联系开发团队或在 GitHub 提交 Issue。

---

*文档版本：1.0*
*最后更新：2026-01-10*
