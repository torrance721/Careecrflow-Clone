# UHWeb (UHired) 一键部署指南

本文档为协作者提供在 Manus 沙盒环境中部署 UHWeb 项目的完整指南。通过遵循本文档的步骤，您可以在自己的 Manus 账户中快速部署并运行该项目。

---

## 项目概述

UHWeb（UHired）是一个求职辅助平台，提供以下核心功能：

- **Resume Builder** - AI 驱动的简历构建器
- **Job Tracker** - 求职进度追踪
- **Jobs Board** - 实时 LinkedIn 职位搜索（通过 Apify）
- **Mock Interviews** - AI 模拟面试
- **Skill Analysis** - 技能匹配分析

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 |
| 后端 | Express 4 + tRPC 11 |
| 数据库 | MySQL/TiDB (Drizzle ORM) |
| 认证 | Manus OAuth |
| 存储 | S3 (Manus 内置) |
| AI 服务 | Manus Forge API (LLM) |

---

## 环境变量说明

### Manus 平台自动注入的变量

以下环境变量由 Manus 平台在创建 `web-db-user` 类型项目时自动注入，**无需手动配置**：

| 变量名 | 说明 | 来源 |
|--------|------|------|
| `DATABASE_URL` | MySQL/TiDB 数据库连接字符串 | Manus 自动分配 |
| `JWT_SECRET` | Session Cookie 签名密钥 | Manus 自动生成 |
| `VITE_APP_ID` | Manus OAuth 应用 ID | Manus 自动分配 |
| `OAUTH_SERVER_URL` | Manus OAuth 后端 URL | Manus 平台配置 |
| `VITE_OAUTH_PORTAL_URL` | Manus 登录门户 URL | Manus 平台配置 |
| `OWNER_OPEN_ID` | 项目所有者 OpenID | Manus 账户绑定 |
| `OWNER_NAME` | 项目所有者名称 | Manus 账户绑定 |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL | Manus 平台配置 |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API 密钥（服务端） | Manus 自动分配 |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Forge API URL（前端） | Manus 平台配置 |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus Forge API 密钥（前端） | Manus 自动分配 |
| `VITE_APP_TITLE` | 应用标题 | 可在 Settings 中修改 |
| `VITE_APP_LOGO` | 应用 Logo URL | 可在 Settings 中修改 |

### 需要手动配置的变量

以下环境变量需要您在 Manus Management UI 的 **Settings → Secrets** 中手动添加：

| 变量名 | 说明 | 是否必须 | 获取方式 |
|--------|------|----------|----------|
| `APIFY_API_TOKEN` | Apify API Token（LinkedIn 职位抓取） | 推荐 | [Apify Console](https://console.apify.com/account/integrations) |
| `APIFY_API_TOKEN_V2` | Apify API Token V2（备用） | 可选 | 同上 |
| `TAVILY_API_KEY` | Tavily Search API（搜索代理） | 可选 | [Tavily](https://tavily.com/) |

> **注意**：如果不配置 `APIFY_API_TOKEN`，Jobs Board 将使用缓存数据或示例数据，无法获取实时 LinkedIn 职位。

---

## 部署步骤

### 步骤 1：在 Manus 中创建新项目

在 Manus 中开始新对话，使用以下 Prompt：

```
请帮我创建一个名为 UHired 的 web 项目，使用 web-db-user 模板（包含数据库、服务器和用户认证）。
```

等待 Manus 初始化项目完成。

### 步骤 2：克隆 GitHub 仓库

项目初始化后，让 Manus 执行以下命令：

```
请执行以下命令，将 GitHub 仓库的代码克隆到项目目录：

cd /home/ubuntu
rm -rf UHWeb  # 删除初始化的空项目
git clone https://github.com/ZHouliRic/UHWeb.git
cd UHWeb
pnpm install
```

### 步骤 3：配置环境变量

在 Manus Management UI 中：

1. 点击右侧面板的 **Settings** 图标
2. 进入 **Secrets** 子面板
3. 添加以下环境变量（如果您有）：

```
APIFY_API_TOKEN=your_apify_token_here
```

### 步骤 4：初始化数据库

让 Manus 执行数据库迁移：

```
请执行数据库迁移命令：

cd /home/ubuntu/UHWeb
pnpm db:push
```

这将创建所有必要的数据库表。

### 步骤 5：启动开发服务器

```
请启动开发服务器：

cd /home/ubuntu/UHWeb
pnpm dev
```

### 步骤 6：验证部署

访问 Manus 提供的预览 URL，检查以下功能：

- [ ] 首页正常加载
- [ ] 可以通过 Manus OAuth 登录
- [ ] Dashboard 显示用户信息
- [ ] Resume Builder 可以创建简历
- [ ] Jobs Board 可以搜索职位（需要 Apify Token）

---

## 数据库表结构

项目使用以下主要数据表：

| 表名 | 说明 |
|------|------|
| `users` | 用户信息（通过 OAuth 自动创建） |
| `resumes` | 用户简历 |
| `resume_sections` | 简历各部分内容 |
| `tracked_jobs` | 用户追踪的职位 |
| `job_recommendations` | AI 推荐的职位 |
| `linkedin_job_cache` | LinkedIn 职位缓存 |
| `interview_history` | 模拟面试记录 |
| `skill_analysis_cache` | 技能分析缓存 |
| `user_preferences` | 用户偏好设置 |

完整表结构请参考 `drizzle/schema.ts`。

---

## 常见问题

### Q: 登录后显示 "Unauthorized" 错误

**A**: 确保项目是通过 Manus 的 `webdev_init_project` 工具创建的，这样 OAuth 配置才会正确注入。如果是直接克隆的代码，需要重新通过 Manus 创建项目。

### Q: Jobs Board 显示 "Using Cached Data"

**A**: 这表示 `APIFY_API_TOKEN` 未配置或无效。请在 Settings → Secrets 中添加有效的 Apify Token。

### Q: 数据库连接失败

**A**: 确保执行了 `pnpm db:push` 命令。如果仍然失败，可能是 Manus 平台的数据库服务暂时不可用，请稍后重试。

### Q: 如何查看数据库内容？

**A**: 在 Manus Management UI 中，点击 **Database** 面板可以直接查看和编辑数据库内容。

---

## 项目结构

```
UHWeb/
├── client/                 # 前端代码
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # 可复用组件
│   │   ├── lib/           # 工具库
│   │   └── App.tsx        # 路由配置
│   └── public/            # 静态资源
├── server/                 # 后端代码
│   ├── routers.ts         # tRPC 路由
│   ├── db.ts              # 数据库操作
│   ├── apify.ts           # Apify 集成
│   └── _core/             # 框架核心（勿修改）
├── drizzle/               # 数据库 Schema
│   └── schema.ts          # 表定义
├── shared/                # 前后端共享代码
└── storage/               # S3 存储辅助
```

---

## 联系与支持

如有问题，请通过以下方式联系：

- GitHub Issues: https://github.com/ZHouliRic/UHWeb/issues
- 项目所有者: Li Zhou

---

*文档版本: 1.0.0 | 最后更新: 2026-01-13*
