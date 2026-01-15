/**
 * Aggressive Interviewer Module
 * 
 * Implements a more challenging interview style for executive-level candidates:
 * 1. Actively challenges assumptions and claims
 * 2. Demands quantitative evidence for all metrics
 * 3. Explores failure modes and risk scenarios
 * 4. Maintains professional but penetrating tone
 * 5. Ensures comprehensive coverage with minimum duration
 */

import { invokeLLM } from '../_core/llm';

export interface AggressiveInterviewConfig {
  seniorityLevel: 'senior' | 'executive';
  minimumQuestions: number;
  challengeIntensity: 'moderate' | 'high' | 'intense';
  focusAreas: ('quantitative' | 'risk' | 'trade-off' | 'mechanism' | 'scale')[];
}

export interface ChallengeQuestion {
  question: string;
  challengeType: 'quantitative' | 'risk' | 'trade-off' | 'mechanism' | 'scale';
  expectedEvidence: string;
  followUpIfWeak: string;
}

/**
 * Generate a challenging follow-up that demands quantitative evidence
 */
export async function generateQuantitativeChallenge(
  claim: string,
  context: string
): Promise<ChallengeQuestion> {
  const prompt = `You are a highly skeptical executive interviewer. The candidate made this claim:

CLAIM: "${claim}"
CONTEXT: ${context}

Generate a challenging follow-up that DEMANDS quantitative evidence. The question should:
1. NOT accept the claim at face value
2. Require specific numbers, percentages, or metrics
3. Ask about the methodology behind any data
4. Challenge the statistical significance or sample size
5. Use phrases like "What was the exact...", "How did you measure...", "What was the control group..."

Return JSON:
{
  "question": "The challenging question",
  "challengeType": "quantitative",
  "expectedEvidence": "What specific data points would satisfy this challenge",
  "followUpIfWeak": "An even more pointed follow-up if the answer lacks specificity"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'quantitative_challenge',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              challengeType: { type: 'string', enum: ['quantitative'] },
              expectedEvidence: { type: 'string' },
              followUpIfWeak: { type: 'string' },
            },
            required: ['question', 'challengeType', 'expectedEvidence', 'followUpIfWeak'],
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
    console.error('[AggressiveInterviewer] Error generating quantitative challenge:', error);
  }

  return {
    question: `You mentioned "${claim.slice(0, 50)}..." - what were the exact numbers behind that?`,
    challengeType: 'quantitative',
    expectedEvidence: 'Specific metrics with methodology',
    followUpIfWeak: 'Can you walk me through the calculation?',
  };
}

/**
 * Generate a risk-focused challenge
 */
export async function generateRiskChallenge(
  decision: string,
  context: string
): Promise<ChallengeQuestion> {
  const prompt = `You are a highly skeptical executive interviewer. The candidate described this decision:

DECISION: "${decision}"
CONTEXT: ${context}

Generate a challenging question that explores RISKS and FAILURE MODES. The question should:
1. Ask about what could have gone wrong
2. Challenge the risk mitigation strategy
3. Explore worst-case scenarios they considered
4. Ask about contingency plans
5. Use phrases like "What if...", "How would you have handled...", "What was your fallback..."

Return JSON:
{
  "question": "The risk-focused challenge",
  "challengeType": "risk",
  "expectedEvidence": "What risk analysis would satisfy this challenge",
  "followUpIfWeak": "A deeper probe into risk management"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'risk_challenge',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              challengeType: { type: 'string', enum: ['risk'] },
              expectedEvidence: { type: 'string' },
              followUpIfWeak: { type: 'string' },
            },
            required: ['question', 'challengeType', 'expectedEvidence', 'followUpIfWeak'],
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
    console.error('[AggressiveInterviewer] Error generating risk challenge:', error);
  }

  return {
    question: `What was your contingency plan if "${decision.slice(0, 30)}..." had failed?`,
    challengeType: 'risk',
    expectedEvidence: 'Specific risk mitigation strategies',
    followUpIfWeak: 'Did you actually document these risks beforehand?',
  };
}

/**
 * Generate a trade-off challenge
 */
export async function generateTradeOffChallenge(
  approach: string,
  context: string
): Promise<ChallengeQuestion> {
  const prompt = `You are a highly skeptical executive interviewer. The candidate described this approach:

APPROACH: "${approach}"
CONTEXT: ${context}

Generate a challenging question that explores TRADE-OFFS and ALTERNATIVES. The question should:
1. Challenge why they chose this approach over alternatives
2. Ask about what they sacrificed
3. Explore the opportunity cost
4. Question if they considered other options
5. Use phrases like "Why not...", "What did you give up...", "What alternatives did you reject..."

Return JSON:
{
  "question": "The trade-off challenge",
  "challengeType": "trade-off",
  "expectedEvidence": "What trade-off analysis would satisfy this challenge",
  "followUpIfWeak": "A deeper probe into decision-making process"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'tradeoff_challenge',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              challengeType: { type: 'string', enum: ['trade-off'] },
              expectedEvidence: { type: 'string' },
              followUpIfWeak: { type: 'string' },
            },
            required: ['question', 'challengeType', 'expectedEvidence', 'followUpIfWeak'],
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
    console.error('[AggressiveInterviewer] Error generating trade-off challenge:', error);
  }

  return {
    question: `What alternatives did you consider before choosing "${approach.slice(0, 30)}..."?`,
    challengeType: 'trade-off',
    expectedEvidence: 'Comparison of alternatives with rationale',
    followUpIfWeak: 'Why was this the optimal choice given the constraints?',
  };
}

/**
 * Analyze answer for claims that need challenging
 */
export async function extractChallengableClaims(
  answer: string,
  seniorityLevel: 'senior' | 'executive'
): Promise<Array<{ claim: string; type: 'quantitative' | 'risk' | 'trade-off' | 'mechanism' | 'scale' }>> {
  const prompt = `Analyze this interview answer for claims that should be challenged at the ${seniorityLevel} level:

ANSWER: "${answer}"

Identify 2-3 specific claims that:
1. Contain numbers or metrics that need verification
2. Describe decisions that had significant risk
3. Present approaches without discussing alternatives
4. Make assertions about scale or impact
5. Describe mechanisms without implementation details

Return JSON:
{
  "claims": [
    {
      "claim": "The exact claim from the answer",
      "type": "quantitative|risk|trade-off|mechanism|scale"
    }
  ]
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'claims',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              claims: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    claim: { type: 'string' },
                    type: { type: 'string', enum: ['quantitative', 'risk', 'trade-off', 'mechanism', 'scale'] },
                  },
                  required: ['claim', 'type'],
                  additionalProperties: false,
                },
              },
            },
            required: ['claims'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      const data = JSON.parse(content);
      return data.claims;
    }
  } catch (error) {
    console.error('[AggressiveInterviewer] Error extracting claims:', error);
  }

  return [];
}

/**
 * Generate an aggressive follow-up based on the answer
 */
export async function generateAggressiveFollowUp(
  previousQuestion: string,
  previousAnswer: string,
  config: AggressiveInterviewConfig
): Promise<string> {
  // Extract challengeable claims
  const claims = await extractChallengableClaims(previousAnswer, config.seniorityLevel);
  
  if (claims.length === 0) {
    // If no specific claims, generate a general probing question
    return generateGeneralProbe(previousQuestion, previousAnswer, config);
  }
  
  // Select the most important claim to challenge
  const targetClaim = claims[0];
  
  let challenge: ChallengeQuestion;
  switch (targetClaim.type) {
    case 'quantitative':
      challenge = await generateQuantitativeChallenge(targetClaim.claim, previousAnswer);
      break;
    case 'risk':
      challenge = await generateRiskChallenge(targetClaim.claim, previousAnswer);
      break;
    case 'trade-off':
      challenge = await generateTradeOffChallenge(targetClaim.claim, previousAnswer);
      break;
    default:
      challenge = await generateQuantitativeChallenge(targetClaim.claim, previousAnswer);
  }
  
  // Add intensity based on config
  const intensityPrefix = config.challengeIntensity === 'intense' 
    ? "I find that claim interesting, but I need to push back here. "
    : config.challengeIntensity === 'high'
    ? "Let me challenge you on that. "
    : "";
  
  return `${intensityPrefix}${challenge.question}`;
}

/**
 * Generate a general probing question when no specific claims are found
 */
async function generateGeneralProbe(
  previousQuestion: string,
  previousAnswer: string,
  config: AggressiveInterviewConfig
): Promise<string> {
  const prompt = `You are a highly skeptical ${config.seniorityLevel}-level interviewer. The candidate just gave this answer:

QUESTION: "${previousQuestion}"
ANSWER: "${previousAnswer}"

The answer seems to lack substance. Generate a probing follow-up that:
1. Does NOT accept the answer as complete
2. Pushes for more specific details
3. Challenges any vague language
4. Demands concrete examples
5. Maintains a professional but skeptical tone

Use phrases like:
- "I'm not sure I follow the specifics..."
- "Can you be more concrete about..."
- "What exactly do you mean by..."
- "Walk me through the actual steps..."

Return just the question text, no JSON.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[AggressiveInterviewer] Error generating general probe:', error);
  }

  return "I'd like you to be more specific. Can you walk me through the actual implementation details?";
}

/**
 * Generate a comprehensive strategic synthesis question for closing
 */
export async function generateStrategicSynthesis(
  conversationHistory: Array<{ role: string; content: string }>,
  config: AggressiveInterviewConfig
): Promise<string> {
  const topics = conversationHistory
    .filter(m => m.role === 'assistant')
    .map(m => m.content.slice(0, 100))
    .join('\n');

  const prompt = `You are concluding an ${config.seniorityLevel}-level interview. Based on these topics discussed:

${topics}

Generate a final strategic synthesis question that:
1. Ties together multiple themes from the interview
2. Requires the candidate to prioritize and make trade-offs
3. Tests strategic thinking at the highest level
4. Cannot be answered with a rehearsed response
5. Reveals how the candidate thinks about portfolio decisions

Examples of synthesis questions:
- "If you could only pursue one of the initiatives we discussed, which would it be and why?"
- "Looking back at your career, what's the one decision you would make differently knowing what you know now?"
- "How would you prioritize these competing demands if resources were cut by 50%?"

Return just the question text, no JSON.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[AggressiveInterviewer] Error generating synthesis:', error);
  }

  return "If you had to choose just one of the initiatives we discussed to focus on, which would it be and why?";
}

export default {
  generateQuantitativeChallenge,
  generateRiskChallenge,
  generateTradeOffChallenge,
  extractChallengableClaims,
  generateAggressiveFollowUp,
  generateStrategicSynthesis,
};
