# Apify LinkedIn Jobs Scraper 集成笔记

## Actor 信息
- **Actor ID**: `bebity/linkedin-jobs-scraper`
- **价格**: $29.99/月 + 使用费
- **评分**: 3.9 (50 评价)

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 职位名称 (如 "Web developer") |
| `location` | string | 是 | 职位地点 (如 "Paris", "New York")，默认 "United States" |
| `companyName` | array | 否 | 公司名称列表 (如 ["Google", "NASA"]) |
| `companyId` | array | 否 | 公司 ID 列表 (如 Facebook: 76987811, Uber: 1815218) |
| `publishedAt` | enum | 否 | 发布时间筛选 ("r2592000"=30天, "r604800"=7天, "r86400"=24小时) |
| `rows` | integer | 是 | 返回行数，默认 50 |
| `workType` | enum | 否 | 工作类型 ("1"=现场, "2"=远程, "3"=混合) |
| `contractType` | enum | 否 | 合同类型 ("F"=全职, "P"=兼职, "C"=合同, "T"=临时, "I"=实习, "V"=志愿) |
| `experienceLevel` | enum | 否 | 经验级别 ("1"=入门, "2"=初级, "3"=中级, "4"=高级, "5"=总监) |
| `proxy` | object | 否 | 代理配置，默认使用 Apify 住宅代理 |

## Python API 调用示例

```python
from apify_client import ApifyClient

# 初始化客户端
client = ApifyClient("<YOUR_API_TOKEN>")

# 准备输入参数
run_input = {
    "title": "Software Engineer",
    "location": "San Francisco",
    "rows": 50,
    "workType": "2",  # 远程
    "contractType": "F",  # 全职
    "proxy": {
        "useApifyProxy": True,
        "apifyProxyGroups": ["RESIDENTIAL"],
    },
}

# 运行 Actor 并等待完成
run = client.actor("bebity/linkedin-jobs-scraper").call(run_input=run_input)

# 获取结果
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)
```

## 输出数据格式 (预期)
- 职位标题
- 公司名称
- 地点
- 薪资范围
- 职位描述
- 发布时间
- LinkedIn 职位链接
- 公司 ID

## 集成方案

### 1. 服务端集成
在 `server/` 目录下创建 Apify 服务模块：
- `server/apify.ts` - Apify 客户端封装
- 使用 HTTP API 而非 Python 客户端（因为项目是 Node.js）

### 2. 数据库存储
扩展 `jobRecommendations` 表：
- 添加 `linkedinJobId` 字段
- 添加 `linkedinUrl` 字段
- 添加 `scrapedAt` 时间戳

### 3. tRPC 路由
- `jobs.scrapeLinkedIn` - 触发 LinkedIn 职位抓取
- `jobs.syncFromApify` - 同步 Apify 抓取结果

### 4. 前端集成
- 在 Job Preferences 保存后触发抓取
- 显示抓取状态和进度
- 展示真实 LinkedIn 职位数据

## 注意事项
1. 需要用户提供 Apify API Token
2. 考虑抓取频率限制和成本
3. 缓存抓取结果避免重复请求
4. 处理抓取失败情况
