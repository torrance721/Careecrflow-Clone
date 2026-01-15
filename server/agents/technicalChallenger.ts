/**
 * Technical Challenger Module
 * 
 * 根据高挑剔度用户反馈实现：
 * 1. 技术挑战机制 - 要求候选人证明具体声明（复杂度、内存开销、权衡）
 * 2. 调整对话节奏 - 让候选人完整回答后再总结
 * 3. 减少过度赞美 - 使用更自然的过渡语言
 */

import { invokeLLM } from '../_core/llm';

export interface TechnicalClaim {
  type: 'complexity' | 'memory' | 'tradeoff' | 'scale' | 'performance';
  claim: string;
  context: string;
}

export interface TechnicalChallenge {
  challengeType: 'justify' | 'quantify' | 'compare' | 'edge_case' | 'failure_mode';
  question: string;
  expectedDepth: 'surface' | 'moderate' | 'deep';
  followUpIfWeak?: string;
}

export interface ConversationPacing {
  allowFullResponse: boolean;
  minResponseTime: number; // seconds to wait before responding
  transitionStyle: 'direct' | 'acknowledging' | 'challenging';
  avoidPhrases: string[];
}

/**
 * 从候选人回答中提取技术声明
 */
export async function extractTechnicalClaims(
  answer: string,
  questionContext: string
): Promise<TechnicalClaim[]> {
  const prompt = `Analyze this interview answer and extract any technical claims that should be challenged or verified.

Question Context: ${questionContext}

Candidate's Answer:
${answer}

Extract claims about:
1. Time/Space Complexity (e.g., "O(n log n)", "constant time")
2. Memory Usage (e.g., "low memory footprint", "fits in cache")
3. Trade-offs (e.g., "faster but uses more memory")
4. Scale (e.g., "handles millions of requests", "scales horizontally")
5. Performance (e.g., "sub-millisecond latency", "99.9% uptime")

Return as JSON array:
[
  {
    "type": "complexity|memory|tradeoff|scale|performance",
    "claim": "the specific claim made",
    "context": "surrounding context from the answer"
  }
]

If no technical claims found, return empty array [].`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'technical_claims',
          strict: true,
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['complexity', 'memory', 'tradeoff', 'scale', 'performance'] },
                claim: { type: 'string' },
                context: { type: 'string' },
              },
              required: ['type', 'claim', 'context'],
              additionalProperties: false,
            },
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[TechnicalChallenger] Error extracting claims:', error);
  }

  return [];
}

/**
 * 生成技术挑战问题
 */
export async function generateTechnicalChallenge(
  claim: TechnicalClaim,
  candidateLevel: 'junior' | 'mid' | 'senior',
  previousChallenges: string[] = []
): Promise<TechnicalChallenge> {
  const depthMap = {
    junior: 'surface',
    mid: 'moderate',
    senior: 'deep',
  };

  const prompt = `Generate a technical challenge question to verify this claim from a ${candidateLevel} level candidate.

Claim Type: ${claim.type}
Claim: "${claim.claim}"
Context: "${claim.context}"

Previous challenges asked (avoid repetition):
${previousChallenges.join('\n') || 'None'}

Generate a challenge that:
1. Requires the candidate to JUSTIFY or QUANTIFY their claim
2. Is appropriate for ${candidateLevel} level (not too easy, not too hard)
3. Sounds natural in a conversation (not interrogative)
4. Has a follow-up ready if the answer is weak

Challenge types:
- justify: Ask them to explain WHY this is true
- quantify: Ask for specific numbers or benchmarks
- compare: Ask how it compares to alternatives
- edge_case: Ask about edge cases or failure scenarios
- failure_mode: Ask what happens when assumptions break

Return as JSON:
{
  "challengeType": "justify|quantify|compare|edge_case|failure_mode",
  "question": "the challenge question",
  "expectedDepth": "${depthMap[candidateLevel]}",
  "followUpIfWeak": "follow-up if answer is insufficient"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'technical_challenge',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              challengeType: { type: 'string', enum: ['justify', 'quantify', 'compare', 'edge_case', 'failure_mode'] },
              question: { type: 'string' },
              expectedDepth: { type: 'string', enum: ['surface', 'moderate', 'deep'] },
              followUpIfWeak: { type: 'string' },
            },
            required: ['challengeType', 'question', 'expectedDepth', 'followUpIfWeak'],
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
    console.error('[TechnicalChallenger] Error generating challenge:', error);
  }

  // Default challenge
  return {
    challengeType: 'justify',
    question: `Can you walk me through the reasoning behind that?`,
    expectedDepth: depthMap[candidateLevel] as 'surface' | 'moderate' | 'deep',
    followUpIfWeak: `What would happen if that assumption doesn't hold?`,
  };
}

/**
 * 获取自然的对话过渡语言（避免过度赞美）
 */
export function getNaturalTransition(
  transitionType: 'acknowledge' | 'pivot' | 'challenge' | 'conclude',
  criticalness: number
): string {
  // 高挑剔度用户不喜欢过度赞美，使用更直接的语言
  const directTransitions = {
    acknowledge: [
      "Okay, I see.",
      "Got it.",
      "I understand.",
      "Right.",
      "Alright.",
    ],
    pivot: [
      "Let's look at another aspect.",
      "Moving on to implementation details.",
      "Now, about the specifics.",
      "Let's dig into that.",
      "Shifting focus a bit.",
    ],
    challenge: [
      "Can you elaborate on that?",
      "Walk me through the reasoning.",
      "What makes you say that?",
      "How would you verify that?",
      "What's the basis for that claim?",
    ],
    conclude: [
      "Alright, let's wrap up this section.",
      "Good, let's move to the next topic.",
      "Okay, I think I have a good picture.",
      "Let's transition to something else.",
      "That covers this area well.",
    ],
  };

  const warmTransitions = {
    acknowledge: [
      "That's a good point.",
      "I appreciate that perspective.",
      "That makes sense.",
      "Interesting approach.",
      "I like that thinking.",
    ],
    pivot: [
      "Great, let's explore another angle.",
      "Building on that, let's look at...",
      "That's helpful. Now, how about...",
      "Good foundation. Let's discuss...",
      "Nice. Now I'm curious about...",
    ],
    challenge: [
      "That's interesting. Can you tell me more about why?",
      "I'd love to understand the reasoning there.",
      "Help me understand that better.",
      "That's a bold claim - what supports it?",
      "Interesting. How did you arrive at that?",
    ],
    conclude: [
      "Excellent discussion on this topic.",
      "That was really helpful.",
      "Great, I feel I understand your approach.",
      "Thanks for walking me through that.",
      "That gives me a clear picture.",
    ],
  };

  // 挑剔度 7+ 使用更直接的语言
  const transitions = criticalness >= 7 ? directTransitions : warmTransitions;
  const options = transitions[transitionType];
  
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * 获取对话节奏配置
 */
export function getConversationPacing(criticalness: number): ConversationPacing {
  // 高挑剔度用户希望有更多时间完整回答
  if (criticalness >= 8) {
    return {
      allowFullResponse: true,
      minResponseTime: 3, // 等待至少 3 秒再回应
      transitionStyle: 'direct',
      avoidPhrases: [
        "That's excellent",
        "That's a very insightful analysis",
        "That's absolutely right",
        "Perfect",
        "Brilliant",
        "That's exactly what I was looking for",
      ],
    };
  } else if (criticalness >= 6) {
    return {
      allowFullResponse: true,
      minResponseTime: 2,
      transitionStyle: 'acknowledging',
      avoidPhrases: [
        "That's absolutely perfect",
        "Brilliant",
      ],
    };
  } else {
    return {
      allowFullResponse: true,
      minResponseTime: 1,
      transitionStyle: 'acknowledging',
      avoidPhrases: [],
    };
  }
}

/**
 * 生成不打断的后续问题
 */
export async function generateNonInterruptingFollowUp(
  previousAnswer: string,
  previousQuestion: string,
  claims: TechnicalClaim[],
  criticalness: number
): Promise<string> {
  const pacing = getConversationPacing(criticalness);
  const transition = getNaturalTransition('acknowledge', criticalness);
  
  // 如果有技术声明需要挑战
  if (claims.length > 0) {
    const challenge = await generateTechnicalChallenge(
      claims[0],
      criticalness >= 7 ? 'senior' : criticalness >= 5 ? 'mid' : 'junior'
    );
    
    return `${transition} ${challenge.question}`;
  }
  
  // 否则使用自然过渡
  const pivotTransition = getNaturalTransition('pivot', criticalness);
  
  const prompt = `Generate a natural follow-up question that:
1. Acknowledges the previous answer without excessive praise
2. Digs deeper into an aspect mentioned
3. Sounds conversational, not interrogative

Previous Question: ${previousQuestion}
Previous Answer: ${previousAnswer}

Transition style: ${pacing.transitionStyle}
Avoid phrases: ${pacing.avoidPhrases.join(', ')}

Return just the follow-up question (1-2 sentences).`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return `${pivotTransition} ${content.trim()}`;
    }
  } catch (error) {
    console.error('[TechnicalChallenger] Error generating follow-up:', error);
  }

  return `${pivotTransition} Can you tell me more about the implementation details?`;
}
