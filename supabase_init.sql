-- =====================================================
-- Supabase 数据库初始化 SQL
-- 在 Supabase SQL Editor 中执行此脚本
-- =====================================================

-- 1. 创建枚举类型
-- =====================================================

CREATE TYPE role AS ENUM ('user', 'admin');
CREATE TYPE source AS ENUM ('manual', 'linkedin', 'ai_generated', 'extension', 'import');
CREATE TYPE status AS ENUM ('pending', 'in_progress', 'completed', 'partial', 'success', 'failed');
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE type AS ENUM ('technical', 'behavioral', 'case', 'base', 'tailored', 'headline', 'about');
CREATE TYPE difficulty AS ENUM ('Easy', 'Medium', 'Hard');
CREATE TYPE tracked_job_status AS ENUM ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived');

-- 2. 核心用户表
-- =====================================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  "loginMethod" VARCHAR(64),
  role role NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. 用户偏好设置
-- =====================================================

CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "employmentTypes" JSON,
  "workMode" VARCHAR(32),
  location VARCHAR(256),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. 职位推荐
-- =====================================================

CREATE TABLE job_recommendations (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  company VARCHAR(256) NOT NULL,
  "companyId" VARCHAR(64),
  "companyLogo" VARCHAR(512),
  position VARCHAR(256) NOT NULL,
  location VARCHAR(256),
  "postedAt" TIMESTAMP,
  "matchPercentage" INTEGER DEFAULT 0,
  "salaryMin" NUMERIC(12, 2),
  "salaryMax" NUMERIC(12, 2),
  "jobType" VARCHAR(64),
  "workType" VARCHAR(64),
  "experienceLevel" VARCHAR(64),
  industry VARCHAR(128),
  description TEXT,
  "linkedinJobId" VARCHAR(64),
  "linkedinUrl" VARCHAR(512),
  "applyUrl" VARCHAR(512),
  source source DEFAULT 'manual',
  "scrapedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. 面试历史
-- =====================================================

CREATE TABLE interview_history (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  question TEXT NOT NULL,
  date TIMESTAMP NOT NULL DEFAULT NOW(),
  score INTEGER,
  "audioDuration" VARCHAR(32),
  "audioUrl" VARCHAR(512),
  "aiFeedback" JSON,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. 模拟面试会话
-- =====================================================

CREATE TABLE mock_sessions (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "jobId" INTEGER NOT NULL,
  status status NOT NULL DEFAULT 'pending',
  "matchScore" INTEGER,
  "totalQuestions" INTEGER DEFAULT 6,
  "currentQuestion" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. 模拟面试消息
-- =====================================================

CREATE TABLE mock_messages (
  id SERIAL PRIMARY KEY,
  "sessionId" INTEGER NOT NULL,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  "questionIndex" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. 评估报告
-- =====================================================

CREATE TABLE assessment_reports (
  id SERIAL PRIMARY KEY,
  "sessionId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "jobId" INTEGER NOT NULL,
  "matchScore" INTEGER NOT NULL,
  strengths JSON,
  improvements JSON,
  suggestions JSON,
  summary TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. 面试知识库
-- =====================================================

CREATE TABLE interview_knowledge_bases (
  id SERIAL PRIMARY KEY,
  company VARCHAR(256) NOT NULL,
  position VARCHAR(256) NOT NULL,
  "companyNormalized" VARCHAR(256) NOT NULL,
  "positionNormalized" VARCHAR(256) NOT NULL,
  "interviewProcess" JSON,
  "companyInfo" JSON,
  tips JSON,
  "sourceCount" INTEGER DEFAULT 0,
  "questionCount" INTEGER DEFAULT 0,
  "lastSearchedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL
);

-- 10. 面试题目
-- =====================================================

CREATE TABLE interview_questions (
  id SERIAL PRIMARY KEY,
  "knowledgeBaseId" INTEGER NOT NULL,
  type type NOT NULL,
  question TEXT NOT NULL,
  category VARCHAR(128),
  difficulty difficulty,
  frequency INTEGER DEFAULT 1,
  "sampleAnswer" TEXT,
  source VARCHAR(128) NOT NULL,
  "sourceUrl" VARCHAR(512),
  "reportedDate" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. 知识库搜索日志
-- =====================================================

CREATE TABLE knowledge_base_search_logs (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER,
  company VARCHAR(256) NOT NULL,
  position VARCHAR(256) NOT NULL,
  "knowledgeBaseId" INTEGER,
  "cacheHit" INTEGER DEFAULT 0,
  "searchDuration" INTEGER,
  "sourcesSearched" JSON,
  "resultsCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 12. LinkedIn 职位缓存
-- =====================================================

CREATE TABLE linkedin_job_cache (
  id SERIAL PRIMARY KEY,
  "linkedinJobId" VARCHAR(64) NOT NULL UNIQUE,
  "linkedinUrl" VARCHAR(512),
  company VARCHAR(256) NOT NULL,
  "companyLogo" VARCHAR(512),
  "companyLinkedinUrl" VARCHAR(512),
  title VARCHAR(256) NOT NULL,
  location VARCHAR(256),
  "workType" VARCHAR(64),
  "employmentType" VARCHAR(64),
  "experienceLevel" VARCHAR(64),
  description TEXT,
  requirements JSON,
  skills JSON,
  benefits JSON,
  "salaryMin" NUMERIC(12, 2),
  "salaryMax" NUMERIC(12, 2),
  "salaryCurrency" VARCHAR(8),
  "positionCategory" VARCHAR(128) NOT NULL,
  industry VARCHAR(128),
  "postedAt" TIMESTAMP,
  "scrapedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 13. 职位缓存抓取日志
-- =====================================================

CREATE TABLE job_cache_fetch_logs (
  id SERIAL PRIMARY KEY,
  "positionCategory" VARCHAR(128) NOT NULL,
  "searchQuery" VARCHAR(256) NOT NULL,
  "jobsFetched" INTEGER DEFAULT 0,
  "fetchDuration" INTEGER,
  status status DEFAULT 'completed',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 14. 收藏的问题
-- =====================================================

CREATE TABLE bookmarked_questions (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  topic VARCHAR(256) NOT NULL,
  question TEXT NOT NULL,
  difficulty difficulty DEFAULT 'Medium',
  "targetPosition" VARCHAR(256),
  category VARCHAR(64) DEFAULT 'uncategorized',
  notes TEXT,
  "practiceCount" INTEGER DEFAULT 0,
  "lastPracticedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 15. 简历表
-- =====================================================

CREATE TABLE resumes (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  title VARCHAR(256) NOT NULL,
  type type NOT NULL DEFAULT 'technical',
  "isDefault" INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  "targetJobId" INTEGER,
  "targetJobTitle" VARCHAR(256),
  "targetCompany" VARCHAR(256),
  "personalInfo" JSON,
  summary TEXT,
  experience JSON,
  education JSON,
  skills JSON,
  projects JSON,
  certifications JSON,
  awards JSON,
  publications JSON,
  volunteering JSON,
  "templateId" VARCHAR(64) DEFAULT 'default',
  "colorScheme" VARCHAR(64) DEFAULT 'professional',
  "fontSize" VARCHAR(32) DEFAULT 'medium',
  "sectionVisibility" JSON,
  "pdfUrl" VARCHAR(512),
  "pdfGeneratedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 16. 职位追踪表
-- =====================================================

CREATE TABLE tracked_jobs (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "jobTitle" VARCHAR(256) NOT NULL,
  "companyName" VARCHAR(256) NOT NULL,
  "jobUrl" VARCHAR(512),
  location VARCHAR(256),
  salary VARCHAR(128),
  description TEXT,
  status tracked_job_status NOT NULL DEFAULT 'saved',
  "columnOrder" INTEGER DEFAULT 0,
  "appliedAt" TIMESTAMP,
  "interviewDate" TIMESTAMP,
  notes TEXT,
  tags JSON,
  "contactName" VARCHAR(256),
  "contactEmail" VARCHAR(320),
  "contactPhone" VARCHAR(64),
  "skillMatch" INTEGER DEFAULT 0,
  "extractedSkills" JSON,
  source source DEFAULT 'manual',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 17. LinkedIn 内容生成
-- =====================================================

CREATE TABLE linkedin_content (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  type type NOT NULL,
  "inputKeywords" JSON,
  "inputTone" VARCHAR(64),
  "inputLanguage" VARCHAR(32) DEFAULT 'English',
  "inputProfile" VARCHAR(64),
  "generatedContent" TEXT NOT NULL,
  "isFavorite" INTEGER DEFAULT 0,
  "isUsed" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 18. JobH 用户配置
-- =====================================================

CREATE TABLE jobh_user_profiles (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL UNIQUE,
  "onboardingCompleted" INTEGER DEFAULT 0,
  "onboardingStep" INTEGER DEFAULT 1,
  "targetJobTitle" VARCHAR(256),
  "targetIndustry" VARCHAR(128),
  "experienceLevel" VARCHAR(64),
  "linkedinUrl" VARCHAR(512),
  "linkedinHeadline" TEXT,
  "linkedinAbout" TEXT,
  "resumesCreated" INTEGER DEFAULT 0,
  "jobsTracked" INTEGER DEFAULT 0,
  "interviewsCompleted" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 19. AI 工具箱历史
-- =====================================================

CREATE TABLE ai_toolbox_history (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  type type NOT NULL,
  "inputParams" JSON,
  "generatedContent" TEXT NOT NULL,
  "trackedJobId" INTEGER,
  "isFavorite" INTEGER DEFAULT 0,
  "isUsed" INTEGER DEFAULT 0,
  rating INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 20. 技能分析缓存
-- =====================================================

CREATE TABLE skill_analysis_cache (
  id SERIAL PRIMARY KEY,
  "cacheKey" VARCHAR(64) NOT NULL UNIQUE,
  "jobDescriptionHash" VARCHAR(64) NOT NULL,
  "resumeId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "jobTitle" VARCHAR(256),
  company VARCHAR(256),
  "jobUrl" VARCHAR(512),
  score INTEGER NOT NULL,
  "strongMatch" JSON NOT NULL,
  "partialMatch" JSON NOT NULL,
  missing JSON NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMP NOT NULL
);

-- 21. 分析事件表
-- =====================================================

CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  user_id VARCHAR(100),
  session_id VARCHAR(100) NOT NULL,
  properties JSONB,
  page_url TEXT,
  page_title VARCHAR(255),
  referrer TEXT,
  user_agent TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_name ON analytics_events(event_name);
CREATE INDEX idx_user_id ON analytics_events(user_id);
CREATE INDEX idx_session_id ON analytics_events(session_id);
CREATE INDEX idx_created_at ON analytics_events(created_at);

-- 22. 分析会话表
-- =====================================================

CREATE TABLE analytics_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL UNIQUE,
  user_id VARCHAR(100),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
  page_views INTEGER NOT NULL DEFAULT 0,
  events_count INTEGER NOT NULL DEFAULT 0,
  device_type VARCHAR(50),
  browser VARCHAR(50),
  os VARCHAR(50),
  country VARCHAR(100)
);

CREATE INDEX idx_analytics_session_id ON analytics_sessions(session_id);
CREATE INDEX idx_analytics_user_id ON analytics_sessions(user_id);
CREATE INDEX idx_started_at ON analytics_sessions(started_at);

-- =====================================================
-- 初始化完成！
-- =====================================================
