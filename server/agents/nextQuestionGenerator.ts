/**
 * Next Question Generator Agent
 * 
 * Generates the next interview question based on:
 * 1. Conversation history and user's previous answers
 * 2. Knowledge base data (interview questions, company info)
 * 3. Interview progress and coverage of topics
 * 4. User's apparent strengths and areas to explore
 */

import { invokeLLM } from '../_core/llm';
import { getKnowledgeBaseById, KnowledgeBaseWithQuestions } from './knowledgeBaseService';

export interface NextQuestionContext {
  job: {
    company: string;
    position: string;
    description: string;
  };
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  currentQuestion: number;
  totalQuestions: number;
  knowledgeBaseId?: number;
  language: 'en' | 'zh';
  userResponse: string;  // The latest user response
}

export interface NextQuestionDecision {
  questionType: 'follow_up' | 'new_topic' | 'deep_dive' | 'closing';
  question: string;
  reasoning: string;
  topicsCovered: string[];
  suggestedNextTopics: string[];
}

/**
 * Analyze user response quality to decide next action
 */
async function analyzeUserResponse(
  userResponse: string,
  currentQuestion: string,
  language: 'en' | 'zh'
): Promise<{
  quality: 'brief' | 'adequate' | 'comprehensive';
  hasSpecificExamples: boolean;
  needsFollowUp: boolean;
  followUpReason?: string;
}> {
  const isZh = language === 'zh';
  
  const prompt = isZh
    ? `分析以下面试回答的质量：

问题：${currentQuestion}
回答：${userResponse}

返回 JSON：
{
  "quality": "brief|adequate|comprehensive",
  "hasSpecificExamples": true/false,
  "needsFollowUp": true/false,
  "followUpReason": "如果需要追问，说明原因"
}

评判标准：
- brief: 回答少于50字或缺乏具体细节
- adequate: 有一定细节但可以更深入
- comprehensive: 详细且有具体例子`
    : `Analyze the quality of this interview response:

Question: ${currentQuestion}
Response: ${userResponse}

Return JSON:
{
  "quality": "brief|adequate|comprehensive",
  "hasSpecificExamples": true/false,
  "needsFollowUp": true/false,
  "followUpReason": "If follow-up needed, explain why"
}

Criteria:
- brief: Less than 50 words or lacks specific details
- adequate: Has some details but could go deeper
- comprehensive: Detailed with specific examples`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response_analysis',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              quality: { type: 'string', enum: ['brief', 'adequate', 'comprehensive'] },
              hasSpecificExamples: { type: 'boolean' },
              needsFollowUp: { type: 'boolean' },
              followUpReason: { type: 'string' },
            },
            required: ['quality', 'hasSpecificExamples', 'needsFollowUp', 'followUpReason'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[NextQuestionGenerator] Error analyzing response:', error);
  }

  // Default fallback
  return {
    quality: userResponse.length < 100 ? 'brief' : 'adequate',
    hasSpecificExamples: false,
    needsFollowUp: userResponse.length < 100,
    followUpReason: 'Response could use more detail',
  };
}

/**
 * Get relevant questions from knowledge base
 */
function getRelevantKBQuestions(
  kb: KnowledgeBaseWithQuestions,
  topicsCovered: string[]
): string[] {
  const coveredLower = topicsCovered.map(t => t.toLowerCase());
  
  // Filter out questions on topics already covered
  const relevantQuestions = kb.questions
    .filter(q => {
      const questionLower = q.question.toLowerCase();
      const categoryLower = (q.category || '').toLowerCase();
      
      // Check if this topic is already covered
      const isCovered = coveredLower.some(topic => 
        questionLower.includes(topic) || categoryLower.includes(topic)
      );
      
      return !isCovered;
    })
    .slice(0, 5)
    .map(q => q.question);

  return relevantQuestions;
}

/**
 * Generate the next interview question
 */
export async function generateNextQuestion(
  context: NextQuestionContext
): Promise<NextQuestionDecision> {
  const { job, conversationHistory, currentQuestion, totalQuestions, knowledgeBaseId, language, userResponse } = context;
  const isZh = language === 'zh';
  
  // Get the last assistant message (current question)
  const lastAssistantMsg = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-1)[0]?.content || '';
  
  // Analyze user's response
  const responseAnalysis = await analyzeUserResponse(userResponse, lastAssistantMsg, language);
  
  // Get knowledge base context
  let kbContext = '';
  let kbQuestions: string[] = [];
  
  if (knowledgeBaseId) {
    try {
      const kb = await getKnowledgeBaseById(knowledgeBaseId);
      if (kb) {
        // Extract topics already covered from conversation
        const topicsCovered = extractTopicsCovered(conversationHistory);
        kbQuestions = getRelevantKBQuestions(kb, topicsCovered);
        
        if (kbQuestions.length > 0) {
          kbContext = isZh
            ? `\n\n来自知识库的相关面试问题（可参考）：\n${kbQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
            : `\n\nRelevant interview questions from knowledge base (for reference):\n${kbQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
        }
        
        // Add interview tips
        if (kb.tips && kb.tips.length > 0) {
          const tip = kb.tips[Math.floor(Math.random() * kb.tips.length)];
          kbContext += isZh
            ? `\n\n面试技巧：${tip.tip}`
            : `\n\nInterview tip: ${tip.tip}`;
        }
      }
    } catch (error) {
      console.error('[NextQuestionGenerator] Error getting knowledge base:', error);
    }
  }
  
  // Build conversation summary
  const conversationSummary = conversationHistory
    .filter(m => m.role !== 'system')
    .slice(-6)  // Last 3 exchanges
    .map(m => `${m.role === 'user' ? (isZh ? '候选人' : 'Candidate') : (isZh ? '面试官' : 'Interviewer')}: ${m.content.slice(0, 200)}...`)
    .join('\n');
  
  // Determine question type based on analysis
  let questionTypeHint = '';
  if (responseAnalysis.needsFollowUp && responseAnalysis.quality === 'brief') {
    questionTypeHint = isZh
      ? '用户的回答比较简短，建议追问以获取更多细节。'
      : 'User response was brief. Consider asking a follow-up for more details.';
  } else if (currentQuestion >= totalQuestions - 1) {
    questionTypeHint = isZh
      ? '这是最后一个问题，可以是总结性的问题。'
      : 'This is the final question. Consider a closing/summary question.';
  }
  
  const systemPrompt = isZh
    ? `你是一位专业的面试官，正在为 ${job.position} @ ${job.company} 进行模拟面试。

职位描述：${job.description}

当前进度：第 ${currentQuestion} 个问题，共 ${totalQuestions} 个

最近对话：
${conversationSummary}

用户最新回答分析：
- 回答质量：${responseAnalysis.quality}
- 是否有具体例子：${responseAnalysis.hasSpecificExamples ? '是' : '否'}
- 是否需要追问：${responseAnalysis.needsFollowUp ? '是' : '否'}
${responseAnalysis.followUpReason ? `- 追问原因：${responseAnalysis.followUpReason}` : ''}

${questionTypeHint}
${kbContext}

请决定下一步行动并生成问题。返回 JSON：
{
  "questionType": "follow_up|new_topic|deep_dive|closing",
  "question": "你的下一个问题",
  "reasoning": "为什么选择这个问题",
  "topicsCovered": ["已覆盖的话题列表"],
  "suggestedNextTopics": ["建议接下来探索的话题"]
}

问题类型说明：
- follow_up: 追问当前话题的更多细节
- new_topic: 转到新的面试话题
- deep_dive: 深入探讨用户提到的某个点
- closing: 结束性问题（总结或最后机会提问）`
    : `You are a professional interviewer conducting a mock interview for ${job.position} at ${job.company}.

Job Description: ${job.description}

Current Progress: Question ${currentQuestion} of ${totalQuestions}

Recent Conversation:
${conversationSummary}

User's Latest Response Analysis:
- Response Quality: ${responseAnalysis.quality}
- Has Specific Examples: ${responseAnalysis.hasSpecificExamples ? 'Yes' : 'No'}
- Needs Follow-up: ${responseAnalysis.needsFollowUp ? 'Yes' : 'No'}
${responseAnalysis.followUpReason ? `- Follow-up Reason: ${responseAnalysis.followUpReason}` : ''}

${questionTypeHint}
${kbContext}

Decide on the next action and generate a question. Return JSON:
{
  "questionType": "follow_up|new_topic|deep_dive|closing",
  "question": "Your next question",
  "reasoning": "Why you chose this question",
  "topicsCovered": ["List of topics already covered"],
  "suggestedNextTopics": ["Topics to explore next"]
}

Question types:
- follow_up: Ask for more details on current topic
- new_topic: Move to a new interview topic
- deep_dive: Explore something the user mentioned in depth
- closing: Final question (summary or last chance to share)`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isZh ? '请生成下一个问题' : 'Please generate the next question' },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'next_question_decision',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              questionType: { 
                type: 'string', 
                enum: ['follow_up', 'new_topic', 'deep_dive', 'closing'] 
              },
              question: { type: 'string' },
              reasoning: { type: 'string' },
              topicsCovered: { 
                type: 'array', 
                items: { type: 'string' } 
              },
              suggestedNextTopics: { 
                type: 'array', 
                items: { type: 'string' } 
              },
            },
            required: ['questionType', 'question', 'reasoning', 'topicsCovered', 'suggestedNextTopics'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[NextQuestionGenerator] Error generating question:', error);
  }

  // Fallback
  return {
    questionType: 'new_topic',
    question: isZh 
      ? '能告诉我一个你解决过的具有挑战性的技术问题吗？'
      : 'Can you tell me about a challenging technical problem you\'ve solved?',
    reasoning: 'Fallback question',
    topicsCovered: [],
    suggestedNextTopics: ['technical skills', 'problem solving'],
  };
}

/**
 * Extract topics covered from conversation history
 */
function extractTopicsCovered(
  conversationHistory: Array<{ role: string; content: string }>
): string[] {
  const topics: Set<string> = new Set();
  
  // Common interview topics to detect
  const topicKeywords = {
    'technical': ['code', 'programming', 'algorithm', 'system design', '代码', '编程', '算法', '系统设计'],
    'project': ['project', 'built', 'developed', 'implemented', '项目', '开发', '实现'],
    'teamwork': ['team', 'collaboration', 'worked with', '团队', '协作', '合作'],
    'leadership': ['led', 'managed', 'mentored', '领导', '管理', '指导'],
    'problem-solving': ['challenge', 'problem', 'solved', 'fixed', '挑战', '问题', '解决'],
    'communication': ['presented', 'explained', 'communicated', '演示', '解释', '沟通'],
  };
  
  for (const msg of conversationHistory) {
    const contentLower = msg.content.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => contentLower.includes(kw))) {
        topics.add(topic);
      }
    }
  }
  
  return Array.from(topics);
}

/**
 * Generate a complete AI response with the next question
 */
export async function generateInterviewResponse(
  context: NextQuestionContext
): Promise<string> {
  const { language } = context;
  const isZh = language === 'zh';
  
  // Get the next question decision
  const decision = await generateNextQuestion(context);
  
  // Generate a natural response that includes the question
  const responsePrompt = isZh
    ? `基于以下信息，生成一个自然的面试官回复：

问题类型：${decision.questionType}
下一个问题：${decision.question}
原因：${decision.reasoning}

要求：
1. 先对用户的回答做简短的回应（认可或追问原因）
2. 然后自然地过渡到下一个问题
3. 保持友好和专业的语气
4. 回复长度控制在 2-3 句话

直接输出回复内容，不要加任何前缀。`
    : `Based on the following information, generate a natural interviewer response:

Question Type: ${decision.questionType}
Next Question: ${decision.question}
Reasoning: ${decision.reasoning}

Requirements:
1. First briefly respond to the user's answer (acknowledge or explain why you're following up)
2. Then naturally transition to the next question
3. Maintain a friendly and professional tone
4. Keep the response to 2-3 sentences

Output the response directly without any prefix.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: responsePrompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[NextQuestionGenerator] Error generating response:', error);
  }

  // Fallback: just return the question
  return decision.question;
}
