/**
 * Knowledge Base Service
 * 
 * This service manages the interview knowledge base, including:
 * - Caching with 30-day expiration
 * - Database operations for knowledge storage and retrieval
 * - Orchestration of search and extraction agents
 */

import { getDb } from '../db';
import { 
  interviewKnowledgeBases, 
  interviewQuestions,
  knowledgeBaseSearchLogs,
  type InterviewKnowledgeBase,
  type InterviewQuestion,
} from '../../drizzle/schema';
import { eq, and, gt } from 'drizzle-orm';
import { SearchAgent, normalizeCompanyName, normalizePositionName } from './searchAgent';
import { KnowledgeExtractionAgent, type StructuredKnowledge } from './knowledgeExtractionAgent';

// Cache expiration in days
const CACHE_EXPIRATION_DAYS = 30;

// Types
export interface KnowledgeBaseWithQuestions extends InterviewKnowledgeBase {
  questions: InterviewQuestion[];
}

export interface GetKnowledgeBaseOptions {
  forceRefresh?: boolean;
  userId?: number;
  language?: 'en' | 'zh';
}

export interface KnowledgeBaseResult {
  knowledgeBase: KnowledgeBaseWithQuestions;
  cacheHit: boolean;
  searchDuration?: number;
}

/**
 * Get or create a knowledge base for a company/position combination
 */
export async function getOrCreateKnowledgeBase(
  company: string,
  position: string,
  options: GetKnowledgeBaseOptions = {}
): Promise<KnowledgeBaseResult> {
  const startTime = Date.now();
  const companyNormalized = normalizeCompanyName(company);
  const positionNormalized = normalizePositionName(position);
  
  console.log(`[KnowledgeBaseService] Getting knowledge base for ${company} - ${position}`);
  
  // Check for existing valid cache
  if (!options.forceRefresh) {
    const cached = await getCachedKnowledgeBase(companyNormalized, positionNormalized);
    if (cached) {
      console.log(`[KnowledgeBaseService] Cache hit for ${company} - ${position}`);
      
      // Log the search
      await logSearch({
        userId: options.userId,
        company,
        position,
        knowledgeBaseId: cached.id,
        cacheHit: true,
        searchDuration: Date.now() - startTime,
        sourcesSearched: [],
        resultsCount: cached.questions.length,
      });
      
      return {
        knowledgeBase: cached,
        cacheHit: true,
        searchDuration: Date.now() - startTime,
      };
    }
  }
  
  console.log(`[KnowledgeBaseService] Cache miss, searching for ${company} - ${position}`);
  
  // Search for interview data
  const searchAgent = new SearchAgent({
    enableGlassdoor: true,
    enableLeetCode: true,
    enableIndeed: false, // Disabled to save costs
    enableTavily: true,
  });
  
  const rawResults = await searchAgent.search(company, position);
  
  // Extract structured knowledge
  const extractionAgent = new KnowledgeExtractionAgent(options.language || 'en');
  const structuredKnowledge = await extractionAgent.extract(company, position, rawResults);
  
  // Save to database
  const knowledgeBase = await saveKnowledgeBase(
    company,
    position,
    companyNormalized,
    positionNormalized,
    structuredKnowledge
  );
  
  // Log the search
  const searchDuration = Date.now() - startTime;
  await logSearch({
    userId: options.userId,
    company,
    position,
    knowledgeBaseId: knowledgeBase.id,
    cacheHit: false,
    searchDuration,
    sourcesSearched: ['glassdoor', 'leetcode', 'tavily'],
    resultsCount: knowledgeBase.questions.length,
  });
  
  return {
    knowledgeBase,
    cacheHit: false,
    searchDuration,
  };
}

/**
 * Get cached knowledge base if valid
 */
async function getCachedKnowledgeBase(
  companyNormalized: string,
  positionNormalized: string
): Promise<KnowledgeBaseWithQuestions | null> {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  
  // Find non-expired knowledge base
  const results = await db
    .select()
    .from(interviewKnowledgeBases)
    .where(
      and(
        eq(interviewKnowledgeBases.companyNormalized, companyNormalized),
        eq(interviewKnowledgeBases.positionNormalized, positionNormalized),
        gt(interviewKnowledgeBases.expiresAt, now)
      )
    )
    .limit(1);
  
  if (results.length === 0) {
    return null;
  }
  
  const kb = results[0];
  
  // Get associated questions
  const questions = await db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.knowledgeBaseId, kb.id));
  
  return {
    ...kb,
    questions,
  };
}

/**
 * Save knowledge base and questions to database
 */
async function saveKnowledgeBase(
  company: string,
  position: string,
  companyNormalized: string,
  positionNormalized: string,
  knowledge: StructuredKnowledge
): Promise<KnowledgeBaseWithQuestions> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }
  
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRATION_DAYS);
  
  // Count total questions
  const questionCount = 
    knowledge.technicalQuestions.length + 
    knowledge.behavioralQuestions.length + 
    knowledge.caseQuestions.length;
  
  // Delete existing knowledge base for this company/position (if any)
  const existing = await db
    .select({ id: interviewKnowledgeBases.id })
    .from(interviewKnowledgeBases)
    .where(
      and(
        eq(interviewKnowledgeBases.companyNormalized, companyNormalized),
        eq(interviewKnowledgeBases.positionNormalized, positionNormalized)
      )
    );
  
  if (existing.length > 0) {
    // Delete old questions first
    await db
      .delete(interviewQuestions)
      .where(eq(interviewQuestions.knowledgeBaseId, existing[0].id));
    
    // Delete old knowledge base
    await db
      .delete(interviewKnowledgeBases)
      .where(eq(interviewKnowledgeBases.id, existing[0].id));
  }
  
  // Insert new knowledge base
  const insertResult = await db
    .insert(interviewKnowledgeBases)
    .values({
      company,
      position,
      companyNormalized,
      positionNormalized,
      interviewProcess: knowledge.interviewProcess,
      companyInfo: knowledge.companyInfo,
      tips: knowledge.tips,
      sourceCount: knowledge.sourceCount,
      questionCount,
      lastSearchedAt: new Date(),
      expiresAt,
    });
  
  const knowledgeBaseId = Number(insertResult[0].insertId);
  
  // Insert questions
  const questionsToInsert: Array<{
    knowledgeBaseId: number;
    type: 'technical' | 'behavioral' | 'case';
    question: string;
    category: string | null;
    difficulty: 'Easy' | 'Medium' | 'Hard' | null;
    frequency: number;
    sampleAnswer: string | null;
    source: string;
    sourceUrl: string | null;
    reportedDate: Date | null;
  }> = [];
  
  // Add technical questions
  for (const q of knowledge.technicalQuestions) {
    questionsToInsert.push({
      knowledgeBaseId,
      type: 'technical',
      question: q.question,
      category: q.category || null,
      difficulty: q.difficulty || null,
      frequency: q.frequency || 1,
      sampleAnswer: q.sampleAnswer || null,
      source: q.source || 'extracted',
      sourceUrl: null,
      reportedDate: q.reportedDate ? new Date(q.reportedDate) : null,
    });
  }
  
  // Add behavioral questions
  for (const q of knowledge.behavioralQuestions) {
    questionsToInsert.push({
      knowledgeBaseId,
      type: 'behavioral',
      question: q.question,
      category: q.category || null,
      difficulty: null,
      frequency: 1,
      sampleAnswer: q.starExample || null,
      source: q.source || 'extracted',
      sourceUrl: null,
      reportedDate: null,
    });
  }
  
  // Add case questions
  for (const q of knowledge.caseQuestions) {
    questionsToInsert.push({
      knowledgeBaseId,
      type: 'case',
      question: q.question,
      category: q.category || null,
      difficulty: q.difficulty || null,
      frequency: 1,
      sampleAnswer: q.hints ? q.hints.join('\n') : null,
      source: q.source || 'extracted',
      sourceUrl: null,
      reportedDate: null,
    });
  }
  
  // Batch insert questions
  if (questionsToInsert.length > 0) {
    await db.insert(interviewQuestions).values(questionsToInsert);
  }
  
  // Fetch and return the complete knowledge base
  const savedKb = await db
    .select()
    .from(interviewKnowledgeBases)
    .where(eq(interviewKnowledgeBases.id, knowledgeBaseId))
    .limit(1);
  
  const savedQuestions = await db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.knowledgeBaseId, knowledgeBaseId));
  
  return {
    ...savedKb[0],
    questions: savedQuestions,
  };
}

/**
 * Log a knowledge base search
 */
async function logSearch(params: {
  userId?: number;
  company: string;
  position: string;
  knowledgeBaseId?: number;
  cacheHit: boolean;
  searchDuration: number;
  sourcesSearched: string[];
  resultsCount: number;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db.insert(knowledgeBaseSearchLogs).values({
      userId: params.userId || null,
      company: params.company,
      position: params.position,
      knowledgeBaseId: params.knowledgeBaseId || null,
      cacheHit: params.cacheHit ? 1 : 0,
      searchDuration: params.searchDuration,
      sourcesSearched: params.sourcesSearched,
      resultsCount: params.resultsCount,
    });
  } catch (error) {
    console.error('[KnowledgeBaseService] Failed to log search:', error);
  }
}

/**
 * Get knowledge base by ID
 */
export async function getKnowledgeBaseById(id: number): Promise<KnowledgeBaseWithQuestions | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db
    .select()
    .from(interviewKnowledgeBases)
    .where(eq(interviewKnowledgeBases.id, id))
    .limit(1);
  
  if (results.length === 0) {
    return null;
  }
  
  const questions = await db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.knowledgeBaseId, id));
  
  return {
    ...results[0],
    questions,
  };
}

/**
 * Get questions by type from a knowledge base
 */
export async function getQuestionsByType(
  knowledgeBaseId: number,
  type: 'technical' | 'behavioral' | 'case'
): Promise<InterviewQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(interviewQuestions)
    .where(
      and(
        eq(interviewQuestions.knowledgeBaseId, knowledgeBaseId),
        eq(interviewQuestions.type, type)
      )
    );
}

/**
 * Get high-frequency questions from a knowledge base
 */
export async function getHighFrequencyQuestions(
  knowledgeBaseId: number,
  minFrequency: number = 3,
  limit: number = 10
): Promise<InterviewQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  
  const questions = await db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.knowledgeBaseId, knowledgeBaseId));
  
  // Filter and sort by frequency
  return questions
    .filter((q: InterviewQuestion) => (q.frequency || 1) >= minFrequency)
    .sort((a: InterviewQuestion, b: InterviewQuestion) => (b.frequency || 1) - (a.frequency || 1))
    .slice(0, limit);
}

/**
 * Invalidate (expire) a knowledge base
 */
export async function invalidateKnowledgeBase(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(interviewKnowledgeBases)
    .set({ expiresAt: new Date() })
    .where(eq(interviewKnowledgeBases.id, id));
}

/**
 * Get all knowledge bases (for admin)
 */
export async function getAllKnowledgeBases(): Promise<InterviewKnowledgeBase[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(interviewKnowledgeBases);
}

/**
 * Get search statistics
 */
export async function getSearchStatistics(): Promise<{
  totalSearches: number;
  cacheHitRate: number;
  averageSearchDuration: number;
  topCompanies: Array<{ company: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalSearches: 0,
      cacheHitRate: 0,
      averageSearchDuration: 0,
      topCompanies: [],
    };
  }
  
  const logs = await db.select().from(knowledgeBaseSearchLogs);
  
  const totalSearches = logs.length;
  const cacheHits = logs.filter((l) => l.cacheHit === 1).length;
  const cacheHitRate = totalSearches > 0 ? cacheHits / totalSearches : 0;
  
  const totalDuration = logs.reduce((sum, l) => sum + (l.searchDuration || 0), 0);
  const averageSearchDuration = totalSearches > 0 ? totalDuration / totalSearches : 0;
  
  // Count companies
  const companyCounts: Record<string, number> = {};
  for (const log of logs) {
    companyCounts[log.company] = (companyCounts[log.company] || 0) + 1;
  }
  
  const topCompanies = Object.entries(companyCounts)
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalSearches,
    cacheHitRate,
    averageSearchDuration,
    topCompanies,
  };
}
