/**
 * Knowledge Extraction Agent for Interview Knowledge Base
 * 
 * This agent is responsible for extracting structured interview knowledge
 * from raw search results using LLM.
 */

import { invokeLLM } from '../_core/llm';
import type { RawSearchResult } from './searchAgent';

// Types for structured knowledge
export interface InterviewRound {
  order: number;
  name: string;
  duration?: string;
  format?: string;
  focus: string[];
}

export interface InterviewProcess {
  rounds: InterviewRound[];
  totalDuration?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  offerRate?: number;
}

export interface TechnicalQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  frequency: number;
  sampleAnswer?: string;
  source: string;
  reportedDate?: string;
}

export interface BehavioralQuestion {
  id: string;
  question: string;
  category: string;
  starExample?: string;
  source: string;
}

export interface CaseQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  hints?: string[];
  source: string;
}

export interface CompanyInfo {
  culture: string[];
  values: string[];
  interviewStyle?: string;
  redFlags: string[];
  greenFlags: string[];
}

export interface InterviewTip {
  category: string;
  tip: string;
  source: string;
}

export interface StructuredKnowledge {
  interviewProcess: InterviewProcess;
  technicalQuestions: TechnicalQuestion[];
  behavioralQuestions: BehavioralQuestion[];
  caseQuestions: CaseQuestion[];
  companyInfo: CompanyInfo;
  tips: InterviewTip[];
  sourceCount: number;
  extractedAt: string;
}

// JSON Schema for structured extraction
const KNOWLEDGE_SCHEMA = {
  name: 'interview_knowledge',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      interviewProcess: {
        type: 'object',
        properties: {
          rounds: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                order: { type: 'integer' },
                name: { type: 'string' },
                duration: { type: 'string' },
                format: { type: 'string' },
                focus: { type: 'array', items: { type: 'string' } },
              },
              required: ['order', 'name', 'focus'],
              additionalProperties: false,
            },
          },
          totalDuration: { type: 'string' },
          difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
          offerRate: { type: 'number' },
        },
        required: ['rounds', 'difficulty'],
        additionalProperties: false,
      },
      technicalQuestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            category: { type: 'string' },
            difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
            frequency: { type: 'integer', minimum: 1, maximum: 5 },
            sampleAnswer: { type: 'string' },
          },
          required: ['question', 'category', 'difficulty', 'frequency'],
          additionalProperties: false,
        },
      },
      behavioralQuestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            category: { type: 'string' },
            starExample: { type: 'string' },
          },
          required: ['question', 'category'],
          additionalProperties: false,
        },
      },
      caseQuestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            category: { type: 'string' },
            difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
            hints: { type: 'array', items: { type: 'string' } },
          },
          required: ['question', 'category', 'difficulty'],
          additionalProperties: false,
        },
      },
      companyInfo: {
        type: 'object',
        properties: {
          culture: { type: 'array', items: { type: 'string' } },
          values: { type: 'array', items: { type: 'string' } },
          interviewStyle: { type: 'string' },
          redFlags: { type: 'array', items: { type: 'string' } },
          greenFlags: { type: 'array', items: { type: 'string' } },
        },
        required: ['culture', 'values', 'redFlags', 'greenFlags'],
        additionalProperties: false,
      },
      tips: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            tip: { type: 'string' },
          },
          required: ['category', 'tip'],
          additionalProperties: false,
        },
      },
    },
    required: ['interviewProcess', 'technicalQuestions', 'behavioralQuestions', 'caseQuestions', 'companyInfo', 'tips'],
    additionalProperties: false,
  },
};

/**
 * Generate unique ID for questions
 */
function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Chunk raw results to avoid token limits
 */
function chunkResults(results: RawSearchResult[], maxChunkSize: number = 15): RawSearchResult[][] {
  const chunks: RawSearchResult[][] = [];
  for (let i = 0; i < results.length; i += maxChunkSize) {
    chunks.push(results.slice(i, i + maxChunkSize));
  }
  return chunks;
}

/**
 * Extract knowledge from a chunk of results
 */
async function extractFromChunk(
  company: string,
  position: string,
  results: RawSearchResult[],
  language: 'en' | 'zh' = 'en'
): Promise<Partial<StructuredKnowledge>> {
  const systemPrompt = language === 'zh' 
    ? `你是一个专业的面试知识提取专家。你的任务是从面试相关的原始数据中提取结构化的面试知识。

请仔细分析以下关于 ${company} 公司 ${position} 职位的面试信息，并提取：
1. 面试流程（轮次、时长、形式、重点）
2. 技术问题（分类、难度、出现频率）
3. 行为问题（分类、STAR示例）
4. 案例问题（如有）
5. 公司文化和价值观
6. 面试技巧和建议

注意：
- 只提取明确提到的信息，不要编造
- 对问题进行去重，合并相似问题
- 评估问题的出现频率（1-5，5最高）
- 保持专业和客观`
    : `You are a professional interview knowledge extraction expert. Your task is to extract structured interview knowledge from raw interview data.

Please analyze the following interview information for ${company} - ${position} and extract:
1. Interview process (rounds, duration, format, focus areas)
2. Technical questions (category, difficulty, frequency)
3. Behavioral questions (category, STAR examples)
4. Case questions (if any)
5. Company culture and values
6. Interview tips and suggestions

Important:
- Only extract explicitly mentioned information, do not fabricate
- Deduplicate questions, merge similar ones
- Estimate question frequency (1-5, 5 being most common)
- Stay professional and objective`;

  const userPrompt = `Raw interview data to analyze:

${results.map((r, i) => `
--- Source ${i + 1}: ${r.source} (${r.type}) ---
Title: ${r.title}
Content: ${r.content.slice(0, 2000)}
${r.metadata ? `Metadata: ${JSON.stringify(r.metadata)}` : ''}
`).join('\n')}

Please extract structured interview knowledge from the above data.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: KNOWLEDGE_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      throw new Error('Empty or invalid response from LLM');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('[KnowledgeExtractionAgent] Error extracting from chunk:', error);
    return {};
  }
}

/**
 * Merge multiple extraction results
 */
function mergeExtractions(extractions: Partial<StructuredKnowledge>[]): StructuredKnowledge {
  const merged: StructuredKnowledge = {
    interviewProcess: {
      rounds: [],
      difficulty: 'Medium',
    },
    technicalQuestions: [],
    behavioralQuestions: [],
    caseQuestions: [],
    companyInfo: {
      culture: [],
      values: [],
      redFlags: [],
      greenFlags: [],
    },
    tips: [],
    sourceCount: extractions.length,
    extractedAt: new Date().toISOString(),
  };

  // Track seen questions for deduplication
  const seenTechnical = new Set<string>();
  const seenBehavioral = new Set<string>();
  const seenCase = new Set<string>();
  const seenTips = new Set<string>();

  for (const extraction of extractions) {
    // Merge interview process (take the most detailed one)
    if (extraction.interviewProcess) {
      if (extraction.interviewProcess.rounds.length > merged.interviewProcess.rounds.length) {
        merged.interviewProcess.rounds = extraction.interviewProcess.rounds;
      }
      if (extraction.interviewProcess.totalDuration) {
        merged.interviewProcess.totalDuration = extraction.interviewProcess.totalDuration;
      }
      if (extraction.interviewProcess.offerRate) {
        merged.interviewProcess.offerRate = extraction.interviewProcess.offerRate;
      }
    }

    // Merge technical questions
    if (extraction.technicalQuestions) {
      for (const q of extraction.technicalQuestions) {
        const key = q.question.toLowerCase().slice(0, 100);
        if (!seenTechnical.has(key)) {
          seenTechnical.add(key);
          merged.technicalQuestions.push({
            ...q,
            id: generateQuestionId(),
            source: 'extracted',
          });
        }
      }
    }

    // Merge behavioral questions
    if (extraction.behavioralQuestions) {
      for (const q of extraction.behavioralQuestions) {
        const key = q.question.toLowerCase().slice(0, 100);
        if (!seenBehavioral.has(key)) {
          seenBehavioral.add(key);
          merged.behavioralQuestions.push({
            ...q,
            id: generateQuestionId(),
            source: 'extracted',
          });
        }
      }
    }

    // Merge case questions
    if (extraction.caseQuestions) {
      for (const q of extraction.caseQuestions) {
        const key = q.question.toLowerCase().slice(0, 100);
        if (!seenCase.has(key)) {
          seenCase.add(key);
          merged.caseQuestions.push({
            ...q,
            id: generateQuestionId(),
            source: 'extracted',
          });
        }
      }
    }

    // Merge company info
    if (extraction.companyInfo) {
      merged.companyInfo.culture.push(...(extraction.companyInfo.culture || []));
      merged.companyInfo.values.push(...(extraction.companyInfo.values || []));
      merged.companyInfo.redFlags.push(...(extraction.companyInfo.redFlags || []));
      merged.companyInfo.greenFlags.push(...(extraction.companyInfo.greenFlags || []));
      if (extraction.companyInfo.interviewStyle) {
        merged.companyInfo.interviewStyle = extraction.companyInfo.interviewStyle;
      }
    }

    // Merge tips
    if (extraction.tips) {
      for (const tip of extraction.tips) {
        const key = tip.tip.toLowerCase().slice(0, 100);
        if (!seenTips.has(key)) {
          seenTips.add(key);
          merged.tips.push({
            ...tip,
            source: 'extracted',
          });
        }
      }
    }
  }

  // Deduplicate arrays in company info
  merged.companyInfo.culture = Array.from(new Set(merged.companyInfo.culture));
  merged.companyInfo.values = Array.from(new Set(merged.companyInfo.values));
  merged.companyInfo.redFlags = Array.from(new Set(merged.companyInfo.redFlags));
  merged.companyInfo.greenFlags = Array.from(new Set(merged.companyInfo.greenFlags));

  return merged;
}

/**
 * Knowledge Extraction Agent class
 */
export class KnowledgeExtractionAgent {
  private language: 'en' | 'zh';

  constructor(language: 'en' | 'zh' = 'en') {
    this.language = language;
  }

  /**
   * Extract structured knowledge from raw search results
   */
  async extract(
    company: string,
    position: string,
    rawResults: RawSearchResult[]
  ): Promise<StructuredKnowledge> {
    console.log(`[KnowledgeExtractionAgent] Extracting knowledge from ${rawResults.length} results...`);

    if (rawResults.length === 0) {
      console.warn('[KnowledgeExtractionAgent] No results to extract from');
      return this.getEmptyKnowledge();
    }

    // Chunk results to avoid token limits
    const chunks = chunkResults(rawResults, 10);
    console.log(`[KnowledgeExtractionAgent] Processing ${chunks.length} chunks...`);

    // Extract from each chunk
    const extractions: Partial<StructuredKnowledge>[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[KnowledgeExtractionAgent] Processing chunk ${i + 1}/${chunks.length}...`);
      const extraction = await extractFromChunk(company, position, chunks[i], this.language);
      extractions.push(extraction);
    }

    // Merge all extractions
    const merged = mergeExtractions(extractions);
    
    console.log(`[KnowledgeExtractionAgent] Extraction complete. Questions: Tech=${merged.technicalQuestions.length}, Behavioral=${merged.behavioralQuestions.length}, Case=${merged.caseQuestions.length}`);

    return merged;
  }

  /**
   * Get empty knowledge structure
   */
  private getEmptyKnowledge(): StructuredKnowledge {
    return {
      interviewProcess: {
        rounds: [],
        difficulty: 'Medium',
      },
      technicalQuestions: [],
      behavioralQuestions: [],
      caseQuestions: [],
      companyInfo: {
        culture: [],
        values: [],
        redFlags: [],
        greenFlags: [],
      },
      tips: [],
      sourceCount: 0,
      extractedAt: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const knowledgeExtractionAgent = new KnowledgeExtractionAgent();
