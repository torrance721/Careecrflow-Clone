/**
 * SSE (Server-Sent Events) endpoint for interview preparation progress
 * 
 * This endpoint streams real-time progress updates during interview preparation:
 * 1. Parsing user input
 * 2. Searching knowledge base sources
 * 3. Extracting knowledge
 * 4. Generating interview plan
 */

import { Router, Request, Response } from 'express';
import { parseJobInput } from '../utils/jobInputParser';
import { getOrCreateKnowledgeBase, type KnowledgeBaseWithQuestions } from '../agents/knowledgeBaseService';

const router = Router();

// Progress step types
export type ProgressStep = 
  | 'parsing'
  | 'searching_glassdoor'
  | 'searching_leetcode'
  | 'searching_tavily'
  | 'extracting_knowledge'
  | 'generating_plan'
  | 'complete'
  | 'error';

export interface ProgressEvent {
  step: ProgressStep;
  message: string;
  detail?: string;
  progress: number; // 0-100
  data?: Record<string, unknown>;
}

/**
 * Send SSE event to client
 */
function sendEvent(res: Response, event: ProgressEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * SSE endpoint for interview preparation progress
 * GET /api/interview-progress?dreamJob=...
 * 
 * This endpoint uses SSE to stream progress updates while preparing the interview.
 * The actual search and extraction is handled by getOrCreateKnowledgeBase.
 */
router.get('/interview-progress', async (req: Request, res: Response) => {
  const { dreamJob } = req.query;
  
  if (!dreamJob || typeof dreamJob !== 'string') {
    res.status(400).json({ error: 'dreamJob is required' });
    return;
  }
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Handle client disconnect
  req.on('close', () => {
    console.log('[InterviewProgress] Client disconnected');
  });
  
  try {
    // Step 1: Parse user input
    sendEvent(res, {
      step: 'parsing',
      message: 'Analyzing your career goal...',
      detail: `Understanding "${dreamJob}"`,
      progress: 5,
    });
    
    const parsed = await parseJobInput(dreamJob);
    
    sendEvent(res, {
      step: 'parsing',
      message: 'Career goal analyzed',
      detail: parsed.company 
        ? `Target: ${parsed.position} at ${parsed.company}`
        : `Target: ${parsed.position}`,
      progress: 15,
      data: { parsed },
    });
    
    // If no company specified, skip knowledge base search
    if (!parsed.company) {
      sendEvent(res, {
        step: 'complete',
        message: 'Ready to start interview',
        detail: 'Using general interview questions',
        progress: 100,
        data: { 
          parsed,
          knowledgeBase: null,
          useGenericQuestions: true,
        },
      });
      res.end();
      return;
    }
    
    // Step 2-5: Get or create knowledge base
    // Send progress updates while the search is happening
    sendEvent(res, {
      step: 'searching_glassdoor',
      message: 'Searching Glassdoor...',
      detail: `Finding ${parsed.company} interview experiences`,
      progress: 25,
    });
    
    // Start the knowledge base creation (this handles caching internally)
    const kbPromise = getOrCreateKnowledgeBase(parsed.company, parsed.position);
    
    // Send more progress updates while waiting
    setTimeout(() => {
      sendEvent(res, {
        step: 'searching_leetcode',
        message: 'Searching LeetCode...',
        detail: `Finding ${parsed.company} interview discussions`,
        progress: 40,
      });
    }, 2000);
    
    setTimeout(() => {
      sendEvent(res, {
        step: 'searching_tavily',
        message: 'Searching community forums...',
        detail: 'Checking 一亩三分地, Reddit, Blind...',
        progress: 55,
      });
    }, 4000);
    
    setTimeout(() => {
      sendEvent(res, {
        step: 'extracting_knowledge',
        message: 'Extracting interview insights...',
        detail: 'Analyzing interview patterns and questions',
        progress: 75,
      });
    }, 6000);
    
    // Wait for the knowledge base to be ready
    const result = await kbPromise;
    
    sendEvent(res, {
      step: 'generating_plan',
      message: 'Preparing interview plan...',
      detail: 'Customizing questions for your profile',
      progress: 92,
    });
    
    // Complete
    sendEvent(res, {
      step: 'complete',
      message: 'Interview preparation complete!',
      detail: result.cacheHit 
        ? `Found cached data for ${parsed.company}`
        : `Ready with ${parsed.company}-specific questions`,
      progress: 100,
      data: {
        parsed,
        knowledgeBase: result.knowledgeBase,
        fromCache: result.cacheHit,
        questionCount: result.knowledgeBase.questions.length,
      },
    });
    
    res.end();
    
  } catch (error) {
    console.error('[InterviewProgress] Error:', error);
    
    sendEvent(res, {
      step: 'error',
      message: 'Preparation failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
      progress: 0,
      data: { error: String(error) },
    });
    
    res.end();
  }
});

/**
 * Simple polling endpoint for progress (fallback for SSE)
 * POST /api/interview-progress/start
 */
router.post('/interview-progress/start', async (req: Request, res: Response) => {
  const { dreamJob } = req.body;
  
  if (!dreamJob) {
    res.status(400).json({ error: 'dreamJob is required' });
    return;
  }
  
  try {
    // Parse input
    const parsed = await parseJobInput(dreamJob);
    
    // If no company, return immediately
    if (!parsed.company) {
      res.json({
        success: true,
        parsed,
        knowledgeBase: null,
        useGenericQuestions: true,
      });
      return;
    }
    
    // Get or create knowledge base (handles caching internally)
    const result = await getOrCreateKnowledgeBase(parsed.company, parsed.position);
    
    res.json({
      success: true,
      parsed,
      knowledgeBase: result.knowledgeBase,
      fromCache: result.cacheHit,
      questionCount: result.knowledgeBase.questions.length,
    });
    
  } catch (error) {
    console.error('[InterviewProgress] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
