# Coursiv 课程数据生成指引

本文档定义了 Coursiv 风格课程数据的生成标准，包括数据格式、内容块类型、Playground 格式、密度比例等。任何人（包括 Manus AI）都可以根据本文档生成符合标准的课程数据。

---

## 1. 数据文件位置

所有课程数据存放在 `shared/coursivLessonData.ts` 文件中。

```
coursiv-landing/
├── shared/
│   ├── courseContentTypes.ts    # 类型定义和工厂函数
│   └── coursivLessonData.ts     # 课程数据（在此添加新课程）
```

---

## 2. 课程数据结构

### 2.1 基础结构

每个课程由一个 `CoursivLesson` 对象表示：

```typescript
interface CoursivLesson {
  id: string;           // 课程模块 ID，格式：{courseId}-{levelId}-{moduleIndex}
  title: string;        // 课程标题
  blocks: ContentBlock[]; // 内容块数组
}
```

### 2.2 模块 ID 命名规则

| 课程 | Level | Module | ID 示例 |
|------|-------|--------|---------|
| ChatGPT | Level 1 | Module 1 | `chatgpt-1-1` |
| ChatGPT | Level 1 | Module 2 | `chatgpt-1-2` |
| DALL-E | Level 2 | Module 3 | `dalle-2-3` |
| Midjourney | Level 1 | Module 1 | `midjourney-1-1` |

---

## 3. 内容块类型

系统支持 5 种内容块类型：

| 类型 | 用途 | 工厂函数 |
|------|------|----------|
| `text` | 文本内容 | `createTextBlock()` |
| `playground` | 填空练习 | `createPlaygroundBlock()` |
| `quiz` | 选择题 | `createQuizBlock()` |
| `discovery` | 知识点卡片 | `createDiscoveryBlock()` |
| `feedback` | 反馈调查 | `createFeedbackBlock()` |

---

## 4. 各类型详细格式

### 4.1 Text Block（文本块）

用于展示课程内容文本。

```typescript
createTextBlock(
  paragraphs: string[],           // 段落数组，每个元素是一段文字
  options?: {
    image?: string;               // 可选：emoji 或图片 URL
  }
)
```

**示例：**

```typescript
createTextBlock(
  [
    "ChatGPT runs on something called a **Large Language Model (LLM)**.",
    "Let's sort out how it works.",
    "Basically, an LLM is like a super-smart librarian who has read every book.",
  ],
  { image: '🧠' }
)
```

**Markdown 支持：**
- `**bold**` → 粗体
- `*italic*` → 斜体
- `` `code` `` → 行内代码
- `[text](url)` → 链接
- `• item` 或 `- item` → 列表项

---

### 4.2 Playground Block（填空练习）

用于交互式填空练习，用户选择选项填入空白处。

```typescript
createPlaygroundBlock(
  title: string,                  // 练习标题
  instruction: string,            // 练习说明
  tool: {                         // AI 工具信息
    name: string;                 // 工具名称（如 "ChatGPT"）
    icon: string;                 // 工具图标（emoji）
  },
  template: PromptTemplate[],     // 填空模板
  options: string[],              // 可选选项列表
  correctAnswers: Record<string, string>,  // 正确答案映射
  successFeedback: {              // 成功反馈
    title: string;
    message: string;
  }
)
```

**模板格式（PromptTemplate）：**

```typescript
type PromptTemplate = 
  | { type: 'text'; content: string }    // 固定文本
  | { type: 'blank'; label: string }     // 填空位置
```

**示例：**

```typescript
createPlaygroundBlock(
  'Your First Prompt',
  'Send a simple question without repeating the context.',
  { name: 'ChatGPT', icon: '💬' },
  [
    { type: 'text', content: 'Help me ' },
    { type: 'blank', label: 'action' },
    { type: 'text', content: ' for dinner tonight.' },
  ],
  ['order a pizza', 'cook pasta', 'find a restaurant'],
  { action: 'order a pizza' },
  { title: 'Great!', message: 'You just sent your first prompt to ChatGPT!' }
)
```

**渲染效果：**
```
┌─────────────────────────────────────────┐
│ 💬 ChatGPT                              │
├─────────────────────────────────────────┤
│ Help me [________] for dinner tonight.  │
│                                         │
│ ○ order a pizza                         │
│ ○ cook pasta                            │
│ ○ find a restaurant                     │
│                                         │
│ [Check]  [Skip]                         │
└─────────────────────────────────────────┘
```

---

### 4.3 Quiz Block（选择题）

用于测试用户对课程内容的理解。

```typescript
createQuizBlock(
  question: string,               // 问题文本
  options: string[],              // 选项数组
  correctIndex: number,           // 正确答案索引（从 0 开始）
  explanation: string             // 答案解释
)
```

**示例：**

```typescript
createQuizBlock(
  'ChatGPT knew you meant a vegetarian breakfast in NYC. Why is it so?',
  [
    'It searched the internet for context',
    'It remembered the earlier conversation',
    'It made a lucky guess',
  ],
  1,  // 正确答案是第 2 个选项（索引 1）
  'ChatGPT retained the NYC and vegetarian context from earlier. This is conversation memory in action.'
)
```

---

### 4.4 Discovery Block（知识点卡片）

用于总结关键知识点，显示为黄色背景卡片。

```typescript
createDiscoveryBlock(
  number: number,                 // 知识点编号（1, 2, 3...）
  title: string,                  // 标题（如 "First Discovery"）
  content: string                 // 知识点内容
)
```

**示例：**

```typescript
createDiscoveryBlock(
  1,
  'First Discovery',
  'ChatGPT remembers context from earlier in the conversation, so you don\'t need to repeat yourself!'
)
```

**渲染效果：**
```
┌─────────────────────────────────────────┐
│ 💡 First Discovery                      │
│                                         │
│ ChatGPT remembers context from earlier  │
│ in the conversation, so you don't need  │
│ to repeat yourself!                     │
└─────────────────────────────────────────┘
（黄色背景）
```

---

### 4.5 Feedback Block（反馈调查）

用于收集用户对练习的反馈。

```typescript
createFeedbackBlock(
  question: string,               // 问题文本
  options: string[],              // 选项数组
  correctIndex: number            // 期望答案索引
)
```

**示例：**

```typescript
createFeedbackBlock(
  'Was this task helpful?',
  ['Yes', 'No'],
  0  // 期望用户选择 "Yes"
)
```

---

## 5. 内容密度比例

根据 Coursiv 原站分析，推荐以下内容密度比例：

| 内容类型 | 密度 | 说明 |
|----------|------|------|
| Text | 每 1-2 块 | 基础内容，介绍概念 |
| Playground | 每 2-3 个 Text 后 | 高密度，核心互动 |
| Feedback | 每个 Playground 后 | 收集用户反馈 |
| Discovery | 每个 Playground 后 | 总结关键知识点 |
| Quiz | 每 4-5 个 Playground 后 | 低密度，测试理解 |

**推荐的内容块顺序模式：**

```
Text → Text → Playground → Feedback → Discovery → 
Text → Playground → Feedback → Discovery → 
Text → Playground → Feedback → Discovery → 
Text → Playground → Feedback → Discovery → 
Text → Quiz
```

**一个完整课程模块的典型结构（约 15-20 个 blocks）：**

| 序号 | 类型 | 内容 |
|------|------|------|
| 1 | Text | 课程介绍 + emoji 图标 |
| 2 | Text | 核心概念讲解 |
| 3 | Playground | 第一个练习 |
| 4 | Feedback | 练习反馈 |
| 5 | Discovery | 知识点 1 |
| 6 | Text | 深入讲解 |
| 7 | Playground | 第二个练习 |
| 8 | Feedback | 练习反馈 |
| 9 | Discovery | 知识点 2 |
| 10 | Text | 更多内容 |
| 11 | Playground | 第三个练习 |
| 12 | Feedback | 练习反馈 |
| 13 | Discovery | 知识点 3 |
| 14 | Text | 总结要点 |
| 15 | Quiz | 测试理解 |

---

## 6. 完整课程示例

以下是一个完整的课程模块示例：

```typescript
import {
  CoursivLesson,
  createTextBlock,
  createPlaygroundBlock,
  createQuizBlock,
  createDiscoveryBlock,
  createFeedbackBlock,
} from './courseContentTypes';

export const exampleLesson: CoursivLesson = {
  id: 'example-1-1',
  title: 'Introduction to AI Prompts',
  blocks: [
    // === 第一部分：介绍 ===
    createTextBlock(
      [
        "Welcome to **AI Prompts 101**!",
        "In this lesson, you'll learn how to communicate effectively with AI.",
        "Let's start with the basics.",
      ],
      { image: '🎯' }
    ),

    createTextBlock(
      [
        "A **prompt** is simply the text you send to an AI.",
        "Good prompts lead to good responses.",
        "Let's practice!",
      ]
    ),

    // === 第一个练习 ===
    createPlaygroundBlock(
      'Write Your First Prompt',
      'Create a simple prompt asking for help.',
      { name: 'ChatGPT', icon: '💬' },
      [
        { type: 'text', content: 'Help me write a ' },
        { type: 'blank', label: 'type' },
        { type: 'text', content: ' about ' },
        { type: 'blank', label: 'topic' },
        { type: 'text', content: '.' },
      ],
      ['poem', 'story', 'email', 'nature', 'work', 'travel'],
      { type: 'poem', topic: 'nature' },
      { title: 'Great!', message: 'You wrote your first prompt!' }
    ),

    createFeedbackBlock(
      'Was this exercise helpful?',
      ['Yes', 'No'],
      0
    ),

    createDiscoveryBlock(
      1,
      'First Discovery',
      'Simple prompts work best when you clearly state what you want.'
    ),

    // === 第二部分：进阶 ===
    createTextBlock(
      [
        "**Pro Tip:** Be specific!",
        "Instead of \"write a poem\", try \"write a haiku about spring\".",
        "The more specific, the better the result.",
      ]
    ),

    // === 第二个练习 ===
    createPlaygroundBlock(
      'Be More Specific',
      'Add details to make your prompt more specific.',
      { name: 'ChatGPT', icon: '💬' },
      [
        { type: 'text', content: 'Write a ' },
        { type: 'blank', label: 'length' },
        { type: 'text', content: ' ' },
        { type: 'blank', label: 'format' },
        { type: 'text', content: ' about ' },
        { type: 'blank', label: 'topic' },
        { type: 'text', content: ' in a ' },
        { type: 'blank', label: 'tone' },
        { type: 'text', content: ' tone.' },
      ],
      ['short', 'long', 'poem', 'story', 'coding', 'cooking', 'friendly', 'professional'],
      { length: 'short', format: 'poem', topic: 'coding', tone: 'friendly' },
      { title: 'Excellent!', message: 'Specific prompts get better results!' }
    ),

    createFeedbackBlock(
      'Do you understand the importance of specificity?',
      ['Yes', 'Not yet'],
      0
    ),

    createDiscoveryBlock(
      2,
      'Second Discovery',
      'Adding details like length, format, and tone helps AI understand exactly what you want.'
    ),

    // === 总结 ===
    createTextBlock(
      [
        "**Key Takeaways:**",
        "• Prompts are how you communicate with AI",
        "• Be clear and specific",
        "• Include details like format, length, and tone",
        "• Practice makes perfect!",
      ],
      { image: '✅' }
    ),

    // === 测试 ===
    createQuizBlock(
      'What makes a good AI prompt?',
      [
        'Using as few words as possible',
        'Being clear and specific about what you want',
        'Using complex technical jargon',
        'Making it as long as possible',
      ],
      1,
      'Good prompts are clear and specific. They tell the AI exactly what you want, including details like format, length, and tone.'
    ),
  ],
};
```

---

## 7. 如何添加新课程

### 步骤 1：在 `coursivLessonData.ts` 中添加新课程

```typescript
// 在文件末尾添加新课程
export const newLesson: CoursivLesson = {
  id: 'dalle-1-1',  // 确保 ID 与 courseData.ts 中的模块 ID 匹配
  title: 'Introduction to DALL-E',
  blocks: [
    // ... 内容块
  ],
};
```

### 步骤 2：注册到 coursivLessons 对象

```typescript
export const coursivLessons: Record<string, CoursivLesson> = {
  'chatgpt-1-1': chatgptLesson1,
  'chatgpt-1-2': chatgptLesson2,
  'dalle-1-1': newLesson,  // 添加新课程
};
```

### 步骤 3：确保 courseData.ts 中有对应的模块

在 `shared/courseData.ts` 中确保有对应的课程和模块定义：

```typescript
{
  id: 'dalle',
  title: 'DALL-E Mastery',
  levels: [
    {
      id: 'dalle-1',
      title: 'Level 1: Basics',
      modules: [
        {
          id: 'dalle-1-1',  // 必须与 coursivLessonData.ts 中的 ID 匹配
          title: 'Introduction to DALL-E',
          type: 'lesson',
          // ...
        },
      ],
    },
  ],
}
```

---

## 8. Playground 设计指南

### 8.1 填空数量

| 难度 | 填空数量 | 适用场景 |
|------|----------|----------|
| 简单 | 1 个 | 入门概念 |
| 中等 | 2-3 个 | 核心技能 |
| 复杂 | 4+ 个 | 高级应用 |

### 8.2 选项设计

- 提供 3-6 个选项
- 包含 1 个正确答案
- 干扰选项应该合理但不正确
- 选项文字简短明了

### 8.3 反馈设计

- 成功标题：使用积极词汇（Great!, Excellent!, Perfect!）
- 成功消息：解释为什么这是正确答案
- 消息长度：1-2 句话

---

## 9. 内容写作指南

### 9.1 文本风格

- 使用第二人称（you, your）
- 句子简短，每段 2-4 句
- 使用 **粗体** 强调关键词
- 适当使用 emoji 增加趣味性

### 9.2 知识点总结

- 每个 Discovery 只包含一个核心概念
- 使用简单直接的语言
- 与前面的 Playground 练习相关联

### 9.3 Quiz 设计

- 问题明确，不含歧义
- 选项长度相近
- 正确答案不要总是在同一位置
- 解释要清晰说明为什么正确

---

## 10. 验证清单

在提交新课程数据前，请检查：

- [ ] 模块 ID 格式正确（`{course}-{level}-{module}`）
- [ ] 模块 ID 与 courseData.ts 中的定义匹配
- [ ] 内容密度符合推荐比例
- [ ] 每个 Playground 后有 Feedback 和 Discovery
- [ ] Quiz 放在课程末尾
- [ ] 所有 Playground 的正确答案在选项列表中
- [ ] Markdown 格式正确（粗体、斜体等）
- [ ] 无 TypeScript 类型错误

---

## 11. 快速参考

### 工厂函数导入

```typescript
import {
  CoursivLesson,
  createTextBlock,
  createPlaygroundBlock,
  createQuizBlock,
  createDiscoveryBlock,
  createFeedbackBlock,
} from './courseContentTypes';
```

### 内容块顺序模板

```
Text (intro) → Text → Playground → Feedback → Discovery →
Text → Playground → Feedback → Discovery →
Text → Playground → Feedback → Discovery →
Text (summary) → Quiz
```

### 密度比例速查

| 比例 | 说明 |
|------|------|
| Text : Playground | 2-3 : 1 |
| Playground : Quiz | 4-5 : 1 |
| Playground : Feedback | 1 : 1 |
| Playground : Discovery | 1 : 1 |

---

*文档版本：1.0*
*最后更新：2026-01-14*
*作者：Manus AI*
