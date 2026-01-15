/**
 * Search Agent for Interview Knowledge Base
 * 
 * This agent is responsible for collecting interview data from multiple sources:
 * 1. Glassdoor (via Apify) - Primary source for structured interview data
 * 2. LeetCode (via Apify) - Technical interview questions
 * 3. Indeed (via Apify) - Cross-validation and additional data
 * 4. Tavily Search - Supplementary search for 一亩三分地, Reddit, etc.
 */

import { ApifyClient } from 'apify-client';

// Apify Actor IDs
const GLASSDOOR_ACTOR = 'memo23/apify-glassdoor-reviews-scraper';
const LEETCODE_INTERVIEW_ACTOR = 'harvest/leetcode-interview-questions-scraper';
const INDEED_REVIEWS_ACTOR = 'memo23/apify-indeed-reviews';
const REDDIT_SCRAPER_ACTOR = 'trudax/reddit-scraper';

// Tavily API configuration
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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';
const TAVILY_API_URL = 'https://api.tavily.com/search';

// Types
export interface RawSearchResult {
  source: 'glassdoor' | 'leetcode' | 'indeed' | 'tavily' | 'reddit';
  type: 'interview' | 'question' | 'review' | 'discussion';
  title: string;
  content: string;
  url?: string;
  date?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchAgentConfig {
  maxGlassdoorResults?: number;
  maxLeetCodeResults?: number;
  maxIndeedResults?: number;
  maxTavilyResults?: number;
  enableGlassdoor?: boolean;
  enableLeetCode?: boolean;
  enableIndeed?: boolean;
  enableTavily?: boolean;
}

const DEFAULT_CONFIG: SearchAgentConfig = {
  maxGlassdoorResults: 30,
  maxLeetCodeResults: 50,
  maxIndeedResults: 20,
  maxTavilyResults: 10,
  enableGlassdoor: true,
  enableLeetCode: true,
  enableIndeed: false, // Disabled by default to save costs
  enableTavily: true,
};

/**
 * Get Apify client instance
 * Uses APIFY_API_TOKEN_V2 for Glassdoor access, falls back to APIFY_API_TOKEN
 */
function getApifyClient(): ApifyClient {
  // Prefer V2 token (has Glassdoor access), fallback to original
  const token = process.env.APIFY_API_TOKEN_V2 || process.env.APIFY_API_TOKEN;
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }
  return new ApifyClient({ token });
}

/**
 * Normalize company name for consistent matching
 */
export function normalizeCompanyName(company: string): string {
  return company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Normalize position name for consistent matching
 */
export function normalizePositionName(position: string): string {
  return position
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search Glassdoor for interview data
 * Uses memo23/apify-glassdoor-reviews-scraper with command: "interviews"
 */
export async function searchGlassdoor(
  company: string,
  maxResults: number = 30
): Promise<RawSearchResult[]> {
  const client = getApifyClient();
  
  console.log(`[SearchAgent] Searching Glassdoor for ${company} interviews...`);
  
  try {
    // Use the correct Glassdoor URL format and command parameter
    const glassdoorUrl = `https://www.glassdoor.com/Overview/Working-at-${encodeURIComponent(company.replace(/\s+/g, '-'))}-EI_IE*.htm`;
    
    const run = await client.actor(GLASSDOOR_ACTOR).call({
      startUrls: [{ url: glassdoorUrl }],
      command: 'interviews',  // Key parameter to get interview questions
      maxItems: maxResults,
    }, {
      waitSecs: 180, // Wait up to 3 minutes for interview data
    });

    if (!run?.defaultDatasetId) {
      console.warn('[SearchAgent] Glassdoor scraper returned no dataset');
      return [];
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    const results: RawSearchResult[] = items.map((item: Record<string, unknown>) => {
      // Extract interview questions from userQuestions field
      const questions = item.userQuestions || item.interviewQuestions || item.questions;
      const processDescription = item.processDescription || item.interviewProcess || '';
      
      return {
        source: 'glassdoor' as const,
        type: 'interview' as const,
        title: String(item.jobTitle || item.title || 'Interview Experience'),
        content: `${processDescription}\n\nInterview Questions: ${questions || 'N/A'}`,
        url: item.url ? String(item.url) : undefined,
        date: item.date ? String(item.date) : undefined,
        metadata: {
          difficulty: item.difficulty,
          experience: item.experience,  // POSITIVE/NEUTRAL/NEGATIVE
          outcome: item.outcome,        // ACCEPT_OFFER/NO_OFFER/etc
          questions: questions,
          negotiationDescription: item.negotiationDescription,
          durationDays: item.durationDays,
          location: item.location,
          company: item.company || company,
        },
      };
    });

    console.log(`[SearchAgent] Found ${results.length} Glassdoor interview results`);
    return results;
  } catch (error) {
    console.error('[SearchAgent] Glassdoor search error:', error);
    return [];
  }
}

/**
 * Search LeetCode for interview questions
 */
export async function searchLeetCode(
  company: string,
  maxResults: number = 50,
  startDate?: string
): Promise<RawSearchResult[]> {
  const client = getApifyClient();
  
  console.log(`[SearchAgent] Searching LeetCode for ${company} interview questions...`);
  
  try {
    const input: Record<string, unknown> = {
      company: normalizeCompanyName(company),
      maxToScrape: maxResults,
    };
    
    if (startDate) {
      input.startDate = startDate;
    }

    const run = await client.actor(LEETCODE_INTERVIEW_ACTOR).call(input, {
      waitSecs: 120,
    });

    if (!run?.defaultDatasetId) {
      console.warn('[SearchAgent] LeetCode scraper returned no dataset');
      return [];
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    const results: RawSearchResult[] = items.map((item: Record<string, unknown>) => ({
      source: 'leetcode' as const,
      type: 'question' as const,
      title: String(item.title || 'Interview Question'),
      content: String(item.content || item.description || ''),
      date: item.creationdate ? String(item.creationdate) : undefined,
      metadata: {
        tags: item.tags,
        upvoteCount: item.upvoteCount,
        company: company,
      },
    }));

    console.log(`[SearchAgent] Found ${results.length} LeetCode interview results`);
    return results;
  } catch (error) {
    console.error('[SearchAgent] LeetCode search error:', error);
    return [];
  }
}

/**
 * Search Indeed for interview data
 */
export async function searchIndeed(
  company: string,
  maxResults: number = 20
): Promise<RawSearchResult[]> {
  const client = getApifyClient();
  
  console.log(`[SearchAgent] Searching Indeed for ${company} interviews...`);
  
  try {
    const run = await client.actor(INDEED_REVIEWS_ACTOR).call({
      company: company,
      scrapeInterviews: true,
      scrapeReviews: false,
      scrapeSalaries: false,
      maxItems: maxResults,
    }, {
      waitSecs: 120,
    });

    if (!run?.defaultDatasetId) {
      console.warn('[SearchAgent] Indeed scraper returned no dataset');
      return [];
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    const results: RawSearchResult[] = items.map((item: Record<string, unknown>) => ({
      source: 'indeed' as const,
      type: 'interview' as const,
      title: String(item.jobTitle || item.title || 'Interview Experience'),
      content: String(item.interviewProcess || item.description || item.content || ''),
      url: item.url ? String(item.url) : undefined,
      date: item.date ? String(item.date) : undefined,
      metadata: {
        difficulty: item.difficulty,
        outcome: item.outcome,
        questions: item.questions,
        company: item.company || company,
      },
    }));

    console.log(`[SearchAgent] Found ${results.length} Indeed interview results`);
    return results;
  } catch (error) {
    console.error('[SearchAgent] Indeed search error:', error);
    return [];
  }
}

/**
 * Search using Tavily API for supplementary data
 * Targets: 一亩三分地, Reddit, Blind, etc.
 */
export async function searchTavily(
  company: string,
  position: string,
  maxResults: number = 10
): Promise<RawSearchResult[]> {
  console.log(`[SearchAgent] Searching Tavily for ${company} ${position} interviews...`);
  
  const queries = [
    `${company} ${position} interview questions experience`,
    `${company} ${position} 面试经验 一亩三分地`,
    `${company} interview process reddit cscareerquestions`,
  ];
  
  const allResults: RawSearchResult[] = [];
  
  for (const query of queries) {
    try {
      const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: query,
          search_depth: 'advanced',
          max_results: Math.ceil(maxResults / queries.length),
          include_domains: [
            '1point3acres.com',
            'reddit.com',
            'teamblind.com',
            'glassdoor.com',
            'levels.fyi',
          ],
        }),
      });

      if (!response.ok) {
        console.warn(`[SearchAgent] Tavily search failed for query: ${query}`);
        continue;
      }

      const data = await response.json() as {
        results?: Array<{
          title?: string;
          content?: string;
          url?: string;
          published_date?: string;
        }>;
      };
      
      if (data.results) {
        const results: RawSearchResult[] = data.results.map((item) => ({
          source: 'tavily' as const,
          type: 'discussion' as const,
          title: item.title || 'Interview Discussion',
          content: item.content || '',
          url: item.url,
          date: item.published_date,
          metadata: {
            query: query,
            company: company,
            position: position,
          },
        }));
        
        allResults.push(...results);
      }
    } catch (error) {
      console.error(`[SearchAgent] Tavily search error for query "${query}":`, error);
    }
  }

  console.log(`[SearchAgent] Found ${allResults.length} Tavily search results`);
  return allResults;
}

/**
 * Deduplicate search results based on content similarity
 */
function deduplicateResults(results: RawSearchResult[]): RawSearchResult[] {
  const seen = new Set<string>();
  const deduplicated: RawSearchResult[] = [];
  
  for (const result of results) {
    // Create a simple hash based on title and first 100 chars of content
    const hash = `${result.title.toLowerCase().slice(0, 50)}|${result.content.toLowerCase().slice(0, 100)}`;
    
    if (!seen.has(hash)) {
      seen.add(hash);
      deduplicated.push(result);
    }
  }
  
  return deduplicated;
}

/**
 * Main Search Agent class
 */
export class SearchAgent {
  private config: SearchAgentConfig;
  
  constructor(config: Partial<SearchAgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Search all configured sources for interview data
   */
  async search(company: string, position: string): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];
    const errors: string[] = [];
    
    console.log(`[SearchAgent] Starting search for ${company} - ${position}`);
    
    // Run searches in parallel for better performance
    const searchPromises: Promise<RawSearchResult[]>[] = [];
    
    if (this.config.enableGlassdoor) {
      searchPromises.push(
        searchGlassdoor(company, this.config.maxGlassdoorResults)
          .catch(err => {
            errors.push(`Glassdoor: ${err.message}`);
            return [];
          })
      );
    }
    
    if (this.config.enableLeetCode) {
      // Calculate start date (6 months ago)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString().split('T')[0];
      
      searchPromises.push(
        searchLeetCode(company, this.config.maxLeetCodeResults, startDate)
          .catch(err => {
            errors.push(`LeetCode: ${err.message}`);
            return [];
          })
      );
    }
    
    if (this.config.enableIndeed) {
      searchPromises.push(
        searchIndeed(company, this.config.maxIndeedResults)
          .catch(err => {
            errors.push(`Indeed: ${err.message}`);
            return [];
          })
      );
    }
    
    if (this.config.enableTavily) {
      searchPromises.push(
        searchTavily(company, position, this.config.maxTavilyResults)
          .catch(err => {
            errors.push(`Tavily: ${err.message}`);
            return [];
          })
      );
    }
    
    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    
    // Combine all results
    for (const sourceResults of searchResults) {
      results.push(...sourceResults);
    }
    
    // Log any errors
    if (errors.length > 0) {
      console.warn('[SearchAgent] Some searches failed:', errors);
    }
    
    // Deduplicate results
    const deduplicated = deduplicateResults(results);
    
    console.log(`[SearchAgent] Search complete. Total: ${results.length}, Deduplicated: ${deduplicated.length}`);
    
    return deduplicated;
  }
  
  /**
   * Quick search using only Tavily (for fast results)
   */
  async quickSearch(company: string, position: string): Promise<RawSearchResult[]> {
    return searchTavily(company, position, 15);
  }
}

// Export singleton instance
export const searchAgent = new SearchAgent();
