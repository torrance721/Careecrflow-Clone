import { eq, and, desc, sql, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { 
  InsertUser, 
  users, 
  userPreferences, 
  InsertUserPreference, 
  UserPreference,
  jobRecommendations,
  InsertJobRecommendation,
  JobRecommendation,
  interviewHistory,
  InsertInterviewHistory,
  InterviewHistory
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, {
        ssl: 'require',
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Functions ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: [users.openId],
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ User Preferences Functions ============
export async function getUserPreferences(userId: number): Promise<UserPreference | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserPreferences(userId: number, data: Partial<InsertUserPreference>): Promise<UserPreference | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const existing = await getUserPreferences(userId);
  
  if (existing) {
    await db.update(userPreferences)
      .set({
        employmentTypes: data.employmentTypes,
        workMode: data.workMode,
        location: data.location,
      })
      .where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({
      userId,
      employmentTypes: data.employmentTypes,
      workMode: data.workMode,
      location: data.location,
    });
  }

  return getUserPreferences(userId);
}

// ============ Job Recommendations Functions ============
export async function getJobRecommendations(userId: number): Promise<JobRecommendation[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(jobRecommendations).where(eq(jobRecommendations.userId, userId));
}

export async function createJobRecommendation(data: InsertJobRecommendation): Promise<JobRecommendation | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(jobRecommendations).values(data).returning();
  return result[0] || null;
}

export async function deleteJobRecommendations(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(jobRecommendations).where(eq(jobRecommendations.userId, userId));
}

// ============ Interview History Functions ============
export async function getInterviewHistory(userId: number): Promise<InterviewHistory[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(interviewHistory).where(eq(interviewHistory.userId, userId));
}

export async function createInterviewHistory(data: InsertInterviewHistory): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(interviewHistory).values(data);
}

export async function getInterviewHistoryById(id: number): Promise<InterviewHistory | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(interviewHistory).where(eq(interviewHistory.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteInterviewHistory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(interviewHistory).where(eq(interviewHistory.id, id));
}


// ============ Mock Session Functions ============
import { 
  mockSessions, 
  InsertMockSession, 
  MockSession,
  mockMessages,
  InsertMockMessage,
  MockMessage,
  assessmentReports,
  InsertAssessmentReport,
  AssessmentReport
} from "../drizzle/schema";

export async function createMockSession(data: InsertMockSession): Promise<MockSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(mockSessions).values(data).returning();
  return result[0];
}

export async function getMockSession(sessionId: number): Promise<MockSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(mockSessions).where(eq(mockSessions.id, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMockSessionsByUser(userId: number): Promise<MockSession[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(mockSessions)
    .where(eq(mockSessions.userId, userId))
    .orderBy(desc(mockSessions.createdAt));
}

export async function updateMockSession(sessionId: number, data: Partial<InsertMockSession>): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(mockSessions).set(data).where(eq(mockSessions.id, sessionId));
}

// ============ Mock Message Functions ============
export async function createMockMessage(data: InsertMockMessage): Promise<MockMessage | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(mockMessages).values(data).returning();
  return result[0];
}

export async function getMockMessages(sessionId: number): Promise<MockMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(mockMessages)
    .where(eq(mockMessages.sessionId, sessionId))
    .orderBy(mockMessages.createdAt);
}

// ============ Assessment Report Functions ============
export async function createAssessmentReport(data: InsertAssessmentReport): Promise<AssessmentReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(assessmentReports).values(data).returning();
  return result[0];
}

export async function getAssessmentReport(sessionId: number): Promise<AssessmentReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(assessmentReports)
    .where(eq(assessmentReports.sessionId, sessionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAssessmentReportsByUser(userId: number): Promise<AssessmentReport[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(assessmentReports)
    .where(eq(assessmentReports.userId, userId))
    .orderBy(desc(assessmentReports.createdAt));
}

export async function getJobRecommendationById(jobId: number): Promise<JobRecommendation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(jobRecommendations)
    .where(eq(jobRecommendations.id, jobId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ LinkedIn Jobs Functions ============
import { isNotNull } from "drizzle-orm";

export async function createLinkedInJob(data: InsertJobRecommendation): Promise<JobRecommendation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(jobRecommendations).values({
    ...data,
    source: 'linkedin',
    scrapedAt: new Date(),
  }).returning();
  return result[0];
}

export async function bulkCreateLinkedInJobs(jobs: InsertJobRecommendation[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const jobsWithSource = jobs.map(job => ({
    ...job,
    source: 'linkedin' as const,
    scrapedAt: new Date(),
  }));

  const result = await db.insert(jobRecommendations).values(jobsWithSource).returning();
  return result.length;
}

export async function getLinkedInJobByJobId(linkedinJobId: string, userId: number): Promise<JobRecommendation | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(jobRecommendations)
    .where(and(
      eq(jobRecommendations.linkedinJobId, linkedinJobId),
      eq(jobRecommendations.userId, userId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteLinkedInJobs(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(jobRecommendations)
    .where(and(
      eq(jobRecommendations.userId, userId),
      eq(jobRecommendations.source, 'linkedin')
    ));
}

export async function getLinkedInJobs(userId: number): Promise<JobRecommendation[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(jobRecommendations)
    .where(and(
      eq(jobRecommendations.userId, userId),
      eq(jobRecommendations.source, 'linkedin')
    ))
    .orderBy(desc(jobRecommendations.scrapedAt));
}


// ============ Bookmarked Questions Functions ============
import { bookmarkedQuestions, InsertBookmarkedQuestion, BookmarkedQuestion } from "../drizzle/schema";

export async function createBookmarkedQuestion(data: InsertBookmarkedQuestion): Promise<BookmarkedQuestion | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(bookmarkedQuestions).values(data).returning();
  return result[0] || null;
}

export async function getBookmarkedQuestions(userId: number): Promise<BookmarkedQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(bookmarkedQuestions)
    .where(eq(bookmarkedQuestions.userId, userId))
    .orderBy(desc(bookmarkedQuestions.createdAt));
}

export async function deleteBookmarkedQuestion(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(bookmarkedQuestions)
    .where(and(
      eq(bookmarkedQuestions.id, id),
      eq(bookmarkedQuestions.userId, userId)
    ))
    .returning();

  return result.length > 0;
}

export async function updateBookmarkedQuestionPractice(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(bookmarkedQuestions)
    .set({
      practiceCount: sql`${bookmarkedQuestions.practiceCount} + 1`,
      lastPracticedAt: new Date()
    })
    .where(and(
      eq(bookmarkedQuestions.id, id),
      eq(bookmarkedQuestions.userId, userId)
    ))
    .returning();

  return result.length > 0;
}

export async function isQuestionBookmarked(userId: number, topic: string, question: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ id: bookmarkedQuestions.id })
    .from(bookmarkedQuestions)
    .where(and(
      eq(bookmarkedQuestions.userId, userId),
      eq(bookmarkedQuestions.topic, topic),
      eq(bookmarkedQuestions.question, question)
    ))
    .limit(1);
  
  return result.length > 0;
}


export async function updateBookmarkedQuestionNotes(id: number, userId: number, notes: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(bookmarkedQuestions)
    .set({ notes })
    .where(and(
      eq(bookmarkedQuestions.id, id),
      eq(bookmarkedQuestions.userId, userId)
    ))
    .returning();

  return result.length > 0;
}

export async function updateBookmarkedQuestionCategory(id: number, userId: number, category: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.update(bookmarkedQuestions)
    .set({ category })
    .where(and(
      eq(bookmarkedQuestions.id, id),
      eq(bookmarkedQuestions.userId, userId)
    ))
    .returning();

  return result.length > 0;
}

export async function getBookmarkedQuestionsByCategory(userId: number, category: string): Promise<BookmarkedQuestion[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(bookmarkedQuestions)
    .where(and(
      eq(bookmarkedQuestions.userId, userId),
      eq(bookmarkedQuestions.category, category)
    ))
    .orderBy(desc(bookmarkedQuestions.createdAt));
}

export async function getBookmarkCategories(userId: number): Promise<{ category: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    category: bookmarkedQuestions.category,
    count: sql<number>`count(*)`,
  })
    .from(bookmarkedQuestions)
    .where(eq(bookmarkedQuestions.userId, userId))
    .groupBy(bookmarkedQuestions.category);
  
  return result.map(r => ({
    category: r.category || 'uncategorized',
    count: Number(r.count),
  }));
}


// ==========================================
// JobH Database Functions
// ==========================================

import { 
  resumes, 
  InsertResume, 
  Resume,
  trackedJobs,
  InsertTrackedJob,
  TrackedJob,
  linkedinContent,
  InsertLinkedinContent,
  LinkedinContent,
  jobhUserProfiles,
  InsertJobhUserProfile,
  JobhUserProfile
} from "../drizzle/schema";

// ============ Resume Functions ============

export async function createResume(data: InsertResume): Promise<Resume | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(resumes).values(data).returning();
  return result[0] || null;
}

export async function getResumesByUser(userId: number): Promise<Resume[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.updatedAt));
}

export async function getResumeById(id: number, userId: number): Promise<Resume | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [resume] = await db.select().from(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  return resume || null;
}

export async function updateResume(id: number, userId: number, data: Partial<InsertResume>): Promise<Resume | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(resumes)
    .set(data)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)));
  
  return getResumeById(id, userId);
}

export async function deleteResume(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(resumes)
    .where(and(eq(resumes.id, id), eq(resumes.userId, userId)))
    .returning();
  return result.length > 0;
}

export async function duplicateResume(id: number, userId: number, newTitle?: string): Promise<Resume | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get the original resume
  const original = await getResumeById(id, userId);
  if (!original) return null;
  
  // Create a copy with new title
  const duplicateData: InsertResume = {
    userId,
    title: newTitle || `${original.title} (Copy)`,
    type: original.type,
    personalInfo: original.personalInfo,
    summary: original.summary,
    experience: original.experience,
    education: original.education,
    skills: original.skills,
    projects: original.projects,
    certifications: original.certifications,
    awards: original.awards,
    publications: original.publications,
    volunteering: original.volunteering,
    templateId: original.templateId,
    colorScheme: original.colorScheme,
    fontSize: original.fontSize,
    sectionVisibility: original.sectionVisibility,
    score: 0, // Reset score for new copy
  };
  
  return createResume(duplicateData);
}

// ============ Job Tracker Functions ============

export async function createTrackedJob(data: InsertTrackedJob): Promise<TrackedJob | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(trackedJobs).values(data).returning();
  return result[0] || null;
}

export async function getTrackedJobsByUser(userId: number): Promise<TrackedJob[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(trackedJobs).where(eq(trackedJobs.userId, userId)).orderBy(desc(trackedJobs.updatedAt));
}

export async function getTrackedJobById(id: number, userId: number): Promise<TrackedJob | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [job] = await db.select().from(trackedJobs)
    .where(and(eq(trackedJobs.id, id), eq(trackedJobs.userId, userId)));
  return job || null;
}

export async function updateTrackedJob(id: number, userId: number, data: Partial<InsertTrackedJob>): Promise<TrackedJob | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(trackedJobs)
    .set(data)
    .where(and(eq(trackedJobs.id, id), eq(trackedJobs.userId, userId)));
  
  return getTrackedJobById(id, userId);
}

export async function deleteTrackedJob(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(trackedJobs)
    .where(and(eq(trackedJobs.id, id), eq(trackedJobs.userId, userId)))
    .returning();
  return result.length > 0;
}

export async function getTrackedJobsByStatus(userId: number, status: string): Promise<TrackedJob[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(trackedJobs)
    .where(and(eq(trackedJobs.userId, userId), eq(trackedJobs.status, status as any)))
    .orderBy(desc(trackedJobs.updatedAt));
}

// ============ LinkedIn Content Functions ============

export async function createLinkedinContent(data: InsertLinkedinContent): Promise<LinkedinContent | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(linkedinContent).values(data).returning();
  return result[0] || null;
}

export async function getLinkedinContentByUser(userId: number, type?: string): Promise<LinkedinContent[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (type) {
    return db.select().from(linkedinContent)
      .where(and(eq(linkedinContent.userId, userId), eq(linkedinContent.type, type as any)))
      .orderBy(desc(linkedinContent.createdAt));
  }
  
  return db.select().from(linkedinContent)
    .where(eq(linkedinContent.userId, userId))
    .orderBy(desc(linkedinContent.createdAt));
}

export async function toggleLinkedinContentFavorite(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [content] = await db.select().from(linkedinContent)
    .where(and(eq(linkedinContent.id, id), eq(linkedinContent.userId, userId)));
  
  if (!content) return false;
  
  await db.update(linkedinContent)
    .set({ isFavorite: content.isFavorite === 1 ? 0 : 1 })
    .where(eq(linkedinContent.id, id));
  
  return true;
}

// ============ JobH User Profile Functions ============

export async function getOrCreateJobhProfile(userId: number): Promise<JobhUserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [existing] = await db.select().from(jobhUserProfiles)
    .where(eq(jobhUserProfiles.userId, userId));
  
  if (existing) return existing;
  
  // Create new profile
  await db.insert(jobhUserProfiles).values({ userId });
  
  const [profile] = await db.select().from(jobhUserProfiles)
    .where(eq(jobhUserProfiles.userId, userId));
  
  return profile || null;
}

export async function updateJobhProfile(userId: number, data: Partial<InsertJobhUserProfile>): Promise<JobhUserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(jobhUserProfiles)
    .set(data)
    .where(eq(jobhUserProfiles.userId, userId));
  
  return getOrCreateJobhProfile(userId);
}

export async function completeOnboarding(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(jobhUserProfiles)
    .set({ onboardingCompleted: 1 })
    .where(eq(jobhUserProfiles.userId, userId));
  
  return true;
}

// ============ Statistics Functions ============

export async function getJobhUserStats(userId: number) {
  const db = await getDb();
  if (!db) return { resumesCreated: 0, jobsTracked: 0, interviewsCompleted: 0 };
  
  const [resumeCount] = await db.select({ count: sql<number>`count(*)` })
    .from(resumes)
    .where(eq(resumes.userId, userId));
  
  const [jobCount] = await db.select({ count: sql<number>`count(*)` })
    .from(trackedJobs)
    .where(eq(trackedJobs.userId, userId));
  
  const [interviewCount] = await db.select({ count: sql<number>`count(*)` })
    .from(trackedJobs)
    .where(and(eq(trackedJobs.userId, userId), eq(trackedJobs.status, 'interviewing')));
  
  return {
    resumesCreated: Number(resumeCount?.count || 0),
    jobsTracked: Number(jobCount?.count || 0),
    interviewsCompleted: Number(interviewCount?.count || 0),
  };
}


// ============ LinkedIn Job Cache Functions ============
export async function getLinkedInJobCacheBySearch(
  title: string, 
  location: string, 
  limit: number = 20
): Promise<JobRecommendation[]> {
  const db = await getDb();
  if (!db) return [];

  // Get cached LinkedIn jobs that match the search criteria
  // This is used as a fallback when Apify scraping fails
  return db.select().from(jobRecommendations)
    .where(and(
      eq(jobRecommendations.source, 'linkedin'),
      isNotNull(jobRecommendations.linkedinJobId),
      or(
        like(jobRecommendations.position, `%${title}%`),
        like(jobRecommendations.location, `%${location}%`)
      )
    ))
    .orderBy(desc(jobRecommendations.scrapedAt))
    .limit(limit);
}


// ============ AI Toolbox History Functions ============
import { aiToolboxHistory, InsertAiToolboxHistory, AiToolboxHistory } from "../drizzle/schema";

export async function createAiToolboxHistory(data: InsertAiToolboxHistory): Promise<AiToolboxHistory | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(aiToolboxHistory).values(data).returning();
  return result[0] || null;
}

export async function getAiToolboxHistoryByUser(
  userId: number, 
  type?: string,
  limit: number = 50
): Promise<AiToolboxHistory[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (type) {
    return db.select().from(aiToolboxHistory)
      .where(and(
        eq(aiToolboxHistory.userId, userId),
        eq(aiToolboxHistory.type, type as any)
      ))
      .orderBy(desc(aiToolboxHistory.createdAt))
      .limit(limit);
  }
  
  return db.select().from(aiToolboxHistory)
    .where(eq(aiToolboxHistory.userId, userId))
    .orderBy(desc(aiToolboxHistory.createdAt))
    .limit(limit);
}

export async function getAiToolboxHistoryById(id: number, userId: number): Promise<AiToolboxHistory | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [record] = await db.select().from(aiToolboxHistory)
    .where(and(
      eq(aiToolboxHistory.id, id),
      eq(aiToolboxHistory.userId, userId)
    ));
  return record || null;
}

export async function updateAiToolboxHistoryFavorite(id: number, userId: number, isFavorite: boolean): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(aiToolboxHistory)
    .set({ isFavorite: isFavorite ? 1 : 0 })
    .where(and(
      eq(aiToolboxHistory.id, id),
      eq(aiToolboxHistory.userId, userId)
    ));
  return true;
}

export async function deleteAiToolboxHistory(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(aiToolboxHistory)
    .where(and(
      eq(aiToolboxHistory.id, id),
      eq(aiToolboxHistory.userId, userId)
    ));
  return true;
}
