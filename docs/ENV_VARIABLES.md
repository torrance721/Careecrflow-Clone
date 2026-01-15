# UHWeb 环境变量配置说明

本文档详细说明 UHWeb 项目所需的所有环境变量及其配置方式。

---

## Manus 平台自动注入的变量

以下变量由 Manus 平台在创建 `web-db-user` 类型项目时自动注入，**无需手动配置**：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | MySQL/TiDB 数据库连接字符串 | `mysql://user:pass@host:4000/db?ssl={}` |
| `JWT_SECRET` | Session Cookie 签名密钥 | `random_32_char_string` |
| `VITE_APP_ID` | Manus OAuth 应用 ID | `app_xxxxx` |
| `OAUTH_SERVER_URL` | Manus OAuth 后端 URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus 登录门户 URL | `https://manus.im/oauth` |
| `OWNER_OPEN_ID` | 项目所有者 OpenID | `user_xxxxx` |
| `OWNER_NAME` | 项目所有者名称 | `Your Name` |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL | `https://forge.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API 密钥（服务端） | `sk_xxxxx` |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Forge API URL（前端） | `https://forge.manus.im` |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus Forge API 密钥（前端） | `pk_xxxxx` |

---

## 可自定义的变量

以下变量可在 Manus Management UI 的 **Settings → General** 或 **Settings → Secrets** 中修改：

| 变量名 | 说明 | 默认值 | 配置位置 |
|--------|------|--------|----------|
| `VITE_APP_TITLE` | 应用标题 | `UHired` | Settings → General |
| `VITE_APP_LOGO` | 应用 Logo URL | - | Settings → General |

---

## 需要手动配置的变量

以下变量需要在 Manus Management UI 的 **Settings → Secrets** 中手动添加：

### APIFY_API_TOKEN（推荐）

**用途**: LinkedIn 职位实时抓取

**获取方式**:
1. 访问 [Apify Console](https://console.apify.com/)
2. 注册/登录账户
3. 进入 Settings → Integrations
4. 复制 Personal API Token

**配置方法**:
1. 打开 Manus Management UI
2. 点击 Settings → Secrets
3. 添加新的 Secret：
   - Key: `APIFY_API_TOKEN`
   - Value: 您的 Apify Token

**不配置的影响**: Jobs Board 将显示 "Using Cached Data"，无法获取实时 LinkedIn 职位。

---

### APIFY_API_TOKEN_V2（可选）

**用途**: Apify API Token 的备用版本

**说明**: 如果您有多个 Apify Token，可以配置此变量作为备用。

---

### TAVILY_API_KEY（可选）

**用途**: Tavily Search API，用于搜索代理功能

**获取方式**:
1. 访问 [Tavily](https://tavily.com/)
2. 注册账户
3. 获取 API Key

**不配置的影响**: 搜索代理功能将使用默认的开发密钥（有限额）。

---

## 开发环境变量

以下变量仅用于本地开发，Manus 环境中会自动处理：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 开发服务器端口 | `3000` |
| `NODE_ENV` | Node 环境 | `development` |
| `BASE_URL` | 测试用 Base URL | `http://localhost:3000` |

---

## 变量使用位置

| 变量 | 使用文件 |
|------|----------|
| `DATABASE_URL` | `drizzle.config.ts`, `server/db.ts` |
| `JWT_SECRET` | `server/_core/env.ts` |
| `VITE_APP_ID` | `server/_core/env.ts`, 前端 OAuth |
| `OAUTH_SERVER_URL` | `server/_core/env.ts` |
| `BUILT_IN_FORGE_API_*` | `server/_core/env.ts`, LLM 调用 |
| `APIFY_API_TOKEN*` | `server/apify.ts` |
| `TAVILY_API_KEY` | `server/agents/searchAgent.ts` |

---

*文档版本: 1.0.0 | 最后更新: 2026-01-13*
