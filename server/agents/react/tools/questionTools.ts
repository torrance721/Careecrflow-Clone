/**
 * Question Generation Tools
 * 
 * 问题生成 ReAct Agent 可用的工具集
 */

import { Tool, ToolResult } from '../types';
import { getKnowledgeBaseById, getOrCreateKnowledgeBase } from '../../knowledgeBaseService';

/**
 * 搜索知识库工具
 */
export const searchKnowledgeBaseTool: Tool = {
  name: 'search_knowledge_base',
  description: 'Search the knowledge base for interview questions and company information. Use this to find real interview questions from Glassdoor, LeetCode, etc.',
  parameters: {
    type: 'object',
    properties: {
      company: {
        type: 'string',
        description: 'Company name to search for',
      },
      position: {
        type: 'string',
        description: 'Position/role to search for',
      },
      questionType: {
        type: 'string',
        description: 'Type of questions to search for',
        enum: ['technical', 'behavioral', 'case', 'all'],
      },
      difficulty: {
        type: 'string',
        description: 'Difficulty level to filter by',
        enum: ['Easy', 'Medium', 'Hard', 'all'],
      },
    },
    required: ['company', 'position'],
  },
  estimatedTimeMs: 3000,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { company, position, questionType, difficulty } = params as {
        company: string;
        position: string;
        questionType?: string;
        difficulty?: string;
      };
      
      // 获取或创建知识库
      const result = await getOrCreateKnowledgeBase(company, position, {
        forceRefresh: false,
      });
      
      const kb = result.knowledgeBase;
      
      // 过滤问题
      let questions = kb.questions;
      
      if (questionType && questionType !== 'all') {
        questions = questions.filter(q => q.type === questionType);
      }
      
      if (difficulty && difficulty !== 'all') {
        questions = questions.filter(q => q.difficulty === difficulty);
      }
      
      // 返回前 10 个问题
      const topQuestions = questions.slice(0, 10).map(q => ({
        id: q.id,
        question: q.question,
        type: q.type,
        difficulty: q.difficulty,
        category: q.category,
        frequency: q.frequency,
        source: q.source,
      }));
      
      return {
        success: true,
        data: {
          knowledgeBaseId: kb.id,
          company: kb.company,
          position: kb.position,
          cacheHit: result.cacheHit,
          totalQuestions: kb.questions.length,
          questions: topQuestions,
          interviewProcess: kb.interviewProcess,
          tips: kb.tips?.slice(0, 3),
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search knowledge base',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * 分析用户背景工具
 */
export const analyzeUserBackgroundTool: Tool = {
  name: 'analyze_user_background',
  description: 'Analyze the user\'s background (resume, skills, experience) to determine appropriate question difficulty and focus areas.',
  parameters: {
    type: 'object',
    properties: {
      resumeSummary: {
        type: 'string',
        description: 'Summary of user\'s resume',
      },
      skills: {
        type: 'string',
        description: 'Comma-separated list of user\'s skills',
      },
      yearsOfExperience: {
        type: 'string',
        description: 'Years of relevant experience',
      },
      targetPosition: {
        type: 'string',
        description: 'The position user is applying for',
      },
    },
    required: ['targetPosition'],
  },
  estimatedTimeMs: 1000,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { resumeSummary, skills, yearsOfExperience, targetPosition } = params as {
        resumeSummary?: string;
        skills?: string;
        yearsOfExperience?: string;
        targetPosition: string;
      };
      
      // 分析经验水平
      const years = parseInt(yearsOfExperience || '0', 10);
      let experienceLevel: 'entry' | 'mid' | 'senior';
      let recommendedDifficulty: 'Easy' | 'Medium' | 'Hard';
      
      if (years < 2) {
        experienceLevel = 'entry';
        recommendedDifficulty = 'Easy';
      } else if (years < 5) {
        experienceLevel = 'mid';
        recommendedDifficulty = 'Medium';
      } else {
        experienceLevel = 'senior';
        recommendedDifficulty = 'Hard';
      }
      
      // 分析技能
      const skillList = skills?.split(',').map(s => s.trim()).filter(Boolean) || [];
      const hasRelevantSkills = skillList.length > 3;
      
      // 分析简历
      const hasDetailedResume = (resumeSummary?.length || 0) > 200;
      
      // 推荐问题类型
      const recommendedTypes: string[] = [];
      if (experienceLevel === 'entry') {
        recommendedTypes.push('behavioral', 'technical');
      } else if (experienceLevel === 'mid') {
        recommendedTypes.push('technical', 'behavioral', 'case');
      } else {
        recommendedTypes.push('case', 'technical', 'behavioral');
      }
      
      // 推荐关注领域
      const focusAreas: string[] = [];
      if (!hasDetailedResume) {
        focusAreas.push('Ask about specific projects and experiences');
      }
      if (!hasRelevantSkills) {
        focusAreas.push('Explore technical depth in claimed skills');
      }
      if (experienceLevel === 'senior') {
        focusAreas.push('Leadership and strategic thinking');
        focusAreas.push('System design and architecture');
      }
      
      return {
        success: true,
        data: {
          experienceLevel,
          recommendedDifficulty,
          recommendedTypes,
          focusAreas,
          analysis: {
            hasDetailedResume,
            hasRelevantSkills,
            skillCount: skillList.length,
            yearsOfExperience: years,
          },
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze user background',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * 获取面试流程工具
 */
export const getInterviewProcessTool: Tool = {
  name: 'get_interview_process',
  description: 'Get the typical interview process for a company and position, including rounds, duration, and focus areas.',
  parameters: {
    type: 'object',
    properties: {
      knowledgeBaseId: {
        type: 'string',
        description: 'ID of the knowledge base to query',
      },
    },
    required: ['knowledgeBaseId'],
  },
  estimatedTimeMs: 500,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { knowledgeBaseId } = params as { knowledgeBaseId: string };
      
      const kb = await getKnowledgeBaseById(parseInt(knowledgeBaseId, 10));
      
      if (!kb) {
        return {
          success: false,
          error: 'Knowledge base not found',
          executionTimeMs: Date.now() - startTime,
        };
      }
      
      return {
        success: true,
        data: {
          company: kb.company,
          position: kb.position,
          interviewProcess: kb.interviewProcess || {
            rounds: [
              { order: 1, name: 'Phone Screen', focus: ['Basic qualifications', 'Culture fit'] },
              { order: 2, name: 'Technical Interview', focus: ['Technical skills', 'Problem solving'] },
              { order: 3, name: 'Onsite/Final', focus: ['Deep dive', 'Team fit'] },
            ],
            difficulty: 'Medium',
          },
          tips: kb.tips || [],
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get interview process',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * 检查问题重复工具
 */
export const checkQuestionDuplicateTool: Tool = {
  name: 'check_question_duplicate',
  description: 'Check if a question is too similar to previously asked questions in the conversation.',
  parameters: {
    type: 'object',
    properties: {
      newQuestion: {
        type: 'string',
        description: 'The new question to check',
      },
      previousQuestions: {
        type: 'string',
        description: 'JSON array of previously asked questions',
      },
    },
    required: ['newQuestion', 'previousQuestions'],
  },
  estimatedTimeMs: 100,
  execute: async (params): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const { newQuestion, previousQuestions } = params as {
        newQuestion: string;
        previousQuestions: string;
      };
      
      let prevQuestions: string[];
      try {
        prevQuestions = JSON.parse(previousQuestions);
      } catch {
        prevQuestions = [];
      }
      
      // 简单的相似度检查
      const newWords = new Set(newQuestion.toLowerCase().split(/\s+/));
      
      let maxSimilarity = 0;
      let mostSimilarQuestion = '';
      
      for (const prev of prevQuestions) {
        const prevWords = new Set(prev.toLowerCase().split(/\s+/));
        const intersection = Array.from(newWords).filter(w => prevWords.has(w));
        const similarity = intersection.length / Math.max(newWords.size, prevWords.size);
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          mostSimilarQuestion = prev;
        }
      }
      
      const isDuplicate = maxSimilarity > 0.6;
      
      return {
        success: true,
        data: {
          isDuplicate,
          similarity: maxSimilarity,
          mostSimilarQuestion: isDuplicate ? mostSimilarQuestion : null,
          recommendation: isDuplicate 
            ? 'This question is too similar to a previous one. Please generate a different question.'
            : 'This question is sufficiently unique.',
        },
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check duplicate',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * 所有问题生成工具
 */
export const questionGenerationTools: Tool[] = [
  searchKnowledgeBaseTool,
  analyzeUserBackgroundTool,
  getInterviewProcessTool,
  checkQuestionDuplicateTool,
];
