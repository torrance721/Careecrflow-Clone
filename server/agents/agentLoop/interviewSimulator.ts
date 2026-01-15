/**
 * Interview Simulator for Agent Loop
 * 
 * Simulates a complete mock interview using a generated persona.
 * Records all interactions for later analysis.
 */

import { invokeLLM } from '../../_core/llm';
import { MockPersona } from './personaGenerator';
import { generateHint } from '../hintGenerator';
import { generateInterviewResponse } from '../nextQuestionGenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface SimulatedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    questionType?: string;
    responseQuality?: string;
    hintRequested?: boolean;
    hintContent?: string;
  };
}

export interface SimulationResult {
  id: string;
  personaId: string;
  personaName: string;
  targetJob: {
    company: string;
    position: string;
  };
  messages: SimulatedMessage[];
  hintsUsed: number;
  totalQuestions: number;
  completedSuccessfully: boolean;
  duration: number; // in seconds
  createdAt: string;
  iteration: number;
}

const SIMULATIONS_DIR = '/home/ubuntu/UHWeb/data/simulations';

/**
 * Ensure simulations directory exists
 */
function ensureSimulationsDir(): void {
  if (!fs.existsSync(SIMULATIONS_DIR)) {
    fs.mkdirSync(SIMULATIONS_DIR, { recursive: true });
  }
}

/**
 * Save simulation result to disk
 */
export function saveSimulation(simulation: SimulationResult): void {
  ensureSimulationsDir();
  const filePath = path.join(SIMULATIONS_DIR, `${simulation.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(simulation, null, 2));
}

/**
 * Generate a simulated user response based on persona
 */
async function generateUserResponse(
  persona: MockPersona,
  currentQuestion: string,
  conversationHistory: SimulatedMessage[],
  questionNumber: number
): Promise<{ response: string; wantsHint: boolean }> {
  const { personality, interviewBehavior, background, resumeText } = persona;
  
  // Determine response length based on persona
  const lengthGuide = {
    brief: '1-2 sentences',
    medium: '3-4 sentences',
    detailed: '5-7 sentences with specific examples',
  }[interviewBehavior.typicalResponseLength];
  
  // Determine if persona would ask for hint
  const hintProbability = interviewBehavior.getsNervous 
    ? 0.3 
    : (personality.confidenceLevel === 'low' ? 0.2 : 0.05);
  const wantsHint = Math.random() < hintProbability && questionNumber > 1;
  
  const prompt = `You are simulating a job candidate in a mock interview. 

PERSONA:
- Name: ${persona.name}
- Background: ${background.yearsOfExperience} years as ${background.currentRole} at ${background.currentCompany}
- Skills: ${background.skills.join(', ')}
- Communication style: ${personality.communicationStyle}
- Confidence: ${personality.confidenceLevel}
- ${interviewBehavior.getsNervous ? 'Gets nervous in interviews' : 'Stays calm'}
- ${interviewBehavior.usesExamples ? 'Likes to give specific examples' : 'Tends to speak generally'}

RESUME CONTEXT:
${resumeText}

CURRENT SITUATION:
${persona.situation}

INTERVIEW QUESTION:
"${currentQuestion}"

Generate a realistic response that:
1. Matches the persona's communication style (${personality.communicationStyle})
2. Is ${lengthGuide}
3. ${interviewBehavior.usesExamples ? 'Includes a specific example from their experience' : 'Stays somewhat general'}
4. ${personality.confidenceLevel === 'low' ? 'Shows some hesitation or uncertainty' : 'Is confident'}
5. ${interviewBehavior.asksForClarification && Math.random() > 0.7 ? 'Asks for clarification if the question is complex' : 'Answers directly'}

Respond ONLY with the candidate's answer, no quotes or prefixes.`;

  try {
    const response = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (content && typeof content === 'string') {
      return { response: content, wantsHint };
    }
  } catch (error) {
    console.error('[InterviewSimulator] Error generating user response:', error);
  }

  return { 
    response: 'I have experience in that area. Could you be more specific about what you\'d like to know?',
    wantsHint: false,
  };
}

/**
 * Simulate a complete mock interview
 */
export async function simulateInterview(
  persona: MockPersona,
  iteration: number,
  totalQuestions: number = 6
): Promise<SimulationResult> {
  const startTime = Date.now();
  const messages: SimulatedMessage[] = [];
  let hintsUsed = 0;
  let completedSuccessfully = true;
  
  const { targetJob, resumeText, situation } = persona;
  
  // System message
  const systemMessage: SimulatedMessage = {
    role: 'system',
    content: `Mock interview for ${targetJob.position} at ${targetJob.company}. Resume: ${resumeText.slice(0, 200)}... Situation: ${situation}`,
    timestamp: new Date().toISOString(),
  };
  messages.push(systemMessage);
  
  // Generate first question
  const firstQuestionPrompt = `You are starting a mock interview for a ${targetJob.position} position at ${targetJob.company}.

Candidate background: ${persona.background.yearsOfExperience} years as ${persona.background.currentRole}

Generate a friendly opening and first interview question. Be warm and professional.`;

  try {
    const firstResponse = await invokeLLM({
      messages: [{ role: 'user', content: firstQuestionPrompt }],
    });
    
    const firstQuestion = firstResponse.choices[0]?.message?.content;
    if (firstQuestion && typeof firstQuestion === 'string') {
      messages.push({
        role: 'assistant',
        content: firstQuestion,
        timestamp: new Date().toISOString(),
        metadata: { questionType: 'opening' },
      });
    }
  } catch (error) {
    console.error('[InterviewSimulator] Error generating first question:', error);
    completedSuccessfully = false;
  }
  
  // Simulate Q&A rounds
  for (let q = 1; q <= totalQuestions && completedSuccessfully; q++) {
    const lastAssistantMsg = messages.filter(m => m.role === 'assistant').slice(-1)[0];
    if (!lastAssistantMsg) break;
    
    // Generate user response
    const { response: userResponse, wantsHint } = await generateUserResponse(
      persona,
      lastAssistantMsg.content,
      messages,
      q
    );
    
    // Maybe request hint first
    if (wantsHint && hintsUsed < 3) {
      try {
        const hint = await generateHint({
          question: lastAssistantMsg.content,
          userResponse: '',
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          language: 'en',
        });
        
        hintsUsed++;
        messages.push({
          role: 'user',
          content: '[Requested hint]',
          timestamp: new Date().toISOString(),
          metadata: {
            hintRequested: true,
            hintContent: hint.hint,
          },
        });
      } catch (error) {
        console.error('[InterviewSimulator] Error getting hint:', error);
      }
    }
    
    // Add user response
    messages.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date().toISOString(),
      metadata: {
        responseQuality: userResponse.length < 100 ? 'brief' : (userResponse.length < 300 ? 'medium' : 'detailed'),
      },
    });
    
    // Generate next question (unless it's the last one)
    if (q < totalQuestions) {
      try {
        const aiResponse = await generateInterviewResponse({
          job: {
            company: targetJob.company,
            position: targetJob.position,
            description: `${targetJob.position} role at ${targetJob.company}`,
          },
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
          currentQuestion: q,
          totalQuestions,
          language: 'en',
          userResponse,
        });
        
        messages.push({
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date().toISOString(),
          metadata: { questionType: q === totalQuestions - 1 ? 'closing' : 'follow_up' },
        });
      } catch (error) {
        console.error('[InterviewSimulator] Error generating AI response:', error);
        completedSuccessfully = false;
      }
    } else {
      // Final closing message
      messages.push({
        role: 'assistant',
        content: `Thank you so much for sharing your experiences today! I've really enjoyed learning about your background and the impressive work you've done. I'll now generate a detailed assessment report based on our conversation. Is there anything else you'd like to add before we wrap up?`,
        timestamp: new Date().toISOString(),
        metadata: { questionType: 'closing' },
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  const simulation: SimulationResult = {
    id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    personaId: persona.id,
    personaName: persona.name,
    targetJob,
    messages,
    hintsUsed,
    totalQuestions,
    completedSuccessfully,
    duration,
    createdAt: new Date().toISOString(),
    iteration,
  };
  
  // Save simulation
  saveSimulation(simulation);
  
  return simulation;
}

/**
 * Load simulation results from disk
 */
export function loadSimulations(iteration?: number): SimulationResult[] {
  ensureSimulationsDir();
  const simulations: SimulationResult[] = [];
  
  try {
    const files = fs.readdirSync(SIMULATIONS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = fs.readFileSync(path.join(SIMULATIONS_DIR, file), 'utf-8');
        const sim = JSON.parse(content);
        if (iteration === undefined || sim.iteration === iteration) {
          simulations.push(sim);
        }
      }
    }
  } catch (error) {
    console.error('[InterviewSimulator] Error loading simulations:', error);
  }
  
  return simulations;
}
