/**
 * LinkedIn 职位缓存服务
 * 
 * 功能：
 * 1. 预加载：面试前预拉取较大范围职位到缓存
 * 2. 缓存管理：存储尽可能多的职位信息
 * 3. 智能匹配：推荐时从缓存筛选
 */

import { getDb } from '../db';
import { linkedinJobCache, jobCacheFetchLogs } from '../../drizzle/schema';
import { eq, and, gte, like, inArray, desc, sql } from 'drizzle-orm';
import { scrapeLinkedInJobs, type LinkedInJobResult } from '../apify';

// 职位类别映射
const POSITION_CATEGORIES: Record<string, string[]> = {
  'software_engineer': ['software engineer', 'software developer', 'backend engineer', 'frontend engineer', 'full stack'],
  'product_manager': ['product manager', 'pm', 'product owner', 'product lead'],
  'data_scientist': ['data scientist', 'machine learning engineer', 'ml engineer', 'data analyst'],
  'designer': ['ux designer', 'ui designer', 'product designer', 'design lead'],
  'devops': ['devops engineer', 'sre', 'platform engineer', 'infrastructure engineer'],
  'mobile': ['ios engineer', 'android engineer', 'mobile developer', 'react native'],
};

// 缓存有效期（7天）
const CACHE_EXPIRY_DAYS = 7;

/**
 * 规范化职位类别
 */
export function normalizePositionCategory(position: string): string {
  const lowerPosition = position.toLowerCase();
  
  for (const [category, keywords] of Object.entries(POSITION_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerPosition.includes(keyword)) {
        return category;
      }
    }
  }
  
  // 默认返回通用类别
  return 'general';
}

/**
 * 检查缓存是否需要刷新
 */
export async function shouldRefreshCache(positionCategory: string): Promise<boolean> {
  const now = new Date();
  
  // 检查是否有有效的缓存
  const db = await getDb();
  if (!db) return true; // 没有数据库连接时需要刷新
  
  const validJobs = await db
    .select({ count: sql<number>`count(*)` })
    .from(linkedinJobCache)
    .where(
      and(
        eq(linkedinJobCache.positionCategory, positionCategory),
        gte(linkedinJobCache.expiresAt, now)
      )
    );
  
  // 如果有效职位少于 10 个，需要刷新
  return (validJobs[0]?.count || 0) < 10;
}

/**
 * 预加载职位到缓存
 * 
 * @param targetPosition 目标职位（如 "Software Engineer at Google"）
 * @returns 加载的职位数量
 */
export async function preloadJobsToCache(targetPosition: string): Promise<number> {
  const startTime = Date.now();
  const positionCategory = normalizePositionCategory(targetPosition);
  
  // 检查是否需要刷新
  const needsRefresh = await shouldRefreshCache(positionCategory);
  if (!needsRefresh) {
    console.log(`[JobCache] Cache hit for category: ${positionCategory}`);
    return 0;
  }
  
  console.log(`[JobCache] Preloading jobs for category: ${positionCategory}`);
  
  const db = await getDb();
  if (!db) {
    console.error('[JobCache] No database connection');
    return 0;
  }
  
  // 构建搜索查询
  const searchQueries = POSITION_CATEGORIES[positionCategory] || [targetPosition];
  const primaryQuery = searchQueries[0];
  
  try {
    // 调用 Apify 获取职位
    const jobs = await scrapeLinkedInJobs({
      title: primaryQuery,
      location: 'United States', // 默认美国
      rows: 50, // 获取较多职位
    });
    
    if (!jobs || jobs.length === 0) {
      await logFetchAttempt(positionCategory, primaryQuery, 0, Date.now() - startTime, 'failed', 'No jobs returned');
      return 0;
    }
    
    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRY_DAYS);
    
    // 批量插入到缓存
    let insertedCount = 0;
    for (const job of jobs) {
      try {
        // 检查是否已存在
        const existing = await db
          .select({ id: linkedinJobCache.id })
          .from(linkedinJobCache)
          .where(eq(linkedinJobCache.linkedinJobId, job.jobId || `job_${Date.now()}_${Math.random()}`))
          .limit(1);
        
        if (existing.length > 0) {
          // 更新过期时间
          await db
            .update(linkedinJobCache)
            .set({ expiresAt, updatedAt: new Date() })
            .where(eq(linkedinJobCache.id, existing[0].id));
        } else {
          // 插入新职位
          await db.insert(linkedinJobCache).values({
            linkedinJobId: job.jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            linkedinUrl: job.linkedinUrl,
            company: job.company || 'Unknown',
            companyLogo: job.companyLogo,
            companyLinkedinUrl: null, // LinkedInJobResult doesn't have companyUrl
            title: job.title || 'Unknown Position',
            location: job.location,
            workType: job.workType,
            employmentType: job.jobType, // Use jobType as employmentType
            experienceLevel: job.experienceLevel,
            description: job.description,
            requirements: [], // Will be extracted from description if needed
            skills: [], // Will be extracted from description if needed
            benefits: [], // Will be extracted from description if needed
            salaryMin: job.salaryMin ? String(job.salaryMin) : null,
            salaryMax: job.salaryMax ? String(job.salaryMax) : null,
            salaryCurrency: null, // LinkedInJobResult doesn't have currency field
            positionCategory,
            industry: null, // LinkedInJobResult doesn't have industry field
            postedAt: job.postedAt ? new Date(job.postedAt) : null,
            scrapedAt: new Date(),
            expiresAt,
          });
          insertedCount++;
        }
      } catch (err) {
        console.error(`[JobCache] Failed to insert job:`, err);
      }
    }
    
    await logFetchAttempt(positionCategory, primaryQuery, insertedCount, Date.now() - startTime, 'success');
    console.log(`[JobCache] Cached ${insertedCount} jobs for category: ${positionCategory}`);
    
    return insertedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logFetchAttempt(positionCategory, primaryQuery, 0, Date.now() - startTime, 'failed', errorMessage);
    console.error(`[JobCache] Failed to preload jobs:`, error);
    return 0;
  }
}

/**
 * 从缓存中获取匹配的职位
 */
export async function getMatchingJobsFromCache(
  targetPosition: string,
  skills: string[],
  limit: number = 10
): Promise<Array<{
  id: number;
  company: string;
  title: string;
  location: string | null;
  description: string | null;
  skills: string[];
  linkedinUrl: string | null;
  matchScore: number;
}>> {
  const positionCategory = normalizePositionCategory(targetPosition);
  const now = new Date();
  
  const db = await getDb();
  if (!db) return [];
  
  // 获取有效的缓存职位
  const cachedJobs = await db
    .select()
    .from(linkedinJobCache)
    .where(
      and(
        eq(linkedinJobCache.positionCategory, positionCategory),
        gte(linkedinJobCache.expiresAt, now)
      )
    )
    .orderBy(desc(linkedinJobCache.scrapedAt))
    .limit(100); // 获取更多用于匹配
  
  if (cachedJobs.length === 0) {
    return [];
  }
  
  // 计算匹配分数
  const scoredJobs = cachedJobs.map((job: typeof cachedJobs[number]) => {
    let score = 50; // 基础分数
    
    // 技能匹配
    const jobSkills = (job.skills as string[]) || [];
    const matchedSkills = skills.filter(skill => 
      jobSkills.some(js => js.toLowerCase().includes(skill.toLowerCase()))
    );
    score += matchedSkills.length * 10;
    
    // 职位标题匹配
    const titleLower = job.title.toLowerCase();
    const targetLower = targetPosition.toLowerCase();
    if (titleLower.includes(targetLower) || targetLower.includes(titleLower)) {
      score += 20;
    }
    
    // 有描述加分
    if (job.description && job.description.length > 100) {
      score += 5;
    }
    
    // 有薪资信息加分
    if (job.salaryMin || job.salaryMax) {
      score += 5;
    }
    
    return {
      id: job.id,
      company: job.company,
      title: job.title,
      location: job.location,
      description: job.description,
      skills: jobSkills,
      linkedinUrl: job.linkedinUrl,
      matchScore: Math.min(score, 100),
    };
  });
  
  // 按分数排序并返回
  return scoredJobs
    .sort((a: { matchScore: number }, b: { matchScore: number }) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * 记录缓存获取日志
 */
async function logFetchAttempt(
  positionCategory: string,
  searchQuery: string,
  jobsFetched: number,
  fetchDuration: number,
  status: 'success' | 'partial' | 'failed',
  errorMessage?: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    await db.insert(jobCacheFetchLogs).values({
      positionCategory,
      searchQuery,
      jobsFetched,
      fetchDuration,
      status,
      errorMessage,
    });
  } catch (err) {
    console.error('[JobCache] Failed to log fetch attempt:', err);
  }
}

/**
 * 清理过期的缓存
 */
export async function cleanupExpiredCache(): Promise<number> {
  const now = new Date();
  
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .delete(linkedinJobCache)
    .where(sql`${linkedinJobCache.expiresAt} < ${now}`);
  
  // MySQL 不直接返回删除行数，这里返回 0 表示执行成功
  console.log('[JobCache] Cleaned up expired cache entries');
  return 0;
}
