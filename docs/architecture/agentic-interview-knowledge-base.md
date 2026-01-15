# Agentic Interview Knowledge Base System

**Version:** 2.0 (Implementation Complete)  
**Author:** Manus AI  
**Date:** January 5, 2026

---

## Executive Summary

The Agentic Interview Knowledge Base System is a sophisticated multi-agent architecture designed to collect, extract, and leverage real interview data from multiple sources. The system enables UHired to generate highly personalized and company-specific mock interview questions by combining structured data from Glassdoor, LeetCode, and community discussions with intelligent LLM-based knowledge extraction.

This document describes the complete implementation, including the Search Agent, Knowledge Extraction Agent, caching system, and API integration.

---

## System Architecture

The knowledge base system follows a three-tier agent architecture that separates concerns and enables efficient data processing.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
│              (Company: Google, Position: SWE)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Knowledge Base Service                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Cache Check                           │   │
│  │         (30-day expiration, normalized keys)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              │                               │                   │
│         Cache Hit                       Cache Miss               │
│              │                               │                   │
│              ▼                               ▼                   │
│     Return Cached KB              ┌─────────────────────┐       │
│                                   │    Search Agent     │       │
│                                   └─────────────────────┘       │
│                                              │                   │
│                                              ▼                   │
│                                   ┌─────────────────────┐       │
│                                   │ Knowledge Extraction│       │
│                                   │       Agent         │       │
│                                   └─────────────────────┘       │
│                                              │                   │
│                                              ▼                   │
│                                   ┌─────────────────────┐       │
│                                   │   Save to Database  │       │
│                                   └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Sources

The system integrates multiple data sources to ensure comprehensive coverage of interview information.

| Source | Type | Data Collected | Apify Actor |
|--------|------|----------------|-------------|
| **Glassdoor** | Primary | Interview experiences, questions, difficulty ratings | memo23/apify-glassdoor-reviews-scraper |
| **LeetCode** | Primary | Technical interview questions, company tags | harvest/leetcode-interview-questions-scraper |
| **Tavily Search** | Supplementary | 一亩三分地, Reddit, Blind discussions | Tavily API |
| **Indeed** | Optional | Additional interview data | memo23/apify-indeed-reviews |

---

## Implementation Details

### Search Agent

The Search Agent (`server/agents/searchAgent.ts`) is responsible for collecting raw interview data from multiple sources. It supports parallel execution and automatic deduplication.

**Key Features:**
- Configurable data source enablement
- Parallel search execution for performance
- Content-based deduplication
- Normalized company/position matching

**Configuration Options:**

```typescript
interface SearchAgentConfig {
  maxGlassdoorResults?: number;    // Default: 30
  maxLeetCodeResults?: number;     // Default: 50
  maxIndeedResults?: number;       // Default: 20
  maxTavilyResults?: number;       // Default: 10
  enableGlassdoor?: boolean;       // Default: true
  enableLeetCode?: boolean;        // Default: true
  enableIndeed?: boolean;          // Default: false
  enableTavily?: boolean;          // Default: true
}
```

### Knowledge Extraction Agent

The Knowledge Extraction Agent (`server/agents/knowledgeExtractionAgent.ts`) uses LLM with structured JSON output to extract interview knowledge from raw search results.

**Extracted Data Structure:**

| Category | Fields | Description |
|----------|--------|-------------|
| **Interview Process** | rounds, totalDuration, difficulty, offerRate | Company's interview structure |
| **Technical Questions** | question, category, difficulty, frequency, sampleAnswer | Coding and system design questions |
| **Behavioral Questions** | question, category, starExample | STAR-format behavioral questions |
| **Case Questions** | question, category, difficulty, hints | Case study and estimation questions |
| **Company Info** | culture, values, interviewStyle, redFlags, greenFlags | Company culture insights |
| **Tips** | category, tip, source | Interview preparation advice |

**Processing Pipeline:**
1. Chunk raw results (max 10 per chunk) to avoid token limits
2. Extract structured knowledge from each chunk using LLM
3. Merge extractions with deduplication
4. Generate unique IDs for questions

### Database Schema

Three new tables support the knowledge base system:

**interview_knowledge_bases**
- Stores company/position-level knowledge
- JSON fields for interview process, company info, and tips
- 30-day cache expiration via `expiresAt` field
- Normalized keys for consistent matching

**interview_questions**
- Individual questions linked to knowledge bases
- Type enum: technical, behavioral, case
- Frequency field (1-5) indicates question commonality
- Sample answers and hints for preparation

**knowledge_base_search_logs**
- Analytics for search requests
- Cache hit/miss tracking
- Search duration metrics
- Source attribution

### Interview Generator

The Interview Generator (`server/agents/interviewGenerator.ts`) combines knowledge base data with LLM generation to create personalized interview plans.

**Generation Strategy:**
1. Select 70% of questions from knowledge base (high-frequency first)
2. Generate remaining 30% using LLM based on user profile
3. Ensure question type diversity
4. Include company-specific tips and context

---

## API Endpoints

The system exposes the following tRPC endpoints under the `knowledgeBase` router:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `getOrCreate` | Mutation | Get or create knowledge base for company/position |
| `getById` | Query | Retrieve knowledge base by ID |
| `generatePlan` | Mutation | Generate personalized interview plan |
| `generatePrompt` | Mutation | Generate interview system prompt with KB context |
| `listAll` | Query | Admin: List all knowledge bases |
| `getStatistics` | Query | Admin: Get search statistics |

**Example Usage:**

```typescript
// Get or create knowledge base
const result = await trpc.knowledgeBase.getOrCreate.mutate({
  company: "Google",
  position: "Software Engineer",
  language: "en",
  forceRefresh: false,
});

// Generate interview plan
const plan = await trpc.knowledgeBase.generatePlan.mutate({
  company: "Google",
  position: "Software Engineer",
  jobDescription: "We are looking for...",
  questionCount: 6,
  focusAreas: ["technical", "behavioral"],
  userProfile: {
    resumeSummary: "5 years of experience...",
    skills: ["JavaScript", "Python", "React"],
  },
});
```

---

## Caching Strategy

The caching system ensures efficient resource usage while maintaining data freshness.

**Cache Configuration:**
- Expiration: 30 days from creation
- Key: Normalized company + position combination
- Invalidation: Manual via `invalidateKnowledgeBase()`

**Cache Hit Behavior:**
1. Check for non-expired knowledge base with matching normalized keys
2. Return cached data with associated questions
3. Log cache hit for analytics

**Cache Miss Behavior:**
1. Execute Search Agent across enabled sources
2. Extract knowledge using LLM
3. Save to database with expiration date
4. Log search duration and sources

---

## File Structure

```
server/agents/
├── index.ts                    # Module exports
├── searchAgent.ts              # Multi-source data collection
├── knowledgeExtractionAgent.ts # LLM-based knowledge extraction
├── knowledgeBaseService.ts     # Caching and database operations
├── interviewGenerator.ts       # Personalized question generation
└── knowledgeBase.test.ts       # Unit tests

drizzle/schema.ts               # Database schema additions
server/routers.ts               # API endpoint definitions
```

---

## Testing

The system includes comprehensive unit tests covering:

- Company and position name normalization
- JSON schema structure validation
- Cache expiration logic
- API input validation
- Question structure validation

**Test Results:** 34/34 tests passing

---

## Cost Considerations

| Source | Pricing | Typical Usage |
|--------|---------|---------------|
| Glassdoor Scraper | ~$2.50/1000 results | 30 results per search |
| LeetCode Scraper | ~$5.00/1000 results | 50 results per search |
| Tavily Search | Free tier available | 10 results per search |
| LLM Extraction | Per-token pricing | ~2000 tokens per chunk |

**Optimization Strategies:**
- 30-day caching reduces repeated API calls
- Indeed scraper disabled by default
- Chunked extraction minimizes token usage
- Normalized keys prevent duplicate searches

---

## Future Enhancements

1. **Vector Search Integration**: Add semantic search for question similarity
2. **User Feedback Loop**: Allow users to rate question relevance
3. **Real-time Updates**: Webhook integration for new interview reports
4. **Multi-language Support**: Expand beyond English and Chinese
5. **Company Verification**: Cross-validate data across sources

---

## Conclusion

The Agentic Interview Knowledge Base System provides UHired with a robust foundation for generating company-specific, personalized mock interviews. By combining multiple data sources with intelligent extraction and caching, the system delivers relevant interview preparation while optimizing resource usage.

---

*Document Version: 2.0*  
*Implementation Status: Complete*  
*Last Updated: January 5, 2026*
