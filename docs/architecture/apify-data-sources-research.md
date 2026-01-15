# Apify Data Sources Research for Interview Knowledge Base

## Research Date: 2026-01-05

## Summary

This document catalogs Apify scrapers that can be used for the UHired agentic interview knowledge base system. The goal is to collect real-time interview data from multiple sources to generate personalized mock interview questions.

---

## 1. Glassdoor Scrapers (Primary Source)

### memo23/apify-glassdoor-reviews-interviews
- **Description**: Scrapes reviews, interviews, locations, and salary data from Glassdoor
- **Data Types**: Interview questions, difficulty ratings, interview process, outcomes
- **Pricing**: Pay-per-result model
- **Status**: ✅ Already integrated in architecture design

### bitty.studio/glassdoor-jobs-company-reviews-interviews-salaries
- **Description**: Comprehensive Glassdoor scraper for jobs, reviews, interviews, salaries
- **Data Types**: Full company profile with interview data
- **Pricing**: TBD

### newbs/Glassdoor-Job-Scraper
- **Description**: Up-to-date Glassdoor job scraper
- **Data Types**: Job listings with company insights

---

## 2. Indeed Scrapers (Secondary Source)

### memo23/apify-indeed-reviews-ppr (Pay-Per-Result)
- **Description**: 360° workforce intelligence - reviews, salaries, jobs, interviews
- **Data Types**: 
  - Interview experiences
  - Company reviews
  - Salary data
  - Cultural metrics
- **Pricing**: Pay-per-result
- **Use Case**: Cross-validate interview data from Glassdoor

### memo23/apify-indeed-reviews
- **Description**: Same as above but different pricing model
- **Data Types**: Reviews, interviews, salary, jobs, company info
- **Users**: 200 users

### curious_coder/indeed-scraper
- **Description**: Actively maintained job scraper
- **Data Types**: Job postings, hiring company details
- **Rating**: 4.6 (36 reviews)
- **Users**: 2.9K

---

## 3. LinkedIn Scrapers (Job & Company Data)

### bebity/linkedin-jobs-scraper
- **Description**: LinkedIn job listings scraper
- **Data Types**: Job titles, requirements, company info
- **Status**: ✅ Already integrated in UHired

### harvestapi/linkedin-profile-search
- **Description**: Search LinkedIn profiles with filters
- **Data Types**: Work experience, education, skills
- **Rating**: 4.9 (21 reviews)
- **Users**: 5.1K
- **Note**: No cookies required

### harvestapi/linkedin-company-employees
- **Description**: Extract company employee data
- **Data Types**: Employee profiles, roles, experience levels
- **Rating**: 4.0 (10 reviews)
- **Note**: No cookies required

### fetchclub/linkedin-jobs-scraper
- **Description**: LinkedIn Jobs & Company Scraper
- **Data Types**: Job listings worldwide
- **Rating**: 2.2 (6 reviews)

---

## 4. LeetCode Scrapers (Technical Interview Data)

### harvest/leetcode-interview-questions-scraper ⭐ NEW
- **Description**: Extract interview experiences and questions from LeetCode
- **Data Types**:
  - Interview experience posts
  - Question types and difficulty
  - Company-specific interview trends
  - Candidate experiences and outcomes
- **Pricing**: $5.00 / 1,000 results
- **Users**: 33
- **Input Parameters**:
  - `company`: Company name (e.g., "google")
  - `maxToScrape`: Max posts to scrape (default: 250)
  - `startDate`: Filter by date (YYYY-MM-DD)
- **Output Fields**:
  - `title`: Interview experience post title
  - `tags`: Company name, level tags
  - `content`: Detailed interview experience
  - `creationdate`: Post timestamp
  - `upvoteCount`: Community validation metric
- **Use Case**: Technical interview preparation, coding question trends

### taneja/leetcode-api-scraper
- **Description**: Scrape LeetCode user profiles, problems, contests
- **Data Types**: User stats, solved problems, contest ratings
- **Rating**: 5.0 (1 review)

---

## 5. Reddit Scrapers (Community Discussions)

### trudax/reddit-scraper
- **Description**: Unlimited Reddit scraper for posts, comments, communities
- **Data Types**: 
  - Posts and comments
  - Subreddit data
  - User profiles
- **Rating**: 2.8 (14 reviews)
- **Users**: 9.7K
- **Note**: No login required

### trudax/reddit-scraper-lite
- **Description**: Pay-per-result Reddit scraper
- **Data Types**: Same as above
- **Rating**: 2.8 (19 reviews)
- **Users**: 12K

### harshmaur/reddit-scraper-pro
- **Description**: Unlimited scraping for $20/mo
- **Data Types**: Posts, users, comments, communities
- **Rating**: 4.0 (5 reviews)
- **Users**: 1.2K
- **Features**: Make, n8n integrations

### fatihtahta/reddit-scraper-search-fast
- **Description**: All-in-one Reddit scraper
- **Pricing**: $1.5 / 1K results
- **Rating**: 5.0 (5 reviews)
- **Users**: 803
- **Note**: Enterprise-grade, fastest in market

### easyapi/reddit-posts-search-scraper
- **Description**: Extract Reddit posts from search results
- **Data Types**: Posts with rich metadata
- **Use Case**: Search r/cscareerquestions, r/interviews for interview discussions

---

## 6. Potential Subreddits for Interview Data

Using Reddit scrapers, we can target these subreddits:
- r/cscareerquestions - Software engineering career advice
- r/interviews - General interview experiences
- r/leetcode - LeetCode discussion and experiences
- r/ExperiencedDevs - Senior developer interviews
- r/datascience - Data science interviews
- r/ProductManagement - PM interview experiences
- r/consulting - Consulting interview prep (case studies)

---

## Data Source Priority Matrix

| Priority | Source | Data Type | Reliability | Cost |
|----------|--------|-----------|-------------|------|
| 1 | Glassdoor (memo23) | Interview Q&A | High | Medium |
| 2 | LeetCode (harvest) | Tech interviews | High | $5/1K |
| 3 | Indeed (memo23) | Cross-validation | Medium | Medium |
| 4 | Reddit (trudax) | Community insights | Medium | Low |
| 5 | LinkedIn (bebity) | Job requirements | High | Integrated |

---

## Recommended Data Collection Strategy

### Phase 1: MVP (Immediate)
1. **Glassdoor** - Primary source for structured interview data
2. **LeetCode** - Technical interview questions for tech roles
3. **Tavily Search** - Supplementary search for 一亩三分地 and other sources

### Phase 2: Enhancement
1. **Indeed** - Cross-validate and enrich interview data
2. **Reddit** - Community discussions and recent experiences
3. **LinkedIn** - Job requirements correlation

### Phase 3: Optimization
1. Implement intelligent source selection based on:
   - Target company (some companies have more data on specific platforms)
   - Role type (tech vs non-tech)
   - Geographic region (US vs international)

---

## Integration Notes

### API Token
- Apify API Token: Available in environment as `APIFY_API_TOKEN`

### Caching Strategy
- Cache interview data per company/role combination
- 30-day expiration for freshness
- Store in database with timestamp for cache invalidation

### Rate Limiting
- Implement exponential backoff for API calls
- Queue system for batch requests
- Monitor usage to stay within budget

---

## Next Steps

1. [ ] Test LeetCode Interview Questions Scraper with sample companies
2. [ ] Evaluate Reddit scraper for r/cscareerquestions data quality
3. [ ] Implement Search Agent with multi-source support
4. [ ] Create Knowledge Extraction Agent for data normalization
5. [ ] Build caching layer with 30-day expiration
