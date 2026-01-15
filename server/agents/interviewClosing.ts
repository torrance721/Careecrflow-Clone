/**
 * Interview Closing Module
 * 
 * Provides a professional and comprehensive interview closing experience:
 * 1. Summarizes topics covered
 * 2. Highlights candidate strengths observed
 * 3. Provides next steps information
 * 4. Allows candidate to ask questions
 */

import { invokeLLM } from '../_core/llm';

export interface InterviewSummary {
  topicsCovered: string[];
  strengthsObserved: string[];
  areasToExplore: string[];
  overallImpression: string;
  closingMessage: string;
}

export interface ClosingSequence {
  summary: InterviewSummary;
  candidateQuestionsPrompt: string;
  finalMessage: string;
  duration: number; // Expected duration in seconds
}

/**
 * Generate a comprehensive interview summary
 */
export async function generateInterviewSummary(
  conversationHistory: Array<{ role: string; content: string }>,
  position: string,
  company: string
): Promise<InterviewSummary> {
  const conversation = conversationHistory
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const prompt = `Analyze this interview conversation and generate a professional summary.

POSITION: ${position}
COMPANY: ${company}

CONVERSATION:
${conversation}

Generate a summary that:
1. Lists the main topics/competencies covered
2. Identifies specific strengths the candidate demonstrated
3. Notes areas that could be explored further (without being critical)
4. Provides an overall impression (professional and balanced)
5. Creates a warm but professional closing message

Return JSON:
{
  "topicsCovered": ["Topic 1", "Topic 2", ...],
  "strengthsObserved": ["Strength 1", "Strength 2", ...],
  "areasToExplore": ["Area 1", "Area 2", ...],
  "overallImpression": "A balanced, professional assessment",
  "closingMessage": "A warm, professional closing statement"
}`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'interview_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              topicsCovered: { type: 'array', items: { type: 'string' } },
              strengthsObserved: { type: 'array', items: { type: 'string' } },
              areasToExplore: { type: 'array', items: { type: 'string' } },
              overallImpression: { type: 'string' },
              closingMessage: { type: 'string' },
            },
            required: ['topicsCovered', 'strengthsObserved', 'areasToExplore', 'overallImpression', 'closingMessage'],
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
    console.error('[InterviewClosing] Error generating summary:', error);
  }

  return {
    topicsCovered: ['Technical skills', 'Problem-solving', 'Communication'],
    strengthsObserved: ['Clear communication', 'Structured thinking'],
    areasToExplore: ['Additional technical depth'],
    overallImpression: 'The candidate demonstrated relevant experience for the role.',
    closingMessage: 'Thank you for taking the time to speak with us today.',
  };
}

/**
 * Generate the complete closing sequence
 */
export async function generateClosingSequence(
  conversationHistory: Array<{ role: string; content: string }>,
  position: string,
  company: string,
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'executive'
): Promise<ClosingSequence> {
  const summary = await generateInterviewSummary(conversationHistory, position, company);
  
  // Generate appropriate candidate questions prompt based on seniority
  let candidateQuestionsPrompt: string;
  switch (seniorityLevel) {
    case 'executive':
      candidateQuestionsPrompt = `Before we wrap up, I'd like to give you the opportunity to ask any questions about the strategic direction, leadership team, or any aspects of the role that we haven't covered. What would you like to know?`;
      break;
    case 'senior':
      candidateQuestionsPrompt = `We've covered a lot of ground today. Before we conclude, do you have any questions about the team structure, technical challenges, or growth opportunities in this role?`;
      break;
    case 'mid':
      candidateQuestionsPrompt = `Thank you for your thoughtful responses. Do you have any questions about the role, the team, or what a typical day might look like?`;
      break;
    default:
      candidateQuestionsPrompt = `I appreciate you sharing your experiences with me. Do you have any questions about the position or the company that I can help answer?`;
  }
  
  // Generate final message
  const finalMessage = generateFinalMessage(summary, position, company, seniorityLevel);
  
  // Estimate duration based on seniority
  const duration = seniorityLevel === 'executive' ? 60 : 
                   seniorityLevel === 'senior' ? 45 : 30;
  
  return {
    summary,
    candidateQuestionsPrompt,
    finalMessage,
    duration,
  };
}

/**
 * Generate the final closing message
 */
function generateFinalMessage(
  summary: InterviewSummary,
  position: string,
  company: string,
  seniorityLevel: 'junior' | 'mid' | 'senior' | 'executive'
): string {
  const topicsCount = summary.topicsCovered.length;
  const strengthsHighlight = summary.strengthsObserved.slice(0, 2).join(' and ');
  
  const baseMessage = `Thank you for this engaging conversation. We covered ${topicsCount} key areas today, and I was particularly impressed by your ${strengthsHighlight}.`;
  
  let nextSteps: string;
  switch (seniorityLevel) {
    case 'executive':
      nextSteps = `Our team will be in touch within the next few days to discuss next steps. Given the strategic nature of this role, we may want to schedule follow-up conversations with other members of the leadership team.`;
      break;
    case 'senior':
      nextSteps = `You'll hear from our recruiting team within the next week regarding next steps. If we move forward, the next stage typically involves meeting with additional team members.`;
      break;
    default:
      nextSteps = `Our recruiting team will be in touch soon with next steps. Thank you again for your time today.`;
  }
  
  return `${baseMessage}\n\n${nextSteps}\n\n${summary.closingMessage}`;
}

/**
 * Format the summary for display in the UI
 */
export function formatSummaryForDisplay(summary: InterviewSummary): string {
  return `
📋 **Interview Summary**

**Topics Covered:**
${summary.topicsCovered.map(t => `• ${t}`).join('\n')}

**Strengths Observed:**
${summary.strengthsObserved.map(s => `✓ ${s}`).join('\n')}

**Areas for Further Discussion:**
${summary.areasToExplore.map(a => `→ ${a}`).join('\n')}

**Overall Impression:**
${summary.overallImpression}
`.trim();
}

/**
 * Generate a transition to closing
 */
export async function generateClosingTransition(
  lastQuestion: string,
  lastAnswer: string,
  questionsAsked: number
): Promise<string> {
  const prompt = `Generate a natural transition from the interview questions to the closing phase.

LAST QUESTION: "${lastQuestion}"
LAST ANSWER: "${lastAnswer}"
TOTAL QUESTIONS ASKED: ${questionsAsked}

Generate a transition that:
1. Acknowledges the candidate's final answer positively but specifically
2. Signals that we're moving to the closing phase
3. Feels natural and not abrupt
4. Maintains professional warmth

Do NOT use generic phrases like "Great answer" or "Thank you for that."
Reference something specific from their answer.

Return just the transition text, no JSON.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return content;
    }
  } catch (error) {
    console.error('[InterviewClosing] Error generating transition:', error);
  }

  return `That's a thoughtful perspective on the challenge. We've covered a lot of ground in our conversation today, and I'd like to take a moment to wrap up.`;
}

export default {
  generateInterviewSummary,
  generateClosingSequence,
  formatSummaryForDisplay,
  generateClosingTransition,
};
