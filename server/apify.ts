import { ApifyClient } from 'apify-client';

// Apify API Token from environment
// Prefer V2 token (paid account) over V1 token (free account)
const APIFY_TOKEN = process.env.APIFY_API_TOKEN_V2 || process.env.APIFY_API_TOKEN;

// Initialize Apify client
const getApifyClient = () => {
  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN is not configured');
  }
  return new ApifyClient({ token: APIFY_TOKEN });
};

// LinkedIn Jobs Scraper Actor ID
const LINKEDIN_JOBS_ACTOR = 'bebity/linkedin-jobs-scraper';

// Work type mapping
export const WORK_TYPE_MAP = {
  onsite: '1',
  remote: '2',
  hybrid: '3',
} as const;

// Contract type mapping
export const CONTRACT_TYPE_MAP = {
  fulltime: 'F',
  parttime: 'P',
  contract: 'C',
  temporary: 'T',
  internship: 'I',
  volunteer: 'V',
} as const;

// Experience level mapping
export const EXPERIENCE_LEVEL_MAP = {
  entry: '1',
  associate: '2',
  mid: '3',
  senior: '4',
  director: '5',
} as const;

// Published at mapping
export const PUBLISHED_AT_MAP = {
  '30days': 'r2592000',
  '7days': 'r604800',
  '24hours': 'r86400',
} as const;

// LinkedIn Company Scraper Actor ID (No cookies required)
const LINKEDIN_COMPANY_ACTOR = 'dev_fusion/linkedin-company-scraper';

export interface LinkedInCompany {
  name: string;
  industry?: string;
  website?: string;
  linkedinUrl: string;
  employeeCount?: number;
  description?: string;
  specialities?: string[];
  foundedYear?: number;
  headquarters?: string;
  followerCount?: number;
  logoUrl?: string;
  coverImageUrl?: string;
}

export interface LinkedInJobSearchParams {
  title: string;
  location: string;
  rows?: number;
  workType?: keyof typeof WORK_TYPE_MAP;
  contractType?: keyof typeof CONTRACT_TYPE_MAP;
  experienceLevel?: keyof typeof EXPERIENCE_LEVEL_MAP;
  publishedAt?: keyof typeof PUBLISHED_AT_MAP;
  companyNames?: string[];
}

export interface LinkedInJobResult {
  jobId: string;
  title: string;
  company: string;
  companyId?: string;
  companyLogo?: string;
  location: string;
  description: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: string;
  workType?: string;
  experienceLevel?: string;
  postedAt?: string;
  linkedinUrl: string;
  applyUrl?: string;
}

/**
 * Scrape LinkedIn jobs using Apify with retry mechanism
 */
export async function scrapeLinkedInJobs(params: LinkedInJobSearchParams, maxRetries = 3): Promise<LinkedInJobResult[]> {
  const client = getApifyClient();

  // Build input for the Actor
  const runInput: Record<string, unknown> = {
    title: params.title,
    location: params.location || 'United States',
    rows: params.rows || 50,
    proxy: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
    },
  };

  // Add optional filters
  if (params.workType) {
    runInput.workType = WORK_TYPE_MAP[params.workType];
  }
  if (params.contractType) {
    runInput.contractType = CONTRACT_TYPE_MAP[params.contractType];
  }
  if (params.experienceLevel) {
    runInput.experienceLevel = EXPERIENCE_LEVEL_MAP[params.experienceLevel];
  }
  if (params.publishedAt) {
    runInput.publishedAt = PUBLISHED_AT_MAP[params.publishedAt];
  }
  if (params.companyNames && params.companyNames.length > 0) {
    runInput.companyName = params.companyNames;
  }

  console.log('[Apify] Starting LinkedIn Jobs scraper with input:', JSON.stringify(runInput, null, 2));

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Apify] Attempt ${attempt}/${maxRetries}`);
      
      // Run the Actor and wait for it to finish
      const run = await client.actor(LINKEDIN_JOBS_ACTOR).call(runInput);

      if (!run || !run.defaultDatasetId) {
        console.error('[Apify] Actor run failed or returned no dataset');
        if (attempt < maxRetries) {
          console.log(`[Apify] Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        return [];
      }

      console.log('[Apify] Actor run completed, fetching results from dataset:', run.defaultDatasetId);

      // Fetch results from the dataset
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Transform results to our format
    // Note: LinkedIn API returns companyName (not company), companyLogoUrl (not companyLogo)
    const jobs: LinkedInJobResult[] = items.map((item: Record<string, unknown>) => ({
      jobId: String(item.jobId || item.id || ''),
      title: String(item.title || item.jobTitle || ''),
      // companyName is the correct field from LinkedIn API, company is often undefined
      company: String(item.companyName || item.company || 'Unknown'),
      companyId: item.companyId ? String(item.companyId) : undefined,
      // companyLogoUrl is the correct field from LinkedIn API
      companyLogo: item.companyLogoUrl ? String(item.companyLogoUrl) : (item.companyLogo ? String(item.companyLogo) : undefined),
      location: String(item.location || item.jobLocation || ''),
      description: String(item.description || item.jobDescription || ''),
      salary: item.salary ? String(item.salary) : undefined,
      salaryMin: item.salaryMin ? Number(item.salaryMin) : undefined,
      salaryMax: item.salaryMax ? Number(item.salaryMax) : undefined,
      jobType: item.jobType ? String(item.jobType) : undefined,
      workType: item.workType ? String(item.workType) : undefined,
      experienceLevel: item.experienceLevel ? String(item.experienceLevel) : undefined,
      postedAt: item.postedAt ? String(item.postedAt) : undefined,
      linkedinUrl: String(item.jobUrl || item.url || item.linkedinUrl || ''),
      applyUrl: item.applyUrl ? String(item.applyUrl) : undefined,
    }));

      console.log(`[Apify] Successfully scraped ${jobs.length} jobs`);
      return jobs;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Apify] Attempt ${attempt} failed:`, lastError.message);
      
      // Check if it's a network error that's worth retrying
      const isRetryable = lastError.message.includes('ECONNRESET') || 
                          lastError.message.includes('ETIMEDOUT') ||
                          lastError.message.includes('socket') ||
                          lastError.message.includes('network');
      
      if (isRetryable && attempt < maxRetries) {
        console.log(`[Apify] Retrying in ${attempt * 3} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
        continue;
      }
      
      // If not retryable or max retries reached, return empty array instead of throwing
      if (attempt === maxRetries) {
        console.error('[Apify] All retry attempts failed, returning empty results');
        return [];
      }
    }
  }
  
  // Should not reach here, but return empty array as fallback
  return [];
}

/**
 * Scrape LinkedIn company profiles (No cookies required)
 * Actor: dev_fusion/linkedin-company-scraper
 * Pricing: $8.00 / 1,000 results
 */
export async function scrapeLinkedInCompany(companyUrls: string[]): Promise<LinkedInCompany[]> {
  const client = getApifyClient();

  const runInput = {
    profileUrls: companyUrls,
  };

  console.log('[Apify] Starting LinkedIn Company scraper with input:', JSON.stringify(runInput, null, 2));

  try {
    const run = await client.actor(LINKEDIN_COMPANY_ACTOR).call(runInput);

    if (!run || !run.defaultDatasetId) {
      console.error('[Apify] Company scraper run failed or returned no dataset');
      return [];
    }

    console.log('[Apify] Company scraper completed, fetching results from dataset:', run.defaultDatasetId);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    const companies: LinkedInCompany[] = items.map((item: Record<string, unknown>) => ({
      name: String(item.name || item.companyName || 'Unknown'),
      industry: item.industry ? String(item.industry) : undefined,
      website: item.website || item.websiteUrl ? String(item.website || item.websiteUrl) : undefined,
      linkedinUrl: String(item.linkedinUrl || item.url || ''),
      employeeCount: item.employeeCount || item.employeesCount ? Number(item.employeeCount || item.employeesCount) : undefined,
      description: item.description || item.about ? String(item.description || item.about) : undefined,
      specialities: Array.isArray(item.specialities) ? item.specialities.map(String) : (Array.isArray(item.specialties) ? item.specialties.map(String) : undefined),
      foundedYear: item.foundedYear || item.founded ? Number(item.foundedYear || item.founded) : undefined,
      headquarters: item.headquarters || item.location ? String(item.headquarters || item.location) : undefined,
      followerCount: item.followerCount || item.followersCount ? Number(item.followerCount || item.followersCount) : undefined,
      logoUrl: item.logoUrl || item.logo ? String(item.logoUrl || item.logo) : undefined,
      coverImageUrl: item.coverImageUrl || item.coverImage ? String(item.coverImageUrl || item.coverImage) : undefined,
    }));

    console.log(`[Apify] Successfully scraped ${companies.length} companies`);
    return companies;
  } catch (error) {
    console.error('[Apify] Error scraping LinkedIn companies:', error);
    throw error;
  }
}

/**
 * Check if Apify is configured
 */
export function isApifyConfigured(): boolean {
  return !!APIFY_TOKEN;
}

/**
 * Get Apify account info (for testing connection)
 */
export async function getApifyAccountInfo() {
  const client = getApifyClient();
  try {
    const user = await client.user().get();
    return {
      configured: true,
      username: user?.username,
      email: user?.email,
    };
  } catch (error) {
    return {
      configured: false,
      error: String(error),
    };
  }
}
