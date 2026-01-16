import { integer, serial, pgEnum, pgTable, text, timestamp, varchar, json, numeric, boolean, jsonb, index } from "drizzle-orm/pg-core";
// Define PostgreSQL enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const sourceEnum = pgEnum("source", ["manual", "linkedin", "ai_generated"]);
export const statusEnum = pgEnum("status", ["pending", "in_progress", "completed"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);
export const typeEnum = pgEnum("type", ["technical", "behavioral", "case"]);
export const difficultyEnum = pgEnum("difficulty", ["Easy", "Medium", "Hard"]);



/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User job preferences for matching
 */
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  employmentTypes: json("employmentTypes").$type<string[]>(),
  workMode: varchar("workMode", { length: 32 }),
  location: varchar("location", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

/**
 * Job recommendations matched for users
 */
export const jobRecommendations = pgTable("job_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  company: varchar("company", { length: 256 }).notNull(),
  companyId: varchar("companyId", { length: 64 }),
  companyLogo: varchar("companyLogo", { length: 512 }),
  position: varchar("position", { length: 256 }).notNull(),
  location: varchar("location", { length: 256 }),
  postedAt: timestamp("postedAt"),
  matchPercentage: integer("matchPercentage").default(0),
  salaryMin: numeric("salaryMin", { precision: 12, scale: 2 }),
  salaryMax: numeric("salaryMax", { precision: 12, scale: 2 }),
  jobType: varchar("jobType", { length: 64 }),
  workType: varchar("workType", { length: 64 }),
  experienceLevel: varchar("experienceLevel", { length: 64 }),
  industry: varchar("industry", { length: 128 }),
  description: text("description"),
  linkedinJobId: varchar("linkedinJobId", { length: 64 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  applyUrl: varchar("applyUrl", { length: 512 }),
  source: sourceEnum("source").default("manual"),
  scrapedAt: timestamp("scrapedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type JobRecommendation = typeof jobRecommendations.$inferSelect;
export type InsertJobRecommendation = typeof jobRecommendations.$inferInsert;

/**
 * Interview history records
 */
export const interviewHistory = pgTable("interview_history", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  question: text("question").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  score: integer("score"),
  audioDuration: varchar("audioDuration", { length: 32 }),
  audioUrl: varchar("audioUrl", { length: 512 }),
  aiFeedback: json("aiFeedback").$type<{
    scoreReason?: string;
    interviewerIntent?: string;
    capabilityAssessed?: string;
    whatToAnswer?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type InterviewHistory = typeof interviewHistory.$inferSelect;
export type InsertInterviewHistory = typeof interviewHistory.$inferInsert;


/**
 * Mock interview sessions
 */
export const mockSessions = pgTable("mock_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  jobId: integer("jobId").notNull(),
  status: statusEnum("status").default("pending").notNull(),
  matchScore: integer("matchScore"),
  totalQuestions: integer("totalQuestions").default(6),
  currentQuestion: integer("currentQuestion").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type MockSession = typeof mockSessions.$inferSelect;
export type InsertMockSession = typeof mockSessions.$inferInsert;

/**
 * Mock interview messages (conversation history)
 */
export const mockMessages = pgTable("mock_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  role: roleEnum("role").notNull(),
  content: text("content").notNull(),
  questionIndex: integer("questionIndex"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MockMessage = typeof mockMessages.$inferSelect;
export type InsertMockMessage = typeof mockMessages.$inferInsert;

/**
 * Assessment reports generated after mock interviews
 */
export const assessmentReports = pgTable("assessment_reports", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  userId: integer("userId").notNull(),
  jobId: integer("jobId").notNull(),
  matchScore: integer("matchScore").notNull(),
  strengths: json("strengths").$type<Array<{
    skill: string;
    description: string;
  }>>(),
  improvements: json("improvements").$type<Array<{
    skill: string;
    description: string;
    priority: "high" | "medium" | "low";
  }>>(),
  suggestions: json("suggestions").$type<Array<{
    topic: string;
    resource: string;
    estimatedTime: string;
  }>>(),
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AssessmentReport = typeof assessmentReports.$inferSelect;
export type InsertAssessmentReport = typeof assessmentReports.$inferInsert;


/**
 * Interview Knowledge Base - stores extracted interview knowledge per company/position
 * Knowledge is cached with 30-day expiration for freshness
 */
export const interviewKnowledgeBases = pgTable("interview_knowledge_bases", {
  id: serial("id").primaryKey(),
  company: varchar("company", { length: 256 }).notNull(),
  position: varchar("position", { length: 256 }).notNull(),
  companyNormalized: varchar("companyNormalized", { length: 256 }).notNull(),
  positionNormalized: varchar("positionNormalized", { length: 256 }).notNull(),
  
  // Interview process information (JSON)
  interviewProcess: json("interviewProcess").$type<{
    rounds: Array<{
      order: number;
      name: string;
      duration?: string;
      format?: string;
      focus: string[];
    }>;
    totalDuration?: string;
    difficulty: "Easy" | "Medium" | "Hard";
    offerRate?: number;
  }>(),
  
  // Company culture and interview style (JSON)
  companyInfo: json("companyInfo").$type<{
    culture: string[];
    values: string[];
    interviewStyle?: string;
    redFlags: string[];
    greenFlags: string[];
  }>(),
  
  // Interview tips (JSON)
  tips: json("tips").$type<Array<{
    category: string;
    tip: string;
    source: string;
  }>>(),
  
  // Metadata
  sourceCount: integer("sourceCount").default(0),
  questionCount: integer("questionCount").default(0),
  lastSearchedAt: timestamp("lastSearchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type InterviewKnowledgeBase = typeof interviewKnowledgeBases.$inferSelect;
export type InsertInterviewKnowledgeBase = typeof interviewKnowledgeBases.$inferInsert;

/**
 * Interview Questions - stores individual interview questions linked to knowledge bases
 */
export const interviewQuestions = pgTable("interview_questions", {
  id: serial("id").primaryKey(),
  knowledgeBaseId: integer("knowledgeBaseId").notNull(),
  
  type: typeEnum("type").notNull(),
  question: text("question").notNull(),
  category: varchar("category", { length: 128 }),
  difficulty: difficultyEnum("difficulty"),
  frequency: integer("frequency").default(1), // 1-5, how often this question appears
  sampleAnswer: text("sampleAnswer"),
  source: varchar("source", { length: 128 }).notNull(),
  sourceUrl: varchar("sourceUrl", { length: 512 }),
  reportedDate: timestamp("reportedDate"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InterviewQuestion = typeof interviewQuestions.$inferSelect;
export type InsertInterviewQuestion = typeof interviewQuestions.$inferInsert;

/**
 * Knowledge Base Search Log - tracks search requests for analytics
 */
export const knowledgeBaseSearchLogs = pgTable("knowledge_base_search_logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  company: varchar("company", { length: 256 }).notNull(),
  position: varchar("position", { length: 256 }).notNull(),
  knowledgeBaseId: integer("knowledgeBaseId"),
  cacheHit: integer("cacheHit").default(0), // 1 = hit, 0 = miss
  searchDuration: integer("searchDuration"), // milliseconds
  sourcesSearched: json("sourcesSearched").$type<string[]>(),
  resultsCount: integer("resultsCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeBaseSearchLog = typeof knowledgeBaseSearchLogs.$inferSelect;
export type InsertKnowledgeBaseSearchLog = typeof knowledgeBaseSearchLogs.$inferInsert;


/**
 * LinkedIn Job Cache - stores pre-fetched LinkedIn jobs for faster recommendations
 * Jobs are cached with position category for efficient matching
 */
export const linkedinJobCache = pgTable("linkedin_job_cache", {
  id: serial("id").primaryKey(),
  
  // Job identification
  linkedinJobId: varchar("linkedinJobId", { length: 64 }).notNull().unique(),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  
  // Company info
  company: varchar("company", { length: 256 }).notNull(),
  companyLogo: varchar("companyLogo", { length: 512 }),
  companyLinkedinUrl: varchar("companyLinkedinUrl", { length: 512 }),
  
  // Job details
  title: varchar("title", { length: 256 }).notNull(),
  location: varchar("location", { length: 256 }),
  workType: varchar("workType", { length: 64 }), // remote, hybrid, onsite
  employmentType: varchar("employmentType", { length: 64 }), // full-time, part-time, contract
  experienceLevel: varchar("experienceLevel", { length: 64 }), // entry, mid, senior
  
  // Rich content for matching
  description: text("description"),
  requirements: json("requirements").$type<string[]>(),
  skills: json("skills").$type<string[]>(),
  benefits: json("benefits").$type<string[]>(),
  
  // Salary info
  salaryMin: numeric("salaryMin", { precision: 12, scale: 2 }),
  salaryMax: numeric("salaryMax", { precision: 12, scale: 2 }),
  salaryCurrency: varchar("salaryCurrency", { length: 8 }),
  
  // Categorization for efficient querying
  positionCategory: varchar("positionCategory", { length: 128 }).notNull(), // e.g., "software_engineer", "product_manager"
  industry: varchar("industry", { length: 128 }),
  
  // Metadata
  postedAt: timestamp("postedAt"),
  scrapedAt: timestamp("scrapedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // Cache expiration (e.g., 7 days)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type LinkedinJobCache = typeof linkedinJobCache.$inferSelect;
export type InsertLinkedinJobCache = typeof linkedinJobCache.$inferInsert;

/**
 * Job Cache Fetch Log - tracks when job categories were last fetched
 */
export const jobCacheFetchLogs = pgTable("job_cache_fetch_logs", {
  id: serial("id").primaryKey(),
  positionCategory: varchar("positionCategory", { length: 128 }).notNull(),
  searchQuery: varchar("searchQuery", { length: 256 }).notNull(),
  jobsFetched: integer("jobsFetched").default(0),
  fetchDuration: integer("fetchDuration"), // milliseconds
  status: statusEnum("status").default("completed"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobCacheFetchLog = typeof jobCacheFetchLogs.$inferSelect;
export type InsertJobCacheFetchLog = typeof jobCacheFetchLogs.$inferInsert;


/**
 * Bookmarked Questions - stores questions that users want to practice again
 */
export const bookmarkedQuestions = pgTable("bookmarked_questions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Question content
  topic: varchar("topic", { length: 256 }).notNull(),
  question: text("question").notNull(),
  difficulty: difficultyEnum("difficulty").default("Medium"),
  
  // Context
  targetPosition: varchar("targetPosition", { length: 256 }),
  
  // Category for organization
  category: varchar("category", { length: 64 }).default("uncategorized"),
  
  // User notes
  notes: text("notes"),
  
  // Practice tracking
  practiceCount: integer("practiceCount").default(0),
  lastPracticedAt: timestamp("lastPracticedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type BookmarkedQuestion = typeof bookmarkedQuestions.$inferSelect;
export type InsertBookmarkedQuestion = typeof bookmarkedQuestions.$inferInsert;


// ==========================================
// JobH Tables (Careerflow Clone)
// ==========================================

/**
 * Resumes - stores user resumes
 */
export const resumes = pgTable("resumes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Resume metadata
  title: varchar("title", { length: 256 }).notNull(),
  type: typeEnum("type").default("technical").notNull(),
  isDefault: integer("isDefault").default(0), // 1 = default resume
  
  // Resume score
  score: integer("score").default(0), // 0-100
  
  // Target job (for tailored resumes)
  targetJobId: integer("targetJobId"),
  targetJobTitle: varchar("targetJobTitle", { length: 256 }),
  targetCompany: varchar("targetCompany", { length: 256 }),
  
  // Resume content (JSON)
  personalInfo: json("personalInfo").$type<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
    portfolioUrl?: string;
  }>(),
  
  summary: text("summary"),
  
  experience: json("experience").$type<Array<{
    id: string;
    company: string;
    position: string;
    location?: string;
    startDate: string;
    endDate?: string;
    current: boolean;
    description: string;
    highlights?: string[];
  }>>(),
  
  education: json("education").$type<Array<{
    id: string;
    institution: string;
    degree: string;
    field?: string;
    location?: string;
    startDate: string;
    endDate?: string;
    gpa?: string;
    highlights?: string[];
  }>>(),
  
  skills: json("skills").$type<Array<{
    id: string;
    name: string;
    level?: "beginner" | "intermediate" | "advanced" | "expert";
    category?: string;
  }>>(),
  
  projects: json("projects").$type<Array<{
    id: string;
    name: string;
    description: string;
    url?: string;
    startDate?: string;
    endDate?: string;
    technologies?: string[];
    highlights?: string[];
  }>>(),
  
  certifications: json("certifications").$type<Array<{
    id: string;
    name: string;
    issuer: string;
    date?: string;
    expiryDate?: string;
    credentialId?: string;
    url?: string;
  }>>(),
  
  awards: json("awards").$type<Array<{
    id: string;
    title: string;
    issuer: string;
    date?: string;
    description?: string;
  }>>(),
  
  publications: json("publications").$type<Array<{
    id: string;
    title: string;
    publisher?: string;
    date?: string;
    url?: string;
    description?: string;
  }>>(),
  
  volunteering: json("volunteering").$type<Array<{
    id: string;
    organization: string;
    role: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>>(),
  
  // Design settings
  templateId: varchar("templateId", { length: 64 }).default("default"),
  colorScheme: varchar("colorScheme", { length: 64 }).default("professional"),
  fontSize: varchar("fontSize", { length: 32 }).default("medium"),
  
  // Section visibility
  sectionVisibility: json("sectionVisibility").$type<{
    summary?: boolean;
    experience?: boolean;
    education?: boolean;
    skills?: boolean;
    projects?: boolean;
    certifications?: boolean;
    awards?: boolean;
    publications?: boolean;
    volunteering?: boolean;
  }>(),
  
  // PDF storage
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  pdfGeneratedAt: timestamp("pdfGeneratedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Resume = typeof resumes.$inferSelect;
export type InsertResume = typeof resumes.$inferInsert;

/**
 * Job Tracker - stores jobs user is tracking
 * NOTE: Schema matches actual database structure with jobTitle/companyName columns
 */
export const trackedJobs = pgTable("tracked_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Job info (using actual DB column names)
  jobTitle: varchar("jobTitle", { length: 256 }).notNull(),
  companyName: varchar("companyName", { length: 256 }).notNull(),
  jobUrl: varchar("jobUrl", { length: 512 }),
  location: varchar("location", { length: 256 }),
  salary: varchar("salary", { length: 128 }),
  description: text("description"),
  
  // Tracking status
  status: statusEnum("status").default("pending").notNull(),
  columnOrder: integer("columnOrder").default(0),
  
  // Application details
  appliedAt: timestamp("appliedAt"),
  interviewDate: timestamp("interviewDate"),
  
  // Notes and tags
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  
  // Contact info
  contactName: varchar("contactName", { length: 256 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  
  // Skill matching
  skillMatch: integer("skillMatch").default(0),
  extractedSkills: json("extractedSkills").$type<string[]>(),
  
  // Source tracking
  source: sourceEnum("source").default("manual"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type TrackedJob = typeof trackedJobs.$inferSelect;
export type InsertTrackedJob = typeof trackedJobs.$inferInsert;

/**
 * LinkedIn Generated Content - stores AI-generated LinkedIn content
 */
export const linkedinContent = pgTable("linkedin_content", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Content type
  type: typeEnum("type").notNull(),
  
  // Input parameters
  inputKeywords: json("inputKeywords").$type<string[]>(),
  inputTone: varchar("inputTone", { length: 64 }),
  inputLanguage: varchar("inputLanguage", { length: 32 }).default("English"),
  inputProfile: varchar("inputProfile", { length: 64 }), // job_seeker, professional, student
  
  // Generated content
  generatedContent: text("generatedContent").notNull(),
  
  // User feedback
  isFavorite: integer("isFavorite").default(0),
  isUsed: integer("isUsed").default(0), // User copied/used this content
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LinkedinContent = typeof linkedinContent.$inferSelect;
export type InsertLinkedinContent = typeof linkedinContent.$inferInsert;

/**
 * User Profile for JobH - extended user settings
 */
export const jobhUserProfiles = pgTable("jobh_user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  
  // Onboarding status
  onboardingCompleted: integer("onboardingCompleted").default(0),
  onboardingStep: integer("onboardingStep").default(1),
  
  // Target job info
  targetJobTitle: varchar("targetJobTitle", { length: 256 }),
  targetIndustry: varchar("targetIndustry", { length: 128 }),
  experienceLevel: varchar("experienceLevel", { length: 64 }),
  
  // LinkedIn profile
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  linkedinHeadline: text("linkedinHeadline"),
  linkedinAbout: text("linkedinAbout"),
  
  // Progress tracking
  resumesCreated: integer("resumesCreated").default(0),
  jobsTracked: integer("jobsTracked").default(0),
  interviewsCompleted: integer("interviewsCompleted").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type JobhUserProfile = typeof jobhUserProfiles.$inferSelect;
export type InsertJobhUserProfile = typeof jobhUserProfiles.$inferInsert;


/**
 * AI Toolbox Generated Content History
 * Stores history of all AI-generated content (emails, cover letters, pitches, etc.)
 */
export const aiToolboxHistory = pgTable("ai_toolbox_history", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  
  // Content type
  type: typeEnum("type").notNull(),
  
  // Input parameters (stored as JSON for flexibility)
  inputParams: json("inputParams").$type<{
    // Email params
    emailType?: string;
    recipientName?: string;
    recipientTitle?: string;
    companyName?: string;
    context?: string;
    tone?: string;
    // Cover letter params
    jobTitle?: string;
    jobDescription?: string;
    resumeId?: number;
    // Elevator pitch params
    targetRole?: string;
    experience?: string;
    skills?: string[];
    uniqueValue?: string;
    duration?: string;
    // LinkedIn params
    keywords?: string[];
    profile?: string;
    language?: string;
  }>(),
  
  // Generated content
  generatedContent: text("generatedContent").notNull(),
  
  // Associated job (for Import from Board feature)
  trackedJobId: integer("trackedJobId"),
  
  // User feedback
  isFavorite: integer("isFavorite").default(0),
  isUsed: integer("isUsed").default(0), // User copied/used this content
  rating: integer("rating"), // 1-5 stars
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiToolboxHistory = typeof aiToolboxHistory.$inferSelect;
export type InsertAiToolboxHistory = typeof aiToolboxHistory.$inferInsert;


/**
 * Skill Analysis Cache - stores LLM skill analysis results for job-resume matching
 * Cache key is hash of (jobDescription + resumeId), expires after 24 hours
 */
export const skillAnalysisCache = pgTable("skill_analysis_cache", {
  id: serial("id").primaryKey(),
  
  // Cache key (hash of jobDescription + resumeId)
  cacheKey: varchar("cacheKey", { length: 64 }).notNull().unique(),
  
  // Input references
  jobDescriptionHash: varchar("jobDescriptionHash", { length: 64 }).notNull(),
  resumeId: integer("resumeId").notNull(),
  userId: integer("userId").notNull(),
  
  // Job info (for display)
  jobTitle: varchar("jobTitle", { length: 256 }),
  company: varchar("company", { length: 256 }),
  jobUrl: varchar("jobUrl", { length: 512 }),
  
  // Analysis results
  score: integer("score").notNull(), // 0-100 match score
  strongMatch: json("strongMatch").$type<string[]>().notNull(), // Exact skill matches
  partialMatch: json("partialMatch").$type<Array<{
    resume: string;
    job: string;
  }>>().notNull(), // Partial/similar skill matches
  missing: json("missing").$type<string[]>().notNull(), // Missing skills from resume
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // 24 hours from creation
});

export type SkillAnalysisCache = typeof skillAnalysisCache.$inferSelect;
export type InsertSkillAnalysisCache = typeof skillAnalysisCache.$inferInsert;

// ==================== Analytics Tables ====================

// Analytics Events Table
export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  eventName: varchar('event_name', { length: 100 }).notNull(),
  userId: varchar('user_id', { length: 100 }),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  properties: jsonb('properties'),
  pageUrl: text('page_url'),
  pageTitle: varchar('page_title', { length: 255 }),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventNameIdx: index('idx_event_name').on(table.eventName),
  userIdIdx: index('idx_user_id').on(table.userId),
  sessionIdIdx: index('idx_session_id').on(table.sessionId),
  createdAtIdx: index('idx_created_at').on(table.createdAt),
}));

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

// Analytics Sessions Table
export const analyticsSessions = pgTable('analytics_sessions', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 100 }).unique().notNull(),
  userId: varchar('user_id', { length: 100 }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  pageViews: integer('page_views').default(0).notNull(),
  eventsCount: integer('events_count').default(0).notNull(),
  deviceType: varchar('device_type', { length: 50 }),
  browser: varchar('browser', { length: 50 }),
  os: varchar('os', { length: 50 }),
  country: varchar('country', { length: 100 }),
}, (table) => ({
  sessionIdIdx: index('idx_analytics_session_id').on(table.sessionId),
  userIdIdx: index('idx_analytics_user_id').on(table.userId),
  startedAtIdx: index('idx_started_at').on(table.startedAt),
}));

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type NewAnalyticsSession = typeof analyticsSessions.$inferInsert;
