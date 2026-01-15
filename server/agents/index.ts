/**
 * Interview Knowledge Base Agents
 * 
 * This module exports all agents and services for the interview knowledge base system.
 */

// Search Agent - collects interview data from multiple sources
export { 
  SearchAgent, 
  searchAgent,
  searchGlassdoor,
  searchLeetCode,
  searchIndeed,
  searchTavily,
  normalizeCompanyName,
  normalizePositionName,
  type RawSearchResult,
  type SearchAgentConfig,
} from './searchAgent';

// Knowledge Extraction Agent - extracts structured knowledge using LLM
export {
  KnowledgeExtractionAgent,
  knowledgeExtractionAgent,
  type StructuredKnowledge,
  type InterviewProcess,
  type InterviewRound,
  type TechnicalQuestion,
  type BehavioralQuestion,
  type CaseQuestion,
  type CompanyInfo,
  type InterviewTip,
} from './knowledgeExtractionAgent';

// Knowledge Base Service - manages caching and database operations
export {
  getOrCreateKnowledgeBase,
  getKnowledgeBaseById,
  getQuestionsByType,
  getHighFrequencyQuestions,
  invalidateKnowledgeBase,
  getAllKnowledgeBases,
  getSearchStatistics,
  type KnowledgeBaseWithQuestions,
  type GetKnowledgeBaseOptions,
  type KnowledgeBaseResult,
} from './knowledgeBaseService';

// Interview Generator - generates personalized interview questions
export {
  InterviewGenerator,
  generateInterviewPlan,
  generateInterviewSystemPrompt,
  type UserProfile,
  type GeneratedQuestion,
  type InterviewPlan,
  type GenerateInterviewOptions,
} from './interviewGenerator';

// Hint Generator - generates helpful hints during interviews
export {
  generateHint,
  shouldOfferHint,
  type HintRequest,
  type HintResponse,
} from './hintGenerator';

// Next Question Generator - intelligent next question selection
export {
  generateNextQuestion,
  generateInterviewResponse,
  type NextQuestionContext,
  type NextQuestionDecision,
} from './nextQuestionGenerator';

// ReAct Agent Framework
export * from './react';
