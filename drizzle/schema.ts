import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User job preferences for matching
 */
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  employmentTypes: json("employmentTypes").$type<string[]>(),
  workMode: varchar("workMode", { length: 32 }),
  location: varchar("location", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

/**
 * Job recommendations matched for users
 */
export const jobRecommendations = mysqlTable("job_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  company: varchar("company", { length: 256 }).notNull(),
  companyId: varchar("companyId", { length: 64 }),
  companyLogo: varchar("companyLogo", { length: 512 }),
  position: varchar("position", { length: 256 }).notNull(),
  location: varchar("location", { length: 256 }),
  postedAt: timestamp("postedAt"),
  matchPercentage: int("matchPercentage").default(0),
  salaryMin: decimal("salaryMin", { precision: 12, scale: 2 }),
  salaryMax: decimal("salaryMax", { precision: 12, scale: 2 }),
  jobType: varchar("jobType", { length: 64 }),
  workType: varchar("workType", { length: 64 }),
  experienceLevel: varchar("experienceLevel", { length: 64 }),
  industry: varchar("industry", { length: 128 }),
  description: text("description"),
  linkedinJobId: varchar("linkedinJobId", { length: 64 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  applyUrl: varchar("applyUrl", { length: 512 }),
  source: mysqlEnum("source", ["manual", "linkedin", "ai_generated"]).default("manual"),
  scrapedAt: timestamp("scrapedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JobRecommendation = typeof jobRecommendations.$inferSelect;
export type InsertJobRecommendation = typeof jobRecommendations.$inferInsert;

/**
 * Interview history records
 */
export const interviewHistory = mysqlTable("interview_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  question: text("question").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  score: int("score"),
  audioDuration: varchar("audioDuration", { length: 32 }),
  audioUrl: varchar("audioUrl", { length: 512 }),
  aiFeedback: json("aiFeedback").$type<{
    scoreReason?: string;
    interviewerIntent?: string;
    capabilityAssessed?: string;
    whatToAnswer?: string;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InterviewHistory = typeof interviewHistory.$inferSelect;
export type InsertInterviewHistory = typeof interviewHistory.$inferInsert;


/**
 * Mock interview sessions
 */
export const mockSessions = mysqlTable("mock_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  status: mysqlEnum("status", ["pending", "in_progress", "completed"]).default("pending").notNull(),
  matchScore: int("matchScore"),
  totalQuestions: int("totalQuestions").default(6),
  currentQuestion: int("currentQuestion").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MockSession = typeof mockSessions.$inferSelect;
export type InsertMockSession = typeof mockSessions.$inferInsert;

/**
 * Mock interview messages (conversation history)
 */
export const mockMessages = mysqlTable("mock_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  questionIndex: int("questionIndex"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MockMessage = typeof mockMessages.$inferSelect;
export type InsertMockMessage = typeof mockMessages.$inferInsert;

/**
 * Assessment reports generated after mock interviews
 */
export const assessmentReports = mysqlTable("assessment_reports", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  jobId: int("jobId").notNull(),
  matchScore: int("matchScore").notNull(),
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
export const interviewKnowledgeBases = mysqlTable("interview_knowledge_bases", {
  id: int("id").autoincrement().primaryKey(),
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
  sourceCount: int("sourceCount").default(0),
  questionCount: int("questionCount").default(0),
  lastSearchedAt: timestamp("lastSearchedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type InterviewKnowledgeBase = typeof interviewKnowledgeBases.$inferSelect;
export type InsertInterviewKnowledgeBase = typeof interviewKnowledgeBases.$inferInsert;

/**
 * Interview Questions - stores individual interview questions linked to knowledge bases
 */
export const interviewQuestions = mysqlTable("interview_questions", {
  id: int("id").autoincrement().primaryKey(),
  knowledgeBaseId: int("knowledgeBaseId").notNull(),
  
  type: mysqlEnum("type", ["technical", "behavioral", "case"]).notNull(),
  question: text("question").notNull(),
  category: varchar("category", { length: 128 }),
  difficulty: mysqlEnum("difficulty", ["Easy", "Medium", "Hard"]),
  frequency: int("frequency").default(1), // 1-5, how often this question appears
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
export const knowledgeBaseSearchLogs = mysqlTable("knowledge_base_search_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  company: varchar("company", { length: 256 }).notNull(),
  position: varchar("position", { length: 256 }).notNull(),
  knowledgeBaseId: int("knowledgeBaseId"),
  cacheHit: int("cacheHit").default(0), // 1 = hit, 0 = miss
  searchDuration: int("searchDuration"), // milliseconds
  sourcesSearched: json("sourcesSearched").$type<string[]>(),
  resultsCount: int("resultsCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KnowledgeBaseSearchLog = typeof knowledgeBaseSearchLogs.$inferSelect;
export type InsertKnowledgeBaseSearchLog = typeof knowledgeBaseSearchLogs.$inferInsert;


/**
 * LinkedIn Job Cache - stores pre-fetched LinkedIn jobs for faster recommendations
 * Jobs are cached with position category for efficient matching
 */
export const linkedinJobCache = mysqlTable("linkedin_job_cache", {
  id: int("id").autoincrement().primaryKey(),
  
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
  salaryMin: decimal("salaryMin", { precision: 12, scale: 2 }),
  salaryMax: decimal("salaryMax", { precision: 12, scale: 2 }),
  salaryCurrency: varchar("salaryCurrency", { length: 8 }),
  
  // Categorization for efficient querying
  positionCategory: varchar("positionCategory", { length: 128 }).notNull(), // e.g., "software_engineer", "product_manager"
  industry: varchar("industry", { length: 128 }),
  
  // Metadata
  postedAt: timestamp("postedAt"),
  scrapedAt: timestamp("scrapedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // Cache expiration (e.g., 7 days)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LinkedinJobCache = typeof linkedinJobCache.$inferSelect;
export type InsertLinkedinJobCache = typeof linkedinJobCache.$inferInsert;

/**
 * Job Cache Fetch Log - tracks when job categories were last fetched
 */
export const jobCacheFetchLogs = mysqlTable("job_cache_fetch_logs", {
  id: int("id").autoincrement().primaryKey(),
  positionCategory: varchar("positionCategory", { length: 128 }).notNull(),
  searchQuery: varchar("searchQuery", { length: 256 }).notNull(),
  jobsFetched: int("jobsFetched").default(0),
  fetchDuration: int("fetchDuration"), // milliseconds
  status: mysqlEnum("status", ["success", "partial", "failed"]).default("success"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobCacheFetchLog = typeof jobCacheFetchLogs.$inferSelect;
export type InsertJobCacheFetchLog = typeof jobCacheFetchLogs.$inferInsert;


/**
 * Bookmarked Questions - stores questions that users want to practice again
 */
export const bookmarkedQuestions = mysqlTable("bookmarked_questions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Question content
  topic: varchar("topic", { length: 256 }).notNull(),
  question: text("question").notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium"),
  
  // Context
  targetPosition: varchar("targetPosition", { length: 256 }),
  
  // Category for organization
  category: varchar("category", { length: 64 }).default("uncategorized"),
  
  // User notes
  notes: text("notes"),
  
  // Practice tracking
  practiceCount: int("practiceCount").default(0),
  lastPracticedAt: timestamp("lastPracticedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BookmarkedQuestion = typeof bookmarkedQuestions.$inferSelect;
export type InsertBookmarkedQuestion = typeof bookmarkedQuestions.$inferInsert;


// ==========================================
// JobH Tables (Careerflow Clone)
// ==========================================

/**
 * Resumes - stores user resumes
 */
export const resumes = mysqlTable("resumes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Resume metadata
  title: varchar("title", { length: 256 }).notNull(),
  type: mysqlEnum("type", ["base", "tailored"]).default("base").notNull(),
  isDefault: int("isDefault").default(0), // 1 = default resume
  
  // Resume score
  score: int("score").default(0), // 0-100
  
  // Target job (for tailored resumes)
  targetJobId: int("targetJobId"),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Resume = typeof resumes.$inferSelect;
export type InsertResume = typeof resumes.$inferInsert;

/**
 * Job Tracker - stores jobs user is tracking
 * NOTE: Schema matches actual database structure with jobTitle/companyName columns
 */
export const trackedJobs = mysqlTable("tracked_jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Job info (using actual DB column names)
  jobTitle: varchar("jobTitle", { length: 256 }).notNull(),
  companyName: varchar("companyName", { length: 256 }).notNull(),
  jobUrl: varchar("jobUrl", { length: 512 }),
  location: varchar("location", { length: 256 }),
  salary: varchar("salary", { length: 128 }),
  description: text("description"),
  
  // Tracking status
  status: mysqlEnum("status", ["saved", "applied", "interviewing", "offer", "rejected", "archived"]).default("saved").notNull(),
  columnOrder: int("columnOrder").default(0),
  
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
  skillMatch: int("skillMatch").default(0),
  extractedSkills: json("extractedSkills").$type<string[]>(),
  
  // Source tracking
  source: mysqlEnum("source", ["manual", "extension", "import"]).default("manual"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrackedJob = typeof trackedJobs.$inferSelect;
export type InsertTrackedJob = typeof trackedJobs.$inferInsert;

/**
 * LinkedIn Generated Content - stores AI-generated LinkedIn content
 */
export const linkedinContent = mysqlTable("linkedin_content", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Content type
  type: mysqlEnum("type", ["headline", "about", "post"]).notNull(),
  
  // Input parameters
  inputKeywords: json("inputKeywords").$type<string[]>(),
  inputTone: varchar("inputTone", { length: 64 }),
  inputLanguage: varchar("inputLanguage", { length: 32 }).default("English"),
  inputProfile: varchar("inputProfile", { length: 64 }), // job_seeker, professional, student
  
  // Generated content
  generatedContent: text("generatedContent").notNull(),
  
  // User feedback
  isFavorite: int("isFavorite").default(0),
  isUsed: int("isUsed").default(0), // User copied/used this content
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LinkedinContent = typeof linkedinContent.$inferSelect;
export type InsertLinkedinContent = typeof linkedinContent.$inferInsert;

/**
 * User Profile for JobH - extended user settings
 */
export const jobhUserProfiles = mysqlTable("jobh_user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  
  // Onboarding status
  onboardingCompleted: int("onboardingCompleted").default(0),
  onboardingStep: int("onboardingStep").default(1),
  
  // Target job info
  targetJobTitle: varchar("targetJobTitle", { length: 256 }),
  targetIndustry: varchar("targetIndustry", { length: 128 }),
  experienceLevel: varchar("experienceLevel", { length: 64 }),
  
  // LinkedIn profile
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  linkedinHeadline: text("linkedinHeadline"),
  linkedinAbout: text("linkedinAbout"),
  
  // Progress tracking
  resumesCreated: int("resumesCreated").default(0),
  jobsTracked: int("jobsTracked").default(0),
  interviewsCompleted: int("interviewsCompleted").default(0),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JobhUserProfile = typeof jobhUserProfiles.$inferSelect;
export type InsertJobhUserProfile = typeof jobhUserProfiles.$inferInsert;


/**
 * AI Toolbox Generated Content History
 * Stores history of all AI-generated content (emails, cover letters, pitches, etc.)
 */
export const aiToolboxHistory = mysqlTable("ai_toolbox_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  // Content type
  type: mysqlEnum("type", ["email", "cover_letter", "elevator_pitch", "linkedin_headline", "linkedin_about"]).notNull(),
  
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
  trackedJobId: int("trackedJobId"),
  
  // User feedback
  isFavorite: int("isFavorite").default(0),
  isUsed: int("isUsed").default(0), // User copied/used this content
  rating: int("rating"), // 1-5 stars
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiToolboxHistory = typeof aiToolboxHistory.$inferSelect;
export type InsertAiToolboxHistory = typeof aiToolboxHistory.$inferInsert;


/**
 * Skill Analysis Cache - stores LLM skill analysis results for job-resume matching
 * Cache key is hash of (jobDescription + resumeId), expires after 24 hours
 */
export const skillAnalysisCache = mysqlTable("skill_analysis_cache", {
  id: int("id").autoincrement().primaryKey(),
  
  // Cache key (hash of jobDescription + resumeId)
  cacheKey: varchar("cacheKey", { length: 64 }).notNull().unique(),
  
  // Input references
  jobDescriptionHash: varchar("jobDescriptionHash", { length: 64 }).notNull(),
  resumeId: int("resumeId").notNull(),
  userId: int("userId").notNull(),
  
  // Job info (for display)
  jobTitle: varchar("jobTitle", { length: 256 }),
  company: varchar("company", { length: 256 }),
  jobUrl: varchar("jobUrl", { length: 512 }),
  
  // Analysis results
  score: int("score").notNull(), // 0-100 match score
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
