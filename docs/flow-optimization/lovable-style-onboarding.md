# Lovable 风格开场界面交互方案

**文档日期**：2026年1月5日  
**版本**：2.0  
**设计灵感**：Lovable.dev + ACourse 实现

---

## 一、设计理念

### 参考 ACourse 的实现

ACourse 已经实现了一个非常好的"目标导向"开场界面，包含：

1. **TypingPlaceholder 组件**：打字机效果展示各种目标
2. **goal-input 样式**：蓝色虚线边框的输入框
3. **goal-card 样式**：可点击的目标卡片

我们将复用这些组件和样式，适配到 UHired 的场景。

---

## 二、界面设计

### 第一屏：开场页面

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                              UHired                                      │
│                                                                          │
│                         我想成为...                                      │
│                                                                          │
│              Meta 的产品经理|                                            │
│              ↑ 打字机效果，自动切换                                       │
│                                                                          │
│     ┌───────────────────────────────────────────────────────────┐       │
│     │  输入你的目标职位...                              [开始 →] │       │
│     └───────────────────────────────────────────────────────────┘       │
│                                                                          │
│                        热门目标                                          │
│     ┌─────────────────────────┐  ┌─────────────────────────┐            │
│     │ 🎯 产品经理              │  │ 📊 数据分析师           │            │
│     │ 带领团队打造产品         │  │ 用数据驱动决策          │            │
│     └─────────────────────────┘  └─────────────────────────┘            │
│     ┌─────────────────────────┐  ┌─────────────────────────┐            │
│     │ 💻 软件工程师            │  │ 🎨 UX 设计师            │            │
│     │ 构建改变世界的软件       │  │ 设计用户喜爱的体验      │            │
│     └─────────────────────────┘  └─────────────────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 跑马灯内容（职业目标）

```typescript
// 中文版
export const CAREER_EXAMPLES_ZH = [
  "Meta 的产品经理",
  "Google 的数据分析师",
  "Amazon 的软件工程师",
  "Apple 的 UX 设计师",
  "Microsoft 的云架构师",
  "Netflix 的内容策略师",
  "Stripe 的全栈工程师",
  "Airbnb 的增长经理",
  "Tesla 的机器学习工程师",
  "ByteDance 的后端开发",
  "Shopify 的前端工程师",
  "阿里巴巴的产品经理",
  "腾讯的游戏策划",
  "字节跳动的算法工程师",
];

// 英文版
export const CAREER_EXAMPLES_EN = [
  "Product Manager at Meta",
  "Data Analyst at Google",
  "Software Engineer at Amazon",
  "UX Designer at Apple",
  "Cloud Architect at Microsoft",
  "Content Strategist at Netflix",
  "Full-Stack Engineer at Stripe",
  "Growth Manager at Airbnb",
  "ML Engineer at Tesla",
  "Backend Developer at ByteDance",
  "Frontend Engineer at Shopify",
  "Solutions Architect at Salesforce",
];
```

---

## 三、完整流程

### 流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  第一屏：开场                                                            │
│                                                                          │
│  "我想成为..."                                                           │
│  [打字机效果: Meta 的产品经理|]                                          │
│                                                                          │
│  [输入框: 输入你的目标职位...]                        [开始 →]           │
│                                                                          │
│  或点击热门目标卡片                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  第二屏：简历（对话式）                                                  │
│                                                                          │
│  🤖 "太棒了！想成为 Google 的数据分析师。                                │
│      先让我了解一下你的背景，你有简历吗？"                               │
│                                                                          │
│  [📄 上传简历]     [暂时没有，直接开始]                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  第三屏：详细情况（对话式）                                              │
│                                                                          │
│  🤖 "好的！现在说说你的情况吧，越详细越好。"                             │
│                                                                          │
│  引导提示：                                                              │
│  • 你的教育/工作背景                                                     │
│  • 目前求职进展（投了多少、有没有面试）                                  │
│  • 最担心什么问题                                                        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  我是计算机专业的应届生，投了很多数据分析岗位...                │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│                                              [开始面试练习 →]            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  第四屏：AI 生成针对性面试                                               │
│                                                                          │
│  Context = 目标职业 + 简历（如有）+ 用户描述                             │
│                                                                          │
│  AI 生成针对 "Google 数据分析师" 的面试问题...                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 四、组件复用

### 从 ACourse 复用的组件

| 组件 | 用途 | 修改点 |
|------|------|--------|
| `TypingPlaceholder` | 打字机效果 | 改用职业目标数组 |
| `goal-input` 样式 | 输入框样式 | 直接复用 |
| `goal-card` 样式 | 热门目标卡片 | 直接复用 |

### 新增组件

| 组件 | 用途 |
|------|------|
| `OnboardingChat` | 对话式引导（简历 + 情况） |
| `ResumeUpload` | 简历上传组件 |
| `SituationInput` | 情况描述输入 |

---

## 五、代码实现参考

### TypingPlaceholder 组件（复用 ACourse）

```tsx
// 从 ACourse 复制 TypingPlaceholder.tsx
// 修改 GOAL_EXAMPLES 为职业目标

export const CAREER_EXAMPLES = [
  "Meta 的产品经理",
  "Google 的数据分析师",
  "Amazon 的软件工程师",
  // ...
];

export const CAREER_EXAMPLES_EN = [
  "Product Manager at Meta",
  "Data Analyst at Google",
  "Software Engineer at Amazon",
  // ...
];
```

### 开场页面结构

```tsx
export default function Onboarding() {
  const [careerGoal, setCareerGoal] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { language, t } = useLanguage();
  
  const careerExamples = language === "zh" ? CAREER_EXAMPLES : CAREER_EXAMPLES_EN;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav>...</nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center pt-12 md:pt-20 px-4">
        {/* Title with Typing Effect */}
        <h1 className="text-3xl md:text-4xl font-normal text-center mb-4">
          {t.onboarding.title} {/* "我想成为..." */}
        </h1>
        
        {/* Typing placeholder preview */}
        <div className="text-xl md:text-2xl text-center mb-10 h-8">
          {!isFocused && !careerGoal && (
            <TypingPlaceholder
              prefix=""
              phrases={careerExamples}
              typingSpeed={60}
              deletingSpeed={30}
              pauseDuration={1500}
              className="text-muted-foreground"
            />
          )}
        </div>

        {/* Input Box */}
        <div className="w-full max-w-2xl mb-12">
          <div className={`goal-input flex items-center bg-background ${isFocused ? 'ring-2 ring-primary/20' : ''}`}>
            <input
              value={careerGoal}
              onChange={(e) => setCareerGoal(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t.onboarding.inputPlaceholder}
              className="flex-1 bg-transparent px-5 py-4 text-base outline-none"
            />
            <Button onClick={handleStart} className="mr-3 rounded-full">
              {t.onboarding.startButton} <ArrowRight />
            </Button>
          </div>
        </div>

        {/* Popular Career Cards */}
        <div className="w-full max-w-3xl">
          <h2 className="text-sm font-medium text-muted-foreground mb-4 text-center">
            {t.onboarding.popularCareers}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {popularCareers.map((career) => (
              <button
                key={career.key}
                onClick={() => handleCareerClick(career)}
                className="goal-card group text-left p-5 flex items-center gap-4"
              >
                <div className="text-2xl">{career.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold">{career.title}</h3>
                  <p className="text-sm text-muted-foreground">{career.description}</p>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

---

## 六、样式复用

### 从 ACourse 复用的样式

```css
/* Goal-oriented homepage styles */
.goal-input {
  border: 2px dashed var(--ladder-blue);
  border-radius: 0.75rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.goal-input:focus-within {
  border-color: oklch(0.4 0.12 240);
  box-shadow: 0 0 0 4px var(--ladder-blue-light);
}

.goal-card {
  border: 2px dashed var(--border);
  background: var(--card);
  border-radius: 0.75rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.goal-card:hover {
  border-color: var(--ladder-blue);
  background: var(--ladder-blue-light);
  transform: translateX(4px);
  box-shadow: -4px 4px 0 var(--ladder-blue-light);
}
```

### UHired 特有的颜色变量

```css
:root {
  /* 复用 ACourse 的 ladder 颜色系统 */
  --ladder-blue: oklch(0.45 0.15 250);
  --ladder-blue-light: oklch(0.45 0.15 250 / 0.1);
  
  /* 或者使用 UHired 自己的蓝色主题 */
  --uhired-primary: oklch(0.55 0.2 250);
  --uhired-primary-light: oklch(0.55 0.2 250 / 0.1);
}
```

---

## 七、热门职业卡片

### 卡片数据结构

```typescript
interface CareerCard {
  key: string;
  icon: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  searchTerm: string; // 用于后续职位搜索
}

const POPULAR_CAREERS: CareerCard[] = [
  {
    key: "pm",
    icon: "🎯",
    title: { zh: "产品经理", en: "Product Manager" },
    description: { zh: "带领团队打造用户喜爱的产品", en: "Lead teams to build products users love" },
    searchTerm: "product manager",
  },
  {
    key: "data",
    icon: "📊",
    title: { zh: "数据分析师", en: "Data Analyst" },
    description: { zh: "用数据驱动业务决策", en: "Drive business decisions with data" },
    searchTerm: "data analyst",
  },
  {
    key: "swe",
    icon: "💻",
    title: { zh: "软件工程师", en: "Software Engineer" },
    description: { zh: "构建改变世界的软件", en: "Build software that changes the world" },
    searchTerm: "software engineer",
  },
  {
    key: "ux",
    icon: "🎨",
    title: { zh: "UX 设计师", en: "UX Designer" },
    description: { zh: "设计用户喜爱的体验", en: "Design experiences users love" },
    searchTerm: "ux designer",
  },
  {
    key: "frontend",
    icon: "🌐",
    title: { zh: "前端工程师", en: "Frontend Engineer" },
    description: { zh: "打造精美的用户界面", en: "Create beautiful user interfaces" },
    searchTerm: "frontend engineer",
  },
  {
    key: "ml",
    icon: "🤖",
    title: { zh: "机器学习工程师", en: "ML Engineer" },
    description: { zh: "用 AI 解决复杂问题", en: "Solve complex problems with AI" },
    searchTerm: "machine learning engineer",
  },
];
```

---

## 八、对话式引导界面

### 简历问题

```tsx
function ResumeStep({ onNext }: { onNext: (hasResume: boolean, resumeData?: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* AI 消息 */}
      <div className="flex gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          🤖
        </div>
        <div className="flex-1 bg-muted rounded-lg p-4">
          <p>太棒了！想成为 <strong>{careerGoal}</strong>。</p>
          <p className="mt-2">先让我了解一下你的背景，你有简历吗？</p>
        </div>
      </div>
      
      {/* 用户选项 */}
      <div className="flex gap-4 justify-center">
        <Button variant="outline" onClick={() => /* 打开上传 */}>
          📄 上传简历
        </Button>
        <Button variant="ghost" onClick={() => onNext(false)}>
          暂时没有，直接开始
        </Button>
      </div>
    </div>
  );
}
```

### 情况描述

```tsx
function SituationStep({ onNext }: { onNext: (situation: string) => void }) {
  const [situation, setSituation] = useState("");
  
  return (
    <div className="max-w-2xl mx-auto">
      {/* AI 消息 */}
      <div className="flex gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          🤖
        </div>
        <div className="flex-1 bg-muted rounded-lg p-4">
          <p>好的！现在说说你的情况吧，<strong>越详细越好</strong>。</p>
          <p className="mt-2 text-sm text-muted-foreground">比如：</p>
          <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside">
            <li>你的教育/工作背景</li>
            <li>目前求职进展（投了多少、有没有面试）</li>
            <li>最担心什么问题</li>
          </ul>
        </div>
      </div>
      
      {/* 用户输入 */}
      <Textarea
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        placeholder="我是计算机专业的应届生，投了很多数据分析岗位..."
        className="min-h-[150px] mb-4"
      />
      
      <Button onClick={() => onNext(situation)} className="w-full">
        开始面试练习 <ArrowRight className="ml-2" />
      </Button>
    </div>
  );
}
```

---

## 九、实现步骤

### 第一步：复制组件

1. 复制 `TypingPlaceholder.tsx` 到 UHWeb
2. 修改职业目标数组

### 第二步：添加样式

1. 添加 `goal-input` 和 `goal-card` 样式到 `index.css`
2. 添加必要的颜色变量

### 第三步：创建页面

1. 创建 `Onboarding.tsx` 页面
2. 实现三步流程：目标 → 简历 → 情况

### 第四步：集成

1. 修改路由，新用户进入 Onboarding
2. 将收集的信息传递给面试生成系统

---

*文档完成时间：2026年1月5日*  
*作者：Manus AI*
