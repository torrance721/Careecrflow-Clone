# Apify Glassdoor Scraper 研究笔记

## 爬虫信息

- **名称**: Glassdoor|Reviews|Interviews|Locations|Salary|Job|Overview
- **ID**: `memo23/apify-glassdoor-reviews-scraper`
- **价格**: $29.00/月 + 使用量
- **评分**: ⭐ 4.4 (9 评价)
- **用户**: 610 总用户，37 月活用户

## 可抓取的数据类型

1. **Reviews** - 员工评论（评分、标题、优缺点、公司回复）
2. **Interviews** - 面试经历（问题、详情、体验）
3. **Office locations** - 办公地点
4. **Salaries** - 薪资数据（详细薪资统计和薪酬分解）
5. **Jobs** - 职位发布
6. **Individual job ads** - 单个职位详情
7. **Company details/overview** - 公司信息（行业、规模、评分、员工数）
8. **Culture/Diversity data** - 文化/多样性数据
9. **Benefits data** - 福利数据

## 关键功能

### 面试数据 (Interviews)
- 面试问题
- 面试详情
- 面试体验
- 可按日期过滤 (`interviewsStartDate`)

### 多语言支持
支持语言: eng, fra, por, spa, ita, nld, deu

### 输入参数

```json
{
  "startUrls": ["https://www.glassdoor.com/Interview/Google-Interview-Questions-E9079.htm"],
  "command": "interviews",
  "maxItems": 100,
  "interviewsStartDate": "2024-01-01",
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### 输出示例（面试数据）

```json
{
  "interviewQuestion": "How would you design a system to...",
  "interviewDetails": "...",
  "experience": "positive/negative/neutral",
  "difficulty": "easy/medium/hard",
  "jobTitle": "Data Analyst",
  "date": "2024-12-01",
  "location": "Mountain View, CA"
}
```

## API 调用方式

```typescript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// 运行 Actor
const run = await client.actor('memo23/apify-glassdoor-reviews-scraper').call({
  startUrls: [
    { url: 'https://www.glassdoor.com/Interview/Google-Interview-Questions-E9079.htm' }
  ],
  command: 'interviews',
  maxItems: 50,
});

// 获取结果
const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

## 适用场景

1. **面试准备知识库**: 抓取目标公司的面试问题和经验
2. **薪资调研**: 了解目标职位的薪资范围
3. **公司研究**: 获取公司文化、评分、福利等信息

## 注意事项

- 需要 Apify 账户和 API Token
- 按使用量计费（$29/月 + 额外使用）
- 建议使用代理以避免被封
- 数据可能有延迟（非实时）

## 与 Tavily 的配合策略

| 数据源 | 用途 | 优先级 |
|--------|------|--------|
| **Apify Glassdoor** | 结构化面试问题、薪资、公司评分 | 1 |
| **Tavily Search** | 补充搜索（一亩三分地、Reddit、博客等） | 2 |

**推荐策略**:
1. 先用 Apify 抓取 Glassdoor 的结构化数据
2. 用 Tavily 补充搜索其他来源（一亩三分地、Reddit、公司官网等）
3. 合并数据存入知识库
