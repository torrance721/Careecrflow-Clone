/**
 * Enhanced Hint System
 * 
 * 优化 Hint 系统：
 * 1. Hint 是思路框架/关键词提示，而非完整答案
 * 2. 分级 Hint：第一次给思路，第二次给更具体的框架
 * 3. 检测复制粘贴行为，给予提醒
 * 4. 鼓励用户用自己的话表达
 */

import { invokeLLM } from '../_core/llm';

export interface EnhancedHintRequest {
  question: string;
  userResponse?: string;
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  hintLevel: 1 | 2 | 3;  // 1=思路, 2=框架, 3=具体示例
  previousHints?: string[];  // 之前给过的 hints
  language: 'en' | 'zh';
}

export interface EnhancedHintResponse {
  hint: string;
  hintLevel: 1 | 2 | 3;
  framework?: string[];  // 结构化框架（如 STAR 的各个部分）
  keywords?: string[];  // 关键词提示
  thinkingPrompts?: string[];  // 思考引导问题
  doNotCopyWarning: boolean;  // 是否显示不要复制的警告
  nextLevelAvailable: boolean;  // 是否还有下一级 hint
}

export interface CopyPasteDetectionResult {
  isCopyPaste: boolean;
  similarity: number;  // 0-1
  matchedPhrases: string[];
  suggestion: string;
}

/**
 * 生成分级 Hint
 */
export async function generateEnhancedHint(request: EnhancedHintRequest): Promise<EnhancedHintResponse> {
  const { question, userResponse, conversationHistory, hintLevel, previousHints, language } = request;
  const isZh = language === 'zh';
  
  const levelDescriptions = {
    1: isZh ? '思路引导' : 'Thinking Direction',
    2: isZh ? '结构框架' : 'Structure Framework',
    3: isZh ? '具体示例' : 'Specific Examples',
  };
  
  const levelInstructions = {
    1: isZh 
      ? `提供思考方向和关键概念，不要给出具体内容：
         - 给出 2-3 个思考角度
         - 提供 3-5 个关键词
         - 不要给出完整句子或段落
         - 鼓励用户用自己的经历来回答`
      : `Provide thinking direction and key concepts, NOT specific content:
         - Give 2-3 thinking angles
         - Provide 3-5 keywords
         - Do NOT give complete sentences or paragraphs
         - Encourage user to use their own experience`,
    2: isZh
      ? `提供结构化框架，但不要填充内容：
         - 给出回答结构（如 STAR 方法的各个部分）
         - 每个部分只给标题和 1-2 个关键词
         - 不要给出示例内容
         - 提示用户需要填充自己的经历`
      : `Provide structured framework, but do NOT fill in content:
         - Give answer structure (e.g., STAR method parts)
         - Only give title and 1-2 keywords for each part
         - Do NOT give example content
         - Remind user to fill in their own experience`,
    3: isZh
      ? `提供更具体的引导，但仍然不是完整答案：
         - 给出每个部分应该包含的元素
         - 可以给出简短的示例短语（不超过 5 个词）
         - 强调用户必须用自己的话重新表达
         - 警告不要直接复制`
      : `Provide more specific guidance, but still NOT a complete answer:
         - Give elements each part should contain
         - Can give brief example phrases (no more than 5 words)
         - Emphasize user MUST rephrase in their own words
         - Warn against direct copying`,
  };
  
  const previousHintsContext = previousHints && previousHints.length > 0
    ? (isZh 
        ? `\n\n之前给过的提示（避免重复）：\n${previousHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
        : `\n\nPrevious hints given (avoid repetition):\n${previousHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`)
    : '';
  
  const systemPrompt = isZh
    ? `你是一位面试教练，正在给用户提供 ${levelDescriptions[hintLevel]} 级别的提示。

当前问题：${question}
${userResponse ? `用户的尝试回答：${userResponse}` : '用户还没有开始回答。'}
${previousHintsContext}

重要规则：
${levelInstructions[hintLevel]}

你的目标是帮助用户思考，而不是替他们回答。
用户应该能够用自己的话、自己的经历来完成回答。

返回 JSON 格式：
{
  "hint": "简短的提示文本（不超过 50 字）",
  "framework": ["框架点1", "框架点2", ...],
  "keywords": ["关键词1", "关键词2", ...],
  "thinkingPrompts": ["思考问题1？", "思考问题2？", ...]
}`
    : `You are an interview coach providing a ${levelDescriptions[hintLevel]} level hint.

Current question: ${question}
${userResponse ? `User's attempted response: ${userResponse}` : 'User has not started answering yet.'}
${previousHintsContext}

Important rules:
${levelInstructions[hintLevel]}

Your goal is to help the user THINK, not to answer for them.
The user should be able to complete the answer in their own words, with their own experience.

Return JSON format:
{
  "hint": "Brief hint text (no more than 50 words)",
  "framework": ["Framework point 1", "Framework point 2", ...],
  "keywords": ["Keyword 1", "Keyword 2", ...],
  "thinkingPrompts": ["Thinking question 1?", "Thinking question 2?", ...]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isZh ? '请给我提示' : 'Please give me a hint' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'enhanced_hint',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              hint: { type: 'string' },
              framework: { type: 'array', items: { type: 'string' } },
              keywords: { type: 'array', items: { type: 'string' } },
              thinkingPrompts: { type: 'array', items: { type: 'string' } },
            },
            required: ['hint', 'framework', 'keywords', 'thinkingPrompts'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid LLM response');
    }

    const parsed = JSON.parse(content);
    
    return {
      hint: parsed.hint,
      hintLevel,
      framework: parsed.framework,
      keywords: parsed.keywords,
      thinkingPrompts: parsed.thinkingPrompts,
      doNotCopyWarning: hintLevel >= 2,
      nextLevelAvailable: hintLevel < 3,
    };
  } catch (error) {
    console.error('[EnhancedHintSystem] Error generating hint:', error);
    
    // Fallback hint
    return {
      hint: isZh 
        ? '试着用 STAR 方法来组织你的回答：情境、任务、行动、结果。' 
        : 'Try using the STAR method to structure your answer: Situation, Task, Action, Result.',
      hintLevel,
      framework: isZh 
        ? ['情境 (Situation)', '任务 (Task)', '行动 (Action)', '结果 (Result)']
        : ['Situation', 'Task', 'Action', 'Result'],
      keywords: [],
      thinkingPrompts: isZh
        ? ['你遇到了什么挑战？', '你采取了什么行动？', '结果如何？']
        : ['What challenge did you face?', 'What action did you take?', 'What was the result?'],
      doNotCopyWarning: hintLevel >= 2,
      nextLevelAvailable: hintLevel < 3,
    };
  }
}

/**
 * 检测用户回答是否是复制粘贴 Hint
 */
export function detectCopyPaste(
  userResponse: string,
  previousHints: string[],
  language: 'en' | 'zh'
): CopyPasteDetectionResult {
  const isZh = language === 'zh';
  
  if (!userResponse || previousHints.length === 0) {
    return {
      isCopyPaste: false,
      similarity: 0,
      matchedPhrases: [],
      suggestion: '',
    };
  }
  
  const userResponseLower = userResponse.toLowerCase().trim();
  const matchedPhrases: string[] = [];
  let maxSimilarity = 0;
  
  for (const hint of previousHints) {
    const hintLower = hint.toLowerCase().trim();
    
    // 检查直接复制
    if (userResponseLower.includes(hintLower) || hintLower.includes(userResponseLower)) {
      maxSimilarity = Math.max(maxSimilarity, 0.9);
      matchedPhrases.push(hint.slice(0, 50) + '...');
    }
    
    // 检查部分匹配（连续 5 个词以上）
    const hintWords = hintLower.split(/\s+/);
    const userWords = userResponseLower.split(/\s+/);
    
    for (let i = 0; i <= hintWords.length - 5; i++) {
      const phrase = hintWords.slice(i, i + 5).join(' ');
      if (userResponseLower.includes(phrase)) {
        maxSimilarity = Math.max(maxSimilarity, 0.7);
        matchedPhrases.push(phrase);
      }
    }
    
    // 计算词汇重叠率
    const hintWordSet = new Set(hintWords.filter(w => w.length > 3));
    const userWordSet = new Set(userWords.filter(w => w.length > 3));
    const intersection = Array.from(hintWordSet).filter(w => userWordSet.has(w));
    const overlapRatio = intersection.length / Math.max(hintWordSet.size, 1);
    
    if (overlapRatio > 0.6) {
      maxSimilarity = Math.max(maxSimilarity, overlapRatio);
    }
  }
  
  const isCopyPaste = maxSimilarity > 0.5;
  
  let suggestion = '';
  if (isCopyPaste) {
    suggestion = isZh
      ? '看起来你的回答和提示内容很相似。面试官希望听到你自己的经历和想法。试着用你自己的话来表达，并加入你的具体经历。'
      : 'Your answer seems very similar to the hint. Interviewers want to hear YOUR experience and thoughts. Try expressing it in your own words and include your specific experience.';
  }
  
  return {
    isCopyPaste,
    similarity: maxSimilarity,
    matchedPhrases: Array.from(new Set(matchedPhrases)),
    suggestion,
  };
}

/**
 * 生成鼓励用户原创回答的提示
 */
export function getOriginalityReminder(language: 'en' | 'zh'): string {
  const reminders = language === 'zh'
    ? [
        '💡 提示：用你自己的经历来回答，面试官想了解的是你。',
        '💡 记住：这些只是思路提示，你需要用自己的话来表达。',
        '💡 建议：想想你自己的项目经历，用具体的例子来说明。',
        '💡 注意：不要直接使用提示中的内容，面试官能看出来的。',
      ]
    : [
        '💡 Tip: Use your own experience to answer. The interviewer wants to know about YOU.',
        '💡 Remember: These are just thinking prompts. Express them in your own words.',
        '💡 Suggestion: Think about your own project experience and use specific examples.',
        '💡 Note: Don\'t use the hint content directly. Interviewers can tell.',
      ];
  
  return reminders[Math.floor(Math.random() * reminders.length)];
}

/**
 * 格式化增强 Hint 用于显示
 */
export function formatEnhancedHint(hint: EnhancedHintResponse, language: 'en' | 'zh'): string {
  const isZh = language === 'zh';
  const parts: string[] = [];
  
  // 主提示
  parts.push(hint.hint);
  
  // 框架
  if (hint.framework && hint.framework.length > 0) {
    parts.push('');
    parts.push(isZh ? '📋 回答框架：' : '📋 Answer Framework:');
    hint.framework.forEach((f, i) => {
      parts.push(`  ${i + 1}. ${f}`);
    });
  }
  
  // 关键词
  if (hint.keywords && hint.keywords.length > 0) {
    parts.push('');
    parts.push(isZh ? '🔑 关键词：' : '🔑 Keywords:');
    parts.push(`  ${hint.keywords.join(', ')}`);
  }
  
  // 思考问题
  if (hint.thinkingPrompts && hint.thinkingPrompts.length > 0) {
    parts.push('');
    parts.push(isZh ? '🤔 思考一下：' : '🤔 Think about:');
    hint.thinkingPrompts.forEach(p => {
      parts.push(`  • ${p}`);
    });
  }
  
  // 警告
  if (hint.doNotCopyWarning) {
    parts.push('');
    parts.push(isZh 
      ? '⚠️ 请用你自己的话来回答，不要直接复制这些内容。'
      : '⚠️ Please answer in your own words. Do not copy this content directly.');
  }
  
  // 下一级提示
  if (hint.nextLevelAvailable) {
    parts.push('');
    parts.push(isZh
      ? '💬 如果还需要更多帮助，可以再次请求提示。'
      : '💬 If you need more help, you can request another hint.');
  }
  
  return parts.join('\n');
}
