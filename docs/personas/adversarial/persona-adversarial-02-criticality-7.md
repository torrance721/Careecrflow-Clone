# Adversarial Persona: Sarah Chen (挑剔度 7/10)

## 基本信息

| 属性 | 值 |
|------|-----|
| **姓名** | Sarah Chen |
| **年龄** | 32 |
| **职业** | Senior Software Engineer |
| **目标职位** | Staff Engineer at Netflix |
| **教育背景** | Stanford CS Master |
| **工作经验** | 8 年 |
| **挑剔度** | 7/10 |

---

## 用户画像

Sarah 是一位经验丰富的高级软件工程师，目前在一家中型科技公司工作。她正在准备跳槽到 Netflix 担任 Staff Engineer。她对技术有深刻的理解，对面试准备工具有很高的期望。

### 性格特点

- **技术完美主义者**：对技术细节非常挑剔
- **效率至上**：不喜欢浪费时间
- **批判性思维**：会质疑 AI 的建议是否合理
- **高标准**：期望工具能提供真正有价值的反馈

### 痛点

1. 市面上的面试准备工具太泛泛而谈
2. AI 反馈经常不够深入，缺乏技术深度
3. 推荐的公司和职位不够精准
4. 系统设计问题的反馈不够专业

### 期望

1. 针对 Staff Engineer 级别的深度问题
2. 技术反馈要有深度，不能只是泛泛而谈
3. 公司推荐要考虑技术栈匹配度
4. 反馈要能指出具体的技术盲点

---

## 测试场景

### 场景 1: 系统设计话题

**输入职位**：Staff Engineer at Netflix

**预期问题类型**：
- 系统设计（如设计 Netflix 的推荐系统）
- 技术领导力
- 跨团队协作

**Sarah 的回答风格**：
- 使用专业术语
- 提供详细的技术方案
- 主动提到权衡（trade-offs）
- 可能会故意留下一些技术盲点，测试 AI 是否能发现

### 场景 2: 技术深度测试

**测试目的**：验证 AI 是否能给出有深度的技术反馈

**Sarah 的测试策略**：
1. 给出一个看似完整但有隐藏问题的答案
2. 观察 AI 是否能发现问题
3. 评估反馈的技术深度

---

## 评分标准

Sarah 会从以下维度评分：

| 维度 | 权重 | 评分标准 |
|------|------|----------|
| 问题相关性 | 25% | 问题是否针对 Staff Engineer 级别 |
| 技术深度 | 30% | 反馈是否有技术深度 |
| 反馈精准度 | 25% | 是否能指出具体问题 |
| 公司匹配度 | 10% | 推荐公司是否合理 |
| 用户体验 | 10% | 界面是否专业、响应是否及时 |

### 评分门槛

- **满意**：≥ 8/10
- **可接受**：6-7/10
- **不满意**：< 6/10

---

## 测试用例

### 用例 1: 系统设计问题回答

**问题**：Design a video streaming service like Netflix

**Sarah 的回答**：
```
I'd approach this by first clarifying requirements. For a Netflix-like service, we need to handle:
- 200M+ users globally
- Peak concurrent streams: 10M+
- Video quality: 4K HDR support
- Latency: < 200ms for video start

For the architecture, I'd use:
1. CDN layer with edge caching for video delivery
2. Microservices architecture for the backend
3. Recommendation service using collaborative filtering
4. Video encoding pipeline with adaptive bitrate streaming

For the database layer, I'd use:
- User data: Sharded MySQL or PostgreSQL
- Video metadata: Elasticsearch for search
- Viewing history: Cassandra for high write throughput
- Cache: Redis for session data and recommendations

The key trade-offs I'm considering:
- Consistency vs availability for user preferences
- Cost vs latency for CDN coverage
- Personalization accuracy vs computation cost
```

**期望 AI 发现的问题**：
1. 没有提到 fault tolerance 和 disaster recovery
2. 没有讨论 video encoding 的具体策略
3. 没有提到 A/B testing infrastructure
4. 缺少对 cold start problem 的讨论

---

## 预期结果

### 成功标准

1. AI 能识别出这是 Staff Engineer 级别的面试
2. 追问能深入到系统设计的细节
3. 反馈能指出具体的技术盲点
4. 公司推荐考虑技术栈匹配（如 Netflix, Spotify, Disney+）

### 失败标准

1. 问题太基础，不适合 Staff Engineer 级别
2. 反馈泛泛而谈，没有技术深度
3. 没有发现回答中的技术盲点
4. 公司推荐与技术栈不匹配

---

*Persona 创建时间：2026年1月7日*
