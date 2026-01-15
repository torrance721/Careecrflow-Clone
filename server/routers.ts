import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { 
  getUserPreferences, 
  upsertUserPreferences, 
  getJobRecommendations, 
  createJobRecommendation,
  deleteJobRecommendations,
  getInterviewHistory,
  createInterviewHistory,
  getInterviewHistoryById,
  deleteInterviewHistory,
  createMockSession,
  getMockSession,
  getMockSessionsByUser,
  updateMockSession,
  createMockMessage,
  getMockMessages,
  createAssessmentReport,
  getAssessmentReport,
  getAssessmentReportsByUser,
  getJobRecommendationById,
  bulkCreateLinkedInJobs,
  deleteLinkedInJobs,
  getLinkedInJobByJobId,
  getLinkedInJobCacheBySearch
} from "./db";
import { scrapeLinkedInJobs, scrapeLinkedInCompany, isApifyConfigured, getApifyAccountInfo, LinkedInCompany } from "./apify";
import { invokeLLM } from "./_core/llm";
import { parseResume } from "./resumeParser";
import { 
  getOrCreateKnowledgeBase,
  getKnowledgeBaseById,
  getAllKnowledgeBases,
  getSearchStatistics,
  generateInterviewSystemPrompt,
  generateInterviewPlan,
  generateHint,
  generateInterviewResponse,
  // ReAct Agent Integration
  generateHintSmart,
  generateNextQuestionSmart,
  getIntegrationConfig,
} from "./agents";

import { 
  createBookmarkedQuestion, 
  getBookmarkedQuestions, 
  deleteBookmarkedQuestion,
  updateBookmarkedQuestionPractice,
  isQuestionBookmarked,
  updateBookmarkedQuestionNotes,
  updateBookmarkedQuestionCategory,
  getBookmarkedQuestionsByCategory,
  getBookmarkCategories
} from "./db";

export const appRouter = router({
  system: systemRouter,
  
  // Bookmarked Questions
  bookmarks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getBookmarkedQuestions(ctx.user.id);
    }),
    
    add: protectedProcedure
      .input(z.object({
        topic: z.string(),
        question: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        targetPosition: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return createBookmarkedQuestion({
          userId: ctx.user.id,
          ...input,
        });
      }),
    
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteBookmarkedQuestion(input.id, ctx.user.id);
      }),
    
    practice: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return updateBookmarkedQuestionPractice(input.id, ctx.user.id);
      }),
    
    isBookmarked: protectedProcedure
      .input(z.object({
        topic: z.string(),
        question: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        return isQuestionBookmarked(ctx.user.id, input.topic, input.question);
      }),
    
    updateNotes: protectedProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateBookmarkedQuestionNotes(input.id, ctx.user.id, input.notes);
      }),
    
    updateCategory: protectedProcedure
      .input(z.object({
        id: z.number(),
        category: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateBookmarkedQuestionCategory(input.id, ctx.user.id, input.category);
      }),
    
    listByCategory: protectedProcedure
      .input(z.object({ category: z.string() }))
      .query(async ({ ctx, input }) => {
        return getBookmarkedQuestionsByCategory(ctx.user.id, input.category);
      }),
    
    categories: protectedProcedure.query(async ({ ctx }) => {
      return getBookmarkCategories(ctx.user.id);
    }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // User Preferences
  preferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getUserPreferences(ctx.user.id);
    }),

    save: protectedProcedure
      .input(z.object({
        employmentTypes: z.array(z.string()).optional(),
        workMode: z.string().optional(),
        location: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return upsertUserPreferences(ctx.user.id, input);
      }),
  }),

  // Job Recommendations
  jobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getJobRecommendations(ctx.user.id);
    }),

    // Generate job recommendations using Apify LinkedIn scraper
    // Falls back to cached data if Apify fails
    generateRecommendations: protectedProcedure.mutation(async ({ ctx }) => {
      // Clear existing recommendations
      await deleteJobRecommendations(ctx.user.id);
      
      // Get user preferences
      const prefs = await getUserPreferences(ctx.user.id);
      
      // Build search params from user preferences
      const searchParams = {
        title: "Software Engineer", // Default title, can be customized based on user profile
        location: prefs?.location || "United States",
        rows: 20,
        workType: prefs?.workMode as 'onsite' | 'remote' | 'hybrid' | undefined,
      };
      
      try {
        // Check if Apify is configured
        if (!isApifyConfigured()) {
          console.log('[Jobs] Apify not configured, using cached data');
          throw new Error('Apify not configured');
        }
        
        // Scrape real jobs from LinkedIn via Apify
        console.log('[Jobs] Fetching real jobs from Apify...');
        const linkedInJobs = await scrapeLinkedInJobs(searchParams);
        
        if (linkedInJobs.length === 0) {
          throw new Error('No jobs returned from Apify');
        }
        
        // Convert and save to database
        for (const job of linkedInJobs) {
          await createJobRecommendation({
            userId: ctx.user.id,
            company: job.company,
            companyId: job.companyId,
            companyLogo: job.companyLogo,
            position: job.title,
            location: job.location,
            postedAt: job.postedAt ? new Date(job.postedAt) : new Date(),
            matchPercentage: Math.floor(Math.random() * 20) + 70, // 70-90% match
            salaryMin: job.salaryMin?.toString(),
            salaryMax: job.salaryMax?.toString(),
            jobType: job.jobType || prefs?.employmentTypes?.[0] || "Full-time",
            workType: job.workType,
            experienceLevel: job.experienceLevel,
            description: job.description,
            linkedinJobId: job.jobId,
            linkedinUrl: job.linkedinUrl,
            applyUrl: job.applyUrl,
            source: 'linkedin',
            scrapedAt: new Date(),
          });
        }
        
        console.log(`[Jobs] Successfully saved ${linkedInJobs.length} real jobs from Apify`);
        return { success: true, count: linkedInJobs.length, source: 'apify' as const };
      } catch (error) {
        // Fallback: Use cached LinkedIn jobs from database
        console.error('[Jobs] Apify scrape failed, using cached data:', error);
        
        const cachedJobs = await getLinkedInJobCacheBySearch(searchParams.title, searchParams.location, 20);
        
        if (cachedJobs.length > 0) {
          for (const job of cachedJobs) {
            await createJobRecommendation({
              userId: ctx.user.id,
              company: job.company,
              companyId: job.companyId,
              companyLogo: job.companyLogo,
              position: job.position,
              location: job.location,
              postedAt: job.postedAt,
              matchPercentage: Math.floor(Math.random() * 20) + 70,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              jobType: job.jobType,
              workType: job.workType,
              experienceLevel: job.experienceLevel,
              description: job.description,
              linkedinJobId: job.linkedinJobId,
              linkedinUrl: job.linkedinUrl,
              applyUrl: job.applyUrl,
              source: 'linkedin',
              scrapedAt: job.scrapedAt,
            });
          }
          console.log(`[Jobs] Successfully saved ${cachedJobs.length} cached jobs`);
          return { success: true, count: cachedJobs.length, source: 'cache' as const };
        }
        
        // Final fallback: Generate sample data for demo purposes
        console.log('[Jobs] No cached data available, generating sample data');
        const sampleJobs = [
          {
            userId: ctx.user.id,
            company: "Tech Company",
            position: "Software Engineer",
            location: prefs?.location || "United States",
            postedAt: new Date(),
            matchPercentage: 85,
            jobType: "Full-time",
            description: "Join our team to build innovative software solutions.",
            source: 'ai_generated' as const,
          },
        ];
        
        for (const job of sampleJobs) {
          await createJobRecommendation(job);
        }
        
        return { success: true, count: sampleJobs.length, source: 'fallback' as const };
      }
    }),
    
    // Legacy mock endpoint (deprecated, use generateRecommendations instead)
    // Note: This endpoint now directly calls the same logic as generateRecommendations
    generateMock: protectedProcedure.mutation(async ({ ctx }) => {
      // Clear existing recommendations
      await deleteJobRecommendations(ctx.user.id);
      
      // Get user preferences
      const prefs = await getUserPreferences(ctx.user.id);
      
      // Build search params from user preferences
      const searchParams = {
        title: "Software Engineer",
        location: prefs?.location || "United States",
        rows: 20,
        workType: prefs?.workMode as 'onsite' | 'remote' | 'hybrid' | undefined,
      };
      
      try {
        if (!isApifyConfigured()) {
          throw new Error('Apify not configured');
        }
        
        const linkedInJobs = await scrapeLinkedInJobs(searchParams);
        
        if (linkedInJobs.length === 0) {
          throw new Error('No jobs returned from Apify');
        }
        
        for (const job of linkedInJobs) {
          await createJobRecommendation({
            userId: ctx.user.id,
            company: job.company,
            companyId: job.companyId,
            companyLogo: job.companyLogo,
            position: job.title,
            location: job.location,
            postedAt: job.postedAt ? new Date(job.postedAt) : new Date(),
            matchPercentage: Math.floor(Math.random() * 20) + 70,
            salaryMin: job.salaryMin?.toString(),
            salaryMax: job.salaryMax?.toString(),
            jobType: job.jobType || prefs?.employmentTypes?.[0] || "Full-time",
            workType: job.workType,
            experienceLevel: job.experienceLevel,
            description: job.description,
            linkedinJobId: job.jobId,
            linkedinUrl: job.linkedinUrl,
            applyUrl: job.applyUrl,
            source: 'linkedin',
            scrapedAt: new Date(),
          });
        }
        
        return { success: true, count: linkedInJobs.length };
      } catch (error) {
        // Fallback to cached data
        const cachedJobs = await getLinkedInJobCacheBySearch(searchParams.title, searchParams.location, 20);
        
        if (cachedJobs.length > 0) {
          for (const job of cachedJobs) {
            await createJobRecommendation({
              userId: ctx.user.id,
              company: job.company,
              position: job.position,
              location: job.location,
              postedAt: job.postedAt,
              matchPercentage: Math.floor(Math.random() * 20) + 70,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              jobType: job.jobType,
              description: job.description,
              linkedinJobId: job.linkedinJobId,
              linkedinUrl: job.linkedinUrl,
              source: 'linkedin',
            });
          }
          return { success: true, count: cachedJobs.length };
        }
        
        // Final fallback: sample data
        const sampleJob = {
          userId: ctx.user.id,
          company: "Tech Company",
          position: "Software Engineer",
          location: prefs?.location || "United States",
          postedAt: new Date(),
          matchPercentage: 85,
          jobType: "Full-time",
          description: "Join our team to build innovative software solutions.",
          source: 'ai_generated' as const,
        };
        await createJobRecommendation(sampleJob);
        return { success: true, count: 1 };
      }
    }),

    // LinkedIn Jobs Scraping
    scrapeLinkedIn: protectedProcedure
      .input(z.object({
        title: z.string(),
        location: z.string().optional(),
        rows: z.number().optional().default(20),
        workType: z.enum(['onsite', 'remote', 'hybrid']).optional(),
        contractType: z.enum(['fulltime', 'parttime', 'contract', 'temporary', 'internship', 'volunteer']).optional(),
        experienceLevel: z.enum(['entry', 'associate', 'mid', 'senior', 'director']).optional(),
        publishedAt: z.enum(['30days', '7days', '24hours']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if Apify is configured
        if (!isApifyConfigured()) {
          throw new Error('Apify API is not configured. Please add APIFY_API_TOKEN to your environment.');
        }

        // Get user preferences for location if not provided
        const prefs = await getUserPreferences(ctx.user.id);
        const location = input.location || prefs?.location || 'United States';

        // Scrape LinkedIn jobs
        const scrapedJobs = await scrapeLinkedInJobs({
          title: input.title,
          location,
          rows: input.rows,
          workType: input.workType,
          contractType: input.contractType,
          experienceLevel: input.experienceLevel,
          publishedAt: input.publishedAt,
        });

        if (scrapedJobs.length === 0) {
          return { success: true, count: 0, message: 'No jobs found matching your criteria' };
        }

        // Delete existing LinkedIn jobs for this user (refresh)
        await deleteLinkedInJobs(ctx.user.id);

        // Transform and save jobs to database
        const jobsToInsert = scrapedJobs.map(job => ({
          userId: ctx.user.id,
          company: job.company,
          companyId: job.companyId,
          companyLogo: job.companyLogo,
          position: job.title,
          location: job.location,
          description: job.description,
          salaryMin: job.salaryMin ? String(job.salaryMin) : undefined,
          salaryMax: job.salaryMax ? String(job.salaryMax) : undefined,
          jobType: job.jobType,
          workType: job.workType,
          experienceLevel: job.experienceLevel,
          linkedinJobId: job.jobId,
          linkedinUrl: job.linkedinUrl,
          applyUrl: job.applyUrl,
          matchPercentage: Math.floor(Math.random() * 20) + 70, // Random match 70-90% for now
        }));

        const insertedCount = await bulkCreateLinkedInJobs(jobsToInsert);

        return { 
          success: true, 
          count: insertedCount,
          message: `Successfully scraped ${insertedCount} jobs from LinkedIn`
        };
      }),

    // Check Apify configuration status
    apifyStatus: protectedProcedure.query(async () => {
      if (!isApifyConfigured()) {
        return { configured: false, message: 'APIFY_API_TOKEN not set' };
      }
      return getApifyAccountInfo();
    }),

    // Scrape LinkedIn company information
    scrapeCompany: protectedProcedure
      .input(z.object({
        companyUrls: z.array(z.string()).min(1).max(10),
      }))
      .mutation(async ({ input }) => {
        if (!isApifyConfigured()) {
          throw new Error('Apify API is not configured. Please add APIFY_API_TOKEN to your environment.');
        }

        const companies = await scrapeLinkedInCompany(input.companyUrls);
        return { 
          success: true, 
          companies,
          count: companies.length 
        };
      }),
  }),

  // Interview History
  interviews: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getInterviewHistory(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getInterviewHistoryById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        question: z.string(),
        score: z.number().optional(),
        audioDuration: z.string().optional(),
        audioUrl: z.string().optional(),
        aiFeedback: z.object({
          scoreReason: z.string().optional(),
          interviewerIntent: z.string().optional(),
          capabilityAssessed: z.string().optional(),
          whatToAnswer: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createInterviewHistory({
          userId: ctx.user.id,
          question: input.question,
          score: input.score,
          audioDuration: input.audioDuration,
          audioUrl: input.audioUrl,
          aiFeedback: input.aiFeedback,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteInterviewHistory(input.id);
        return { success: true };
      }),

    // Generate mock interview history
    generateMock: protectedProcedure.mutation(async ({ ctx }) => {
      const mockInterviews = [
        {
          userId: ctx.user.id,
          question: "What challenges have you encountered in UI automation, and how did you address them?",
          date: new Date("2025-12-31"),
          score: 7,
          audioDuration: "1m:9s",
          audioUrl: "",
          aiFeedback: {
            scoreReason: "Good coverage of common technical challenges & standard solutions (POM, explicit waits, data seeding). Strategic thinking shown by pushing coverage to API/unit tests is strong. Delivery (pace, pronunciation) could be clearer.",
            interviewerIntent: "Problem-solving, technical depth, critical thinking, strategic test approach, collaboration, and learning from experience.",
            capabilityAssessed: "Problem-solving, technical depth, critical thinking, strategic test approach, collaboration, and learning from experience.",
            whatToAnswer: "Specific challenges, concrete actions taken, the impact of those actions, and lessons learned. Demonstrate structured problem-solving.",
          },
        },
        {
          userId: ctx.user.id,
          question: "Can you describe how you used boundary value analysis when designing test cases for the OA System project?",
          date: new Date("2025-12-31"),
          score: 7,
          audioDuration: "0m:55s",
          audioUrl: "",
          aiFeedback: {
            scoreReason: "Good explanation of BVA with practical examples (input fields, workflows) and clear benefits. Shows structured thinking. Could better link to user/business impact and resource optimization for a stronger PM perspective.",
            interviewerIntent: "Assesses structured thinking, technical understanding of quality assurance, risk mitigation, and ability to translate technical concepts into practical application and business impact.",
            capabilityAssessed: "Structured thinking, technical understanding of quality assurance, risk mitigation, and ability to translate technical concepts into practical application.",
            whatToAnswer: "Explain BVA concept, provide specific examples from your project, quantify the impact, and connect to business value.",
          },
        },
      ];

      for (const interview of mockInterviews) {
        await createInterviewHistory(interview);
      }

      return { success: true, count: mockInterviews.length };
    }),
  }),

  // Mock Interview Sessions
  mockInterview: router({
    // Create a new mock interview session
    createSession: protectedProcedure
      .input(z.object({ jobId: z.number(), language: z.enum(['en', 'zh']).optional().default('en') }))
      .mutation(async ({ ctx, input }) => {
        const job = await getJobRecommendationById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        const session = await createMockSession({
          userId: ctx.user.id,
          jobId: input.jobId,
          status: "in_progress",
          totalQuestions: 6,
          currentQuestion: 1,
        });

        if (!session) {
          throw new Error("Failed to create session");
        }

        // Generate the first question based on job requirements
        const isZh = input.language === 'zh';
        const systemPrompt = isZh 
          ? `你是 UHired 的面试助手。你的目标是通过友好的对话帮助用户了解自己与特定职位的匹配度。

职位：${job.position} @ ${job.company}
职位描述：${job.description}
地点：${job.location}
薪资范围：$${job.salaryMin} - $${job.salaryMax}

重要指南：
1. 这不是考试 - 这是一次信息收集对话
2. 要友好、支持和鼓励
3. 提出帮助用户表达经验的问题
4. 用户可以粘贴链接、分享作品集或详细描述项目
5. 专注于了解他们的实际能力，而不是测试面试技巧
6. 生成评估该职位所需关键技能的问题

请用中文回复。以热情的问候开始，然后提出第一个关于他们相关经验的问题。`
          : `You are UHired's interview assistant. Your goal is to help users understand their fit for a specific job position through a friendly conversation.

Job Position: ${job.position} at ${job.company}
Job Description: ${job.description}
Location: ${job.location}
Salary Range: $${job.salaryMin} - $${job.salaryMax}

IMPORTANT GUIDELINES:
1. This is NOT an exam - it's an information gathering conversation
2. Be friendly, supportive, and encouraging
3. Ask questions that help the user articulate their experience
4. Users can paste links, share portfolio items, or describe projects in detail
5. Focus on understanding their actual capabilities, not testing their interview skills
6. Generate questions that assess key skills required for this role

Start with a warm greeting and your first question about their relevant experience.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Start the mock interview" }
          ]
        });

        const aiMessageContent = response.choices[0]?.message?.content;
        const aiMessage = typeof aiMessageContent === 'string' ? aiMessageContent : "Hello! Let's start by discussing your background. Can you tell me about a recent project you've worked on?";

        // Save the AI's first message
        await createMockMessage({
          sessionId: session.id,
          role: "assistant",
          content: aiMessage,
          questionIndex: 1,
        });

        return { session, firstMessage: aiMessage, job };
      }),

    // Get session details
    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getMockSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }
        const messages = await getMockMessages(input.sessionId);
        const job = await getJobRecommendationById(session.jobId);
        return { session, messages, job };
      }),

    // List user's sessions
    listSessions: protectedProcedure.query(async ({ ctx }) => {
      return getMockSessionsByUser(ctx.user.id);
    }),

    // Send a message in the conversation
    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        content: z.string(),
        language: z.enum(['en', 'zh']).optional().default('en'),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getMockSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }
        if (session.status === "completed") {
          throw new Error("Session already completed");
        }

        const job = await getJobRecommendationById(session.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        // Save user's message
        await createMockMessage({
          sessionId: input.sessionId,
          role: "user",
          content: input.content,
        });

        // Get conversation history
        const messages = await getMockMessages(input.sessionId);
        const conversationHistory = messages.map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content
        }));

        // Determine if we should ask a follow-up or move to next question
        const currentQ = session.currentQuestion || 1;
        const totalQ = session.totalQuestions || 6;
        const shouldEnd = currentQ >= totalQ && messages.filter(m => m.role === "user").length >= totalQ;

        const isZh = input.language === 'zh';
        
        // Try to find knowledge base for this job
        let knowledgeBaseId: number | undefined;
        try {
          const allKbs = await getAllKnowledgeBases();
          const matchingKb = allKbs.find(kb => 
            kb.company.toLowerCase() === job.company.toLowerCase() ||
            kb.position.toLowerCase() === job.position.toLowerCase()
          );
          knowledgeBaseId = matchingKb?.id;
        } catch (error) {
          console.error('[sendMessage] Error finding knowledge base:', error);
        }

        // Use enhanced next question generator
        let aiMessage: string;
        try {
          aiMessage = await generateInterviewResponse({
            job: {
              company: job.company,
              position: job.position,
              description: job.description || '',
            },
            conversationHistory,
            currentQuestion: currentQ,
            totalQuestions: totalQ,
            knowledgeBaseId,
            language: isZh ? 'zh' : 'en',
            userResponse: input.content,
          });
        } catch (error) {
          console.error('[sendMessage] Error generating response:', error);
          // Fallback to basic LLM call
          const systemPrompt = isZh
            ? `你是 UHired 的面试助手，正在进行模拟面试。

职位：${job.position} @ ${job.company}
职位描述：${job.description}

当前进度：第 ${currentQ} 个问题，共 ${totalQ} 个
${shouldEnd ? "这是最后的回复。总结你了解到的内容，并告诉用户你将生成评估报告。" : ""}

指南：
1. 这是信息收集，不是考试
2. 要支持和鼓励
3. 如果用户的回答简短，追问以获取更多细节
4. 如果回答全面，认可并进入下一个话题
5. 关注：技术技能、项目经验、问题解决、团队协作
6. 记住：用户可以分享链接、作品集或详细描述

请用中文回复。`
            : `You are UHired's interview assistant conducting a mock interview.

Job Position: ${job.position} at ${job.company}
Job Description: ${job.description}

Current Progress: Question ${currentQ} of ${totalQ}
${shouldEnd ? "This is the final response. Summarize what you've learned and let the user know you'll generate an assessment report." : ""}

GUIDELINES:
1. This is information gathering, NOT an exam
2. Be supportive and encouraging
3. If the user's answer is brief, ask a follow-up to get more details
4. If the answer is comprehensive, acknowledge it and move to the next topic
5. Focus on: technical skills, project experience, problem-solving, collaboration
6. Remember: users can share links, portfolios, or detailed descriptions

Based on the conversation so far, provide your next response.`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory,
            ]
          });

          const aiMessageContent = response.choices[0]?.message?.content;
          aiMessage = typeof aiMessageContent === 'string' ? aiMessageContent : "Thank you for sharing. Could you tell me more about that?";
        }

        // Save AI's response
        const nextQuestion = currentQ < totalQ ? currentQ + 1 : currentQ;
        await createMockMessage({
          sessionId: input.sessionId,
          role: "assistant",
          content: aiMessage,
          questionIndex: nextQuestion,
        });

        // Update session progress
        await updateMockSession(input.sessionId, {
          currentQuestion: nextQuestion,
          status: shouldEnd ? "completed" : "in_progress",
          completedAt: shouldEnd ? new Date() : undefined,
        });

        return { 
          message: aiMessage, 
          currentQuestion: nextQuestion,
          isComplete: shouldEnd,
        };
      }),

    // End session and generate report
    endSession: protectedProcedure
      .input(z.object({ sessionId: z.number(), language: z.enum(['en', 'zh']).optional().default('en') }))
      .mutation(async ({ ctx, input }) => {
        const session = await getMockSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }

        const job = await getJobRecommendationById(session.jobId);
        if (!job) {
          throw new Error("Job not found");
        }

        const messages = await getMockMessages(input.sessionId);
        const conversationHistory = messages.map(m => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`).join("\n\n");

        // Generate assessment report using LLM
        const isZh = input.language === 'zh';
        const assessmentPrompt = isZh
          ? `基于以下模拟面试对话，生成详细的评估报告。

职位：${job.position} @ ${job.company}
职位要求：${job.description}

对话内容：
${conversationHistory}

生成以下结构的 JSON 响应（所有文本内容用中文）：
{
  "matchScore": <0-100的数字>,
  "strengths": [
    { "skill": "<技能名称>", "description": "<为什么这是优势>" }
  ],
  "improvements": [
    { "skill": "<技能名称>", "description": "<需要改进的地方>", "priority": "high|medium|low" }
  ],
  "suggestions": [
    { "topic": "<学习主题>", "resource": "<建议资源>", "estimatedTime": "<时间估计>" }
  ],
  "summary": "<2-3句的整体评估>"
}

要建设性和有帮助。专注于可操作的见解。`
          : `Based on the following mock interview conversation, generate a detailed assessment report.

Job Position: ${job.position} at ${job.company}
Job Requirements: ${job.description}

Conversation:
${conversationHistory}

Generate a JSON response with the following structure:
{
  "matchScore": <number 0-100>,
  "strengths": [
    { "skill": "<skill name>", "description": "<why this is a strength>" }
  ],
  "improvements": [
    { "skill": "<skill name>", "description": "<what needs improvement>", "priority": "high|medium|low" }
  ],
  "suggestions": [
    { "topic": "<learning topic>", "resource": "<suggested resource>", "estimatedTime": "<time estimate>" }
  ],
  "summary": "<2-3 sentence overall assessment>"
}

Be constructive and helpful. Focus on actionable insights.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: isZh ? "你是一位专业的职业教练。仅以有效的 JSON 格式生成评估报告。所有文本内容用中文。" : "You are an expert career coach. Generate assessment reports in valid JSON format only." },
            { role: "user", content: assessmentPrompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "assessment_report",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  matchScore: { type: "integer", description: "Match score 0-100" },
                  strengths: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        skill: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["skill", "description"],
                      additionalProperties: false
                    }
                  },
                  improvements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        skill: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] }
                      },
                      required: ["skill", "description", "priority"],
                      additionalProperties: false
                    }
                  },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        topic: { type: "string" },
                        resource: { type: "string" },
                        estimatedTime: { type: "string" }
                      },
                      required: ["topic", "resource", "estimatedTime"],
                      additionalProperties: false
                    }
                  },
                  summary: { type: "string" }
                },
                required: ["matchScore", "strengths", "improvements", "suggestions", "summary"],
                additionalProperties: false
              }
            }
          }
        });

        let assessment;
        try {
          const responseContent = response.choices[0]?.message?.content;
          const contentStr = typeof responseContent === 'string' ? responseContent : '{}';
          assessment = JSON.parse(contentStr);
        } catch {
          assessment = {
            matchScore: 70,
            strengths: [{ skill: "Communication", description: "Good at explaining concepts" }],
            improvements: [{ skill: "Technical depth", description: "Could provide more specific examples", priority: "medium" as const }],
            suggestions: [{ topic: "System Design", resource: "System Design Interview book", estimatedTime: "2-4 weeks" }],
            summary: "The candidate shows potential but needs to demonstrate more specific technical experience."
          };
        }

        // Save assessment report
        const report = await createAssessmentReport({
          sessionId: input.sessionId,
          userId: ctx.user.id,
          jobId: session.jobId,
          matchScore: assessment.matchScore,
          strengths: assessment.strengths,
          improvements: assessment.improvements,
          suggestions: assessment.suggestions,
          summary: assessment.summary,
        });

        // Update session
        await updateMockSession(input.sessionId, {
          status: "completed",
          matchScore: assessment.matchScore,
          completedAt: new Date(),
        });

        return { report, job };
      }),

    // Get assessment report
    getReport: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const session = await getMockSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }
        const report = await getAssessmentReport(input.sessionId);
        const job = await getJobRecommendationById(session.jobId);
        return { report, job, session };
      }),

    // List all reports for user
    listReports: protectedProcedure.query(async ({ ctx }) => {
      return getAssessmentReportsByUser(ctx.user.id);
    }),

    // Get a hint for the current question
    getHint: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        currentQuestion: z.string(),
        userResponse: z.string().optional(),
        language: z.enum(['en', 'zh']).optional().default('en'),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getMockSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }

        const messages = await getMockMessages(input.sessionId);
        const conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

        // Get knowledge base ID from session if available
        // For now, we'll try to find it from the job
        const job = await getJobRecommendationById(session.jobId);
        let knowledgeBaseId: number | undefined;
        
        if (job) {
          // Try to find existing knowledge base for this company/position
          const allKbs = await getAllKnowledgeBases();
          const matchingKb = allKbs.find(kb => 
            kb.company.toLowerCase() === job.company.toLowerCase() ||
            kb.position.toLowerCase() === job.position.toLowerCase()
          );
          knowledgeBaseId = matchingKb?.id;
        }

        // Use ReAct-enhanced hint generation (with fallback)
        const hint = await generateHintSmart({
          question: input.currentQuestion,
          userResponse: input.userResponse,
          conversationHistory,
          knowledgeBaseId,
          language: input.language,
        });

        return hint;
      }),
  }),

  // Onboarding flow
  onboarding: router({
    // Parse resume file
    parseResume: protectedProcedure
      .input(z.object({
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { fileData, mimeType, filename } = input;
        
        try {
          // Decode base64 to buffer
          const buffer = Buffer.from(fileData, 'base64');
          
          // Parse the resume
          const result = await parseResume(buffer, mimeType, filename);
          
          return {
            success: true,
            text: result.text,
            metadata: result.metadata,
          };
        } catch (error) {
          console.error("Failed to parse resume:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to parse resume",
            text: "",
          };
        }
      }),

    // Generate AI question based on dream job and resume
    generateQuestion: protectedProcedure
      .input(z.object({
        dreamJob: z.string(),
        resumeText: z.string().optional(),
        language: z.string().default("en"),
      }))
      .mutation(async ({ input }) => {
        const { dreamJob, resumeText, language } = input;
        const isZh = language === "zh";
        
        const systemPrompt = isZh
          ? `你是一个专业的求职辅导教练。用户想成为 "${dreamJob}"。
${resumeText ? `用户的简历摘要：${resumeText}` : "用户没有提供简历。"}

请生成一个简短友好的问题，让用户描述他们的情况。
要求：
1. 简短精炼，总字数不超过 80 字
2. 语气亲切自然
3. 引导用户分享背景和求职进展

只输出问题本身，不要列点、不要分条。`
          : `You are a professional career coach. The user wants to become a "${dreamJob}".
${resumeText ? `User's resume summary: ${resumeText}` : "User hasn't provided a resume."}

Generate a SHORT, friendly question to help the user describe their situation.
Requirements:
1. Keep it brief - max 2 sentences, under 50 words total
2. Be warm and natural
3. Ask about their background and job search progress

Only output the question itself, no bullet points or numbered lists.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: isZh ? "请生成问题" : "Please generate the question" },
            ],
          });

          const question = response.choices[0]?.message?.content || 
            (isZh 
              ? "好的！现在说说你的情况吧，越详细越好。比如你的教育/工作背景、目前求职进展、最担心什么问题？"
              : "Great! Now tell me about your situation in detail. For example, your education/work background, current job search progress, and what concerns you most?");

          return { question };
        } catch (error) {
          console.error("Failed to generate question:", error);
          return {
            question: isZh 
              ? "好的！现在说说你的情况吧，越详细越好。比如你的教育/工作背景、目前求职进展、最担心什么问题？"
              : "Great! Now tell me about your situation in detail. For example, your education/work background, current job search progress, and what concerns you most?"
          };
        }
      }),

    // Start interview based on onboarding info (legacy - without knowledge base)
    startInterview: protectedProcedure
      .input(z.object({
        dreamJob: z.string(),
        resumeText: z.string().optional(),
        situation: z.string(),
        language: z.string().default("en"),
      }))
      .mutation(async ({ ctx, input }) => {
        const { dreamJob, resumeText, situation, language } = input;
        
        // Create a mock session with the onboarding context
        // First, create a temporary job recommendation for this dream job
        const tempJob = await createJobRecommendation({
          userId: ctx.user.id,
          company: "Dream Company",
          position: dreamJob,
          location: "Remote",
          matchPercentage: 85,
          description: `Target position: ${dreamJob}`,
          jobType: "Full-time",
          industry: "Technology",
        });

        if (!tempJob) {
          throw new Error("Failed to create job recommendation");
        }

        // Create mock session
        const session = await createMockSession({
          userId: ctx.user.id,
          jobId: tempJob.id,
          status: "in_progress",
        });

        if (!session) {
          throw new Error("Failed to create mock session");
        }

        // Create initial context message
        const isZh = language === "zh";
        const contextMessage = isZh
          ? `用户目标职位：${dreamJob}\n${resumeText ? `简历摘要：${resumeText}\n` : ""}用户情况：${situation}`
          : `Target position: ${dreamJob}\n${resumeText ? `Resume summary: ${resumeText}\n` : ""}User situation: ${situation}`;

        await createMockMessage({
          sessionId: session.id,
          role: "system",
          content: contextMessage,
        });

        return { sessionId: session.id };
      }),

    // Start interview with knowledge base (new - enhanced with real interview data)
    startInterviewWithKnowledge: protectedProcedure
      .input(z.object({
        dreamJob: z.string(),
        resumeText: z.string().optional(),
        situation: z.string(),
        language: z.string().default("en"),
        knowledgeBaseId: z.number().optional(),
        parsedCompany: z.string().optional(),
        parsedPosition: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { dreamJob, resumeText, situation, language, knowledgeBaseId, parsedCompany, parsedPosition } = input;
        const isZh = language === "zh";
        
        // Use parsed company/position if available, otherwise use dreamJob
        const company = parsedCompany || "Dream Company";
        const position = parsedPosition || dreamJob;
        
        // Create job recommendation with real company name if available
        const tempJob = await createJobRecommendation({
          userId: ctx.user.id,
          company: company,
          position: position,
          location: "Remote",
          matchPercentage: 85,
          description: `Target position: ${dreamJob}`,
          jobType: "Full-time",
          industry: "Technology",
        });

        if (!tempJob) {
          throw new Error("Failed to create job recommendation");
        }

        // Create mock session with knowledge base reference
        const session = await createMockSession({
          userId: ctx.user.id,
          jobId: tempJob.id,
          status: "in_progress",
        });

        if (!session) {
          throw new Error("Failed to create mock session");
        }

        // Build enhanced system prompt with knowledge base
        let systemPrompt = '';
        let interviewTips: string[] = [];
        
        if (knowledgeBaseId) {
          try {
            const promptResult = await generateInterviewSystemPrompt(
              company,
              position,
              `Target position: ${dreamJob}`,
              isZh ? 'zh' : 'en',
              ctx.user.id
            );
            systemPrompt = promptResult.systemPrompt;
            interviewTips = promptResult.interviewTips || [];
          } catch (error) {
            console.error('[Onboarding] Error generating system prompt:', error);
          }
        }
        
        // Fallback to basic system prompt if knowledge base failed
        if (!systemPrompt) {
          systemPrompt = isZh
            ? `你是 UHired 的面试助手。你的目标是通过友好的对话帮助用户了解自己与 ${position} 职位的匹配度。

重要指南：
1. 这不是考试 - 这是一次信息收集对话
2. 要友好、支持和鼓励
3. 提出帮助用户表达经验的问题

请用中文回复。以热情的问候开始，然后提出第一个关于他们相关经验的问题。`
            : `You are UHired's interview assistant. Your goal is to help users understand their fit for the ${position} position through a friendly conversation.

IMPORTANT GUIDELINES:
1. This is NOT an exam - it's an information gathering conversation
2. Be friendly, supportive, and encouraging
3. Ask questions that help the user articulate their experience

Start with a warm greeting and your first question about their relevant experience.`;
        }

        // Add user context to system prompt
        const userContext = isZh
          ? `\n\n用户背景：\n- 目标职位：${dreamJob}\n${resumeText ? `- 简历摘要：${resumeText}\n` : ''}- 当前情况：${situation || '未提供'}`
          : `\n\nUser Background:\n- Target: ${dreamJob}\n${resumeText ? `- Resume: ${resumeText}\n` : ''}- Situation: ${situation || 'Not provided'}`;
        
        systemPrompt += userContext;

        // Create system message with enhanced prompt
        await createMockMessage({
          sessionId: session.id,
          role: "system",
          content: systemPrompt,
        });

        return { 
          sessionId: session.id,
          knowledgeBaseId,
          interviewTips,
        };
      }),
  }),

  // Interview Knowledge Base
  knowledgeBase: router({
    // Get or create knowledge base for a company/position
    getOrCreate: protectedProcedure
      .input(z.object({
        company: z.string(),
        position: z.string(),
        forceRefresh: z.boolean().optional().default(false),
        language: z.enum(['en', 'zh']).optional().default('en'),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getOrCreateKnowledgeBase(
          input.company,
          input.position,
          {
            forceRefresh: input.forceRefresh,
            userId: ctx.user.id,
            language: input.language,
          }
        );

        return {
          id: result.knowledgeBase.id,
          company: result.knowledgeBase.company,
          position: result.knowledgeBase.position,
          questionCount: result.knowledgeBase.questionCount,
          sourceCount: result.knowledgeBase.sourceCount,
          interviewProcess: result.knowledgeBase.interviewProcess,
          companyInfo: result.knowledgeBase.companyInfo,
          tips: result.knowledgeBase.tips,
          questions: result.knowledgeBase.questions.map(q => ({
            id: q.id,
            type: q.type,
            question: q.question,
            category: q.category,
            difficulty: q.difficulty,
            frequency: q.frequency,
            sampleAnswer: q.sampleAnswer,
          })),
          cacheHit: result.cacheHit,
          searchDuration: result.searchDuration,
          expiresAt: result.knowledgeBase.expiresAt,
        };
      }),

    // Get knowledge base by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const kb = await getKnowledgeBaseById(input.id);
        if (!kb) {
          throw new Error('Knowledge base not found');
        }
        return {
          id: kb.id,
          company: kb.company,
          position: kb.position,
          questionCount: kb.questionCount,
          sourceCount: kb.sourceCount,
          interviewProcess: kb.interviewProcess,
          companyInfo: kb.companyInfo,
          tips: kb.tips,
          questions: kb.questions.map(q => ({
            id: q.id,
            type: q.type,
            question: q.question,
            category: q.category,
            difficulty: q.difficulty,
            frequency: q.frequency,
            sampleAnswer: q.sampleAnswer,
          })),
          expiresAt: kb.expiresAt,
        };
      }),

    // Generate interview plan with knowledge base
    generatePlan: protectedProcedure
      .input(z.object({
        company: z.string(),
        position: z.string(),
        jobDescription: z.string(),
        questionCount: z.number().optional().default(6),
        language: z.enum(['en', 'zh']).optional().default('en'),
        focusAreas: z.array(z.enum(['technical', 'behavioral', 'case'])).optional(),
        difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Mixed']).optional().default('Mixed'),
        userProfile: z.object({
          resumeSummary: z.string().optional(),
          skills: z.array(z.string()).optional(),
          experience: z.string().optional(),
          education: z.string().optional(),
          situation: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await generateInterviewPlan(
          input.company,
          input.position,
          input.jobDescription,
          input.userProfile || {},
          {
            questionCount: input.questionCount,
            language: input.language,
            focusAreas: input.focusAreas,
            difficulty: input.difficulty,
            userId: ctx.user.id,
          }
        );

        return plan;
      }),

    // Generate interview system prompt with knowledge base context
    generatePrompt: protectedProcedure
      .input(z.object({
        company: z.string(),
        position: z.string(),
        jobDescription: z.string(),
        language: z.enum(['en', 'zh']).optional().default('en'),
      }))
      .mutation(async ({ ctx, input }) => {
        return generateInterviewSystemPrompt(
          input.company,
          input.position,
          input.jobDescription,
          input.language,
          ctx.user.id
        );
      }),

    // Admin: List all knowledge bases
    listAll: protectedProcedure
      .query(async ({ ctx }) => {
        // Only allow admin users
        if (ctx.user.role !== 'admin') {
          throw new Error('Admin access required');
        }
        return getAllKnowledgeBases();
      }),

    // Admin: Get search statistics
    getStatistics: protectedProcedure
      .query(async ({ ctx }) => {
        // Only allow admin users
        if (ctx.user.role !== 'admin') {
          throw new Error('Admin access required');
        }
        return getSearchStatistics();
      }),
  }),

  // Topic Practice Mode (话题练习模式)
  topicPractice: router({
    // Start a new topic practice session
    startSession: protectedProcedure
      .input(z.object({
        targetPosition: z.string(),
        resumeText: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { startTopicPractice } = await import('./agents/interviewModes/topicPracticeRouter');
        return startTopicPractice(ctx.user.id, input.targetPosition, input.resumeText);
      }),

    // Send a message in the topic practice session
    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        message: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sendTopicMessage } = await import('./agents/interviewModes/topicPracticeRouter');
        return sendTopicMessage(input.sessionId, ctx.user.id, input.message);
      }),

    // End the topic practice session and get full assessment
    endSession: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { endTopicPractice } = await import('./agents/interviewModes/topicPracticeRouter');
        return endTopicPractice(input.sessionId, ctx.user.id);
      }),

    // Get current session state
    getSession: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const { getTopicPracticeSession } = await import('./agents/interviewModes/topicPracticeRouter');
        return getTopicPracticeSession(input.sessionId, ctx.user.id);
      }),
  }),

  // ==========================================
  // JobH Routes (Careerflow Clone)
  // ==========================================
  
  // Resume Builder
  resume: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getResumesByUser } = await import('./db');
      return getResumesByUser(ctx.user.id);
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getResumeById } = await import('./db');
        return getResumeById(input.id, ctx.user.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string(),
        type: z.enum(['base', 'tailored']).default('base'),
        targetJobTitle: z.string().optional(),
        targetCompany: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createResume } = await import('./db');
        return createResume({
          userId: ctx.user.id,
          title: input.title,
          type: input.type,
          targetJobTitle: input.targetJobTitle,
          targetCompany: input.targetCompany,
        });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        personalInfo: z.any().optional(),
        summary: z.string().optional(),
        experience: z.any().optional(),
        education: z.any().optional(),
        skills: z.any().optional(),
        projects: z.any().optional(),
        certifications: z.any().optional(),
        awards: z.any().optional(),
        publications: z.any().optional(),
        volunteering: z.any().optional(),
        templateId: z.string().optional(),
        colorScheme: z.string().optional(),
        fontSize: z.string().optional(),
        sectionVisibility: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateResume } = await import('./db');
        const { id, ...data } = input;
        return updateResume(id, ctx.user.id, data);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteResume } = await import('./db');
        const success = await deleteResume(input.id, ctx.user.id);
        return { success };
      }),
    
    // AI-powered resume improvement
    improveSection: protectedProcedure
      .input(z.object({
        section: z.string(),
        content: z.string(),
        targetJob: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert resume writer. Improve the following ${input.section} section to be more impactful, using action verbs and quantifiable achievements. ${input.targetJob ? `Tailor it for a ${input.targetJob} position.` : ''} Return only the improved text, no explanations.`
            },
            {
              role: 'user',
              content: input.content
            }
          ]
        });
        return { improved: response.choices[0]?.message?.content || input.content };
      }),
    
    // Generate resume preview HTML
    preview: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getResumeById } = await import('./db');
        const { generateResumeHTML } = await import('./resumePdfGenerator');
        const resume = await getResumeById(input.id, ctx.user.id);
        if (!resume) return { html: '' };
        return { html: generateResumeHTML(resume) };
      }),
    
    // Generate PDF download
    generatePdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getResumeById } = await import('./db');
        const { generateResumePDF } = await import('./resumePdfGenerator');
        const resume = await getResumeById(input.id, ctx.user.id);
        if (!resume) return { html: '', filename: '' };
        return generateResumePDF(resume);
      }),
    
    // Calculate resume score with detailed breakdown
    calculateScore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getResumeById, updateResume } = await import('./db');
        const { calculateResumeScore } = await import('./resumeService');
        const resume = await getResumeById(input.id, ctx.user.id);
        if (!resume) return { score: 0, feedback: [], breakdown: [], overallFeedback: '', priority: 'high' as const };
        
        // Use enhanced scoring algorithm
        const result = calculateResumeScore(resume);
        
        // Update the score in database
        await updateResume(input.id, ctx.user.id, { score: result.totalScore });
        
        // Return both simple feedback (for backward compatibility) and detailed breakdown
        const feedback = result.breakdown
          .filter(b => b.suggestions.length > 0)
          .flatMap(b => b.suggestions);
        
        return { 
          score: result.totalScore, 
          feedback,
          breakdown: result.breakdown,
          overallFeedback: result.overallFeedback,
          priority: result.priority,
        };
      }),
    
    // Duplicate a resume
    duplicate: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        newTitle: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { duplicateResume } = await import('./db');
        return duplicateResume(input.id, ctx.user.id, input.newTitle);
      }),
    
    // Create resume from LinkedIn data
    createFromLinkedIn: protectedProcedure
      .input(z.object({
        fullName: z.string().optional(),
        headline: z.string().optional(),
        location: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        linkedinUrl: z.string().optional(),
        summary: z.string().optional(),
        experience: z.array(z.object({
          title: z.string(),
          company: z.string(),
          location: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          description: z.string().optional(),
        })).optional(),
        education: z.array(z.object({
          school: z.string(),
          degree: z.string().optional(),
          field: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })).optional(),
        skills: z.array(z.string()).optional(),
        certifications: z.array(z.object({
          name: z.string(),
          issuer: z.string().optional(),
          date: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createResume, updateResume } = await import('./db');
        
        // Create a new resume
        const resume = await createResume({
          userId: ctx.user.id,
          title: `${input.fullName || 'My'}'s Resume (from LinkedIn)`,
          type: 'base',
        });
        
        if (!resume) throw new Error('Failed to create resume');
        
        // Update with LinkedIn data
        await updateResume(resume.id, ctx.user.id, {
          personalInfo: {
            firstName: input.fullName?.split(' ')[0] || '',
            lastName: input.fullName?.split(' ').slice(1).join(' ') || '',
            email: input.email || '',
            phone: input.phone || '',
            location: input.location || '',
            linkedinUrl: input.linkedinUrl || '',
          },
          summary: input.summary || '',
          experience: input.experience?.map((exp, index) => ({
            id: `exp-${Date.now()}-${index}`,
            position: exp.title,
            company: exp.company,
            location: exp.location || '',
            startDate: exp.startDate || '',
            endDate: exp.endDate || '',
            current: !exp.endDate || exp.endDate.toLowerCase() === 'present',
            description: exp.description || '',
            highlights: [],
          })) || [],
          education: input.education?.map((edu, index) => ({
            id: `edu-${Date.now()}-${index}`,
            institution: edu.school,
            degree: edu.degree || '',
            field: edu.field || '',
            startDate: edu.startDate || '',
            endDate: edu.endDate || '',
            gpa: '',
            highlights: [],
          })) || [],
          skills: input.skills?.map((skill, index) => ({
            id: `skill-${Date.now()}-${index}`,
            name: skill,
            level: 'intermediate' as const,
          })) || [],
          certifications: input.certifications?.map((cert, index) => ({
            id: `cert-${Date.now()}-${index}`,
            name: cert.name,
            issuer: cert.issuer || '',
            date: cert.date || '',
            url: '',
          })) || [],
        });
        
        return { id: resume.id };
      }),
  }),
  
  // Job Tracker
  jobTracker: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getTrackedJobsByUser } = await import('./db');
      return getTrackedJobsByUser(ctx.user.id);
    }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getTrackedJobById } = await import('./db');
        return getTrackedJobById(input.id, ctx.user.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        jobTitle: z.string(),
        companyName: z.string(),
        location: z.string().optional(),
        jobUrl: z.string().optional(),
        salary: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived']).default('saved'),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source: z.enum(['manual', 'extension', 'import']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { createTrackedJob } = await import('./db');
        return createTrackedJob({
          userId: ctx.user.id,
          ...input,
        });
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        jobTitle: z.string().optional(),
        companyName: z.string().optional(),
        location: z.string().optional(),
        jobUrl: z.string().optional(),
        salary: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived']).optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        interviewDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateTrackedJob } = await import('./db');
        const { id, ...data } = input;
        return updateTrackedJob(id, ctx.user.id, data);
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteTrackedJob } = await import('./db');
        const success = await deleteTrackedJob(input.id, ctx.user.id);
        return { success };
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived']),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateTrackedJob } = await import('./db');
        return updateTrackedJob(input.id, ctx.user.id, { status: input.status });
      }),
  }),
  
  // LinkedIn Content Generator
  linkedin: router({
    generateHeadline: protectedProcedure
      .input(z.object({
        keywords: z.array(z.string()),
        profile: z.string().optional(), // job_seeker, professional, student
        language: z.string().default('English'),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert LinkedIn profile optimizer. Generate 5 compelling LinkedIn headlines based on the keywords provided. Each headline should be:
- Under 120 characters
- Professional and impactful
- Include relevant keywords for SEO
- Tailored for a ${input.profile || 'professional'}

Respond in ${input.language}. Return ONLY a JSON array of 5 headlines, no other text.`
            },
            {
              role: 'user',
              content: `Keywords: ${input.keywords.join(', ')}`
            }
          ]
        });
        
        const rawContent = response.choices[0]?.message?.content || '[]';
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        let headlines: string[] = [];
        try {
          // Remove markdown code blocks if present
          let cleanContent = content.trim();
          if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.slice(7);
          } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.slice(3);
          }
          if (cleanContent.endsWith('```')) {
            cleanContent = cleanContent.slice(0, -3);
          }
          cleanContent = cleanContent.trim();
          headlines = JSON.parse(cleanContent);
        } catch {
          // If parsing fails, try to extract headlines from the content
          headlines = [content];
        }
        
        // Save to history
        const { createLinkedinContent } = await import('./db');
        for (const headline of headlines) {
          await createLinkedinContent({
            userId: ctx.user.id,
            type: 'headline',
            inputKeywords: input.keywords,
            inputProfile: input.profile,
            inputLanguage: input.language,
            generatedContent: headline,
          });
        }
        
        return { headlines };
      }),
    
    generateAbout: protectedProcedure
      .input(z.object({
        keywords: z.array(z.string()),
        tone: z.string().optional(), // professional, friendly, creative
        profile: z.string().optional(),
        language: z.string().default('English'),
      }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert LinkedIn profile optimizer. Generate a compelling LinkedIn About section based on the keywords provided. The about section should be:
- 200-300 words
- ${input.tone || 'professional'} tone
- Include a hook in the first line
- Highlight key achievements and skills
- Include a call to action at the end
- Tailored for a ${input.profile || 'professional'}

Respond in ${input.language}. Return ONLY the about section text, no other text.`
            },
            {
              role: 'user',
              content: `Keywords: ${input.keywords.join(', ')}`
            }
          ]
        });
        
        const rawAbout = response.choices[0]?.message?.content || '';
        const about = typeof rawAbout === 'string' ? rawAbout : JSON.stringify(rawAbout);
        
        // Save to history
        const { createLinkedinContent } = await import('./db');
        await createLinkedinContent({
          userId: ctx.user.id,
          type: 'about',
          inputKeywords: input.keywords,
          inputTone: input.tone,
          inputProfile: input.profile,
          inputLanguage: input.language,
          generatedContent: about,
        });
        
        return { about };
      }),
    
    history: protectedProcedure
      .input(z.object({ type: z.enum(['headline', 'about', 'post']).optional() }))
      .query(async ({ ctx, input }) => {
        const { getLinkedinContentByUser } = await import('./db');
        return getLinkedinContentByUser(ctx.user.id, input.type);
      }),
    
    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { toggleLinkedinContentFavorite } = await import('./db');
        return toggleLinkedinContentFavorite(input.id, ctx.user.id);
      }),
    
    // Parse LinkedIn PDF profile
    parseProfile: protectedProcedure
      .input(z.object({
        pdfBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Use LLM to parse the LinkedIn PDF content
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert at parsing LinkedIn profile PDFs. Extract the following information from the provided PDF content and return it as a JSON object:

{
  "fullName": "string",
  "headline": "string",
  "location": "string",
  "email": "string or null",
  "phone": "string or null",
  "linkedinUrl": "string or null",
  "summary": "string or null",
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string or null",
      "startDate": "string (e.g., 'Jan 2020')",
      "endDate": "string or 'Present'",
      "description": "string or null"
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string or null",
      "field": "string or null",
      "startDate": "string or null",
      "endDate": "string or null"
    }
  ],
  "skills": ["string"],
  "certifications": [
    {
      "name": "string",
      "issuer": "string or null",
      "date": "string or null"
    }
  ]
}

Return ONLY the JSON object, no other text or markdown formatting.`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'file_url' as const,
                  file_url: {
                    url: `data:application/pdf;base64,${input.pdfBase64}`,
                    mime_type: 'application/pdf' as const,
                  },
                },
              ],
            },
          ],
        });
        
        const rawContent = response.choices[0]?.message?.content || '{}';
        const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
        
        try {
          // Remove markdown code blocks if present
          let cleanContent = content.trim();
          if (cleanContent.startsWith('```json')) {
            cleanContent = cleanContent.slice(7);
          } else if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.slice(3);
          }
          if (cleanContent.endsWith('```')) {
            cleanContent = cleanContent.slice(0, -3);
          }
          cleanContent = cleanContent.trim();
          
          return JSON.parse(cleanContent);
        } catch (e) {
          console.error('Failed to parse LinkedIn profile:', e);
          throw new Error('Failed to parse LinkedIn profile. Please try again.');
        }
      }),
  }),
  
  // JobH User Profile
  jobhProfile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreateJobhProfile } = await import('./db');
      return getOrCreateJobhProfile(ctx.user.id);
    }),
    
    update: protectedProcedure
      .input(z.object({
        targetJobTitle: z.string().optional(),
        targetIndustry: z.string().optional(),
        experienceLevel: z.string().optional(),
        linkedinUrl: z.string().optional(),
        onboardingStep: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { updateJobhProfile } = await import('./db');
        return updateJobhProfile(ctx.user.id, input);
      }),
    
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      const { completeOnboarding } = await import('./db');
      return completeOnboarding(ctx.user.id);
    }),
    
    stats: protectedProcedure.query(async ({ ctx }) => {
      const { getJobhUserStats } = await import('./db');
      return getJobhUserStats(ctx.user.id);
    }),
  }),
  
  // AI Toolbox
  aiToolbox: router({
    // Cover Letter Generator
    generateCoverLetter: protectedProcedure
      .input(z.object({
        jobTitle: z.string(),
        companyName: z.string(),
        jobDescription: z.string().optional(),
        resumeId: z.number().optional(),
        tone: z.string().default('professional'),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get resume data if provided
        let resumeContext = '';
        if (input.resumeId) {
          const { getResumeById } = await import('./db');
          const resume = await getResumeById(input.resumeId, ctx.user.id);
          if (resume) {
            const personalInfo = resume.personalInfo as any || {};
            const experience = resume.experience as any[] || [];
            const skills = resume.skills as any[] || [];
            
            resumeContext = `
Candidate Information:
- Name: ${personalInfo.firstName || ''} ${personalInfo.lastName || ''}
- Experience: ${experience.map((e: any) => `${e.position} at ${e.company}`).join(', ')}
- Skills: ${skills.map((s: any) => s.name).join(', ')}
- Summary: ${resume.summary || ''}
`;
          }
        }
        
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert cover letter writer. Write a compelling, personalized cover letter for the following job application. The letter should be:
- ${input.tone} in tone
- 3-4 paragraphs long
- Highlight relevant skills and experience
- Show enthusiasm for the role and company
- Include a strong opening and call to action

Do not include placeholders like [Your Name] - write the letter as if it's ready to send.`
            },
            {
              role: 'user',
              content: `Job Title: ${input.jobTitle}
Company: ${input.companyName}
${input.jobDescription ? `Job Description: ${input.jobDescription}` : ''}
${resumeContext}`
            }
          ]
        });
        
        const coverLetter = response.choices[0]?.message?.content || '';
        return { coverLetter: typeof coverLetter === 'string' ? coverLetter : JSON.stringify(coverLetter) };
      }),
    
    // Email Writer
    generateEmail: protectedProcedure
      .input(z.object({
        emailType: z.enum(['follow_up', 'thank_you', 'networking', 'application', 'inquiry']),
        recipientName: z.string().optional(),
        recipientTitle: z.string().optional(),
        companyName: z.string().optional(),
        context: z.string().optional(),
        tone: z.string().default('professional'),
      }))
      .mutation(async ({ ctx, input }) => {
        const emailTypeDescriptions: Record<string, string> = {
          follow_up: 'a follow-up email after a job interview',
          thank_you: 'a thank you email after a job interview',
          networking: 'a networking email to connect with a professional',
          application: 'a job application email',
          inquiry: 'an inquiry email about job opportunities',
        };
        
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert at writing professional emails. Write ${emailTypeDescriptions[input.emailType]}. The email should be:
- ${input.tone} in tone
- Concise and to the point
- Professional yet personable
- Include a clear subject line (prefix with "Subject: ")

Format the email with proper greeting and signature.`
            },
            {
              role: 'user',
              content: `${input.recipientName ? `Recipient: ${input.recipientName}` : ''}
${input.recipientTitle ? `Title: ${input.recipientTitle}` : ''}
${input.companyName ? `Company: ${input.companyName}` : ''}
${input.context ? `Additional Context: ${input.context}` : ''}`
            }
          ]
        });
        
        const email = response.choices[0]?.message?.content || '';
        return { email: typeof email === 'string' ? email : JSON.stringify(email) };
      }),
    
    // Elevator Pitch Generator
    generateElevatorPitch: protectedProcedure
      .input(z.object({
        targetRole: z.string(),
        experience: z.string().optional(),
        skills: z.array(z.string()).optional(),
        uniqueValue: z.string().optional(),
        duration: z.enum(['30', '60', '90']).default('60'),
      }))
      .mutation(async ({ ctx, input }) => {
        const durationGuide: Record<string, string> = {
          '30': '2-3 sentences, about 30 seconds to speak',
          '60': '4-5 sentences, about 60 seconds to speak',
          '90': '6-8 sentences, about 90 seconds to speak',
        };
        
        const response = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: `You are an expert career coach. Create a compelling elevator pitch for a job seeker. The pitch should be:
- ${durationGuide[input.duration]}
- Memorable and engaging
- Highlight unique value proposition
- End with a conversation starter or call to action

Return only the pitch text, no additional formatting.`
            },
            {
              role: 'user',
              content: `Target Role: ${input.targetRole}
${input.experience ? `Experience: ${input.experience}` : ''}
${input.skills?.length ? `Key Skills: ${input.skills.join(', ')}` : ''}
${input.uniqueValue ? `Unique Value: ${input.uniqueValue}` : ''}`
            }
          ]
        });
        
        const pitch = response.choices[0]?.message?.content || '';
        return { pitch: typeof pitch === 'string' ? pitch : JSON.stringify(pitch) };
      }),
    
    // View History - Get all AI generated content history
    getHistory: protectedProcedure
      .input(z.object({
        type: z.enum(['email', 'cover_letter', 'elevator_pitch', 'linkedin_headline', 'linkedin_about']).optional(),
        limit: z.number().optional().default(50),
      }))
      .query(async ({ ctx, input }) => {
        const { getAiToolboxHistoryByUser } = await import('./db');
        return getAiToolboxHistoryByUser(ctx.user.id, input.type, input.limit);
      }),
    
    // Get single history item
    getHistoryById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getAiToolboxHistoryById } = await import('./db');
        return getAiToolboxHistoryById(input.id, ctx.user.id);
      }),
    
    // Toggle favorite
    toggleFavorite: protectedProcedure
      .input(z.object({ id: z.number(), isFavorite: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const { updateAiToolboxHistoryFavorite } = await import('./db');
        return updateAiToolboxHistoryFavorite(input.id, ctx.user.id, input.isFavorite);
      }),
    
    // Delete history item
    deleteHistory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteAiToolboxHistory } = await import('./db');
        return deleteAiToolboxHistory(input.id, ctx.user.id);
      }),
    
    // Import from Board - Get tracked jobs for selection
    getTrackedJobsForImport: protectedProcedure
      .query(async ({ ctx }) => {
        const { getTrackedJobsByUser } = await import('./db');
        const jobs = await getTrackedJobsByUser(ctx.user.id);
        return jobs.map(job => ({
          id: job.id,
          jobTitle: job.jobTitle || 'Unknown Position',
          companyName: job.companyName || 'Unknown Company',
          status: job.status,
          description: job.description,
        }));
      }),
  }),
  
  // ==========================================
  // Skill Analysis API (Chrome Extension)
  // ==========================================
  skillAnalysis: router({
    // Analyze job description against user's resume
    analyze: protectedProcedure
      .input(z.object({
        jobDescription: z.string().min(50, 'Job description must be at least 50 characters'),
        jobTitle: z.string().optional(),
        company: z.string().optional(),
        jobUrl: z.string().optional(),
        resumeId: z.number().optional(), // If not provided, uses default resume
      }))
      .mutation(async ({ ctx, input }) => {
        const { analyzeSkills } = await import('./skillAnalysisService');
        
        try {
          const result = await analyzeSkills({
            jobDescription: input.jobDescription,
            jobTitle: input.jobTitle,
            company: input.company,
            jobUrl: input.jobUrl,
            resumeId: input.resumeId,
            userId: ctx.user.id,
          });
          
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Handle specific error codes
          if (errorMessage === 'NO_RESUME') {
            return {
              success: false,
              error: 'NO_RESUME',
              message: 'Please create a resume first to analyze skill matches.',
            };
          }
          
          if (errorMessage === 'RESUME_NOT_FOUND') {
            return {
              success: false,
              error: 'RESUME_NOT_FOUND',
              message: 'The specified resume was not found.',
            };
          }
          
          if (errorMessage === 'LLM_RESPONSE_EMPTY' || errorMessage === 'LLM_RESPONSE_INVALID') {
            return {
              success: false,
              error: 'ANALYSIS_FAILED',
              message: 'Failed to analyze skills. Please try again.',
            };
          }
          
          console.error('[skillAnalysis.analyze] Error:', error);
          return {
            success: false,
            error: 'UNKNOWN_ERROR',
            message: 'An unexpected error occurred.',
          };
        }
      }),
    
    // Get user's resumes for selection in Chrome Extension
    getResumes: protectedProcedure
      .query(async ({ ctx }) => {
        const { getResumesByUser } = await import('./db');
        const resumes = await getResumesByUser(ctx.user.id);
        
        return resumes.map(r => ({
          id: r.id,
          title: r.title,
          type: r.type,
          isDefault: r.isDefault === 1,
          targetJobTitle: r.targetJobTitle,
          targetCompany: r.targetCompany,
          updatedAt: r.updatedAt,
        }));
      }),
    
    // Clear cache for a specific resume (called when resume is updated)
    clearCache: protectedProcedure
      .input(z.object({
        resumeId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { clearCacheForResume } = await import('./skillAnalysisService');
        await clearCacheForResume(input.resumeId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
