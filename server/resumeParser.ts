/**
 * Resume Parser Service
 * 
 * Supports parsing PDF, DOC, DOCX files and extracting text content.
 */

import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export interface ParsedResume {
  text: string;
  metadata?: {
    pages?: number;
    wordCount?: number;
    fileType: string;
  };
}

/**
 * Parse a resume file and extract text content
 */
export async function parseResume(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedResume> {
  const fileType = getFileType(mimeType, filename);
  
  switch (fileType) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
      return parseDOCX(buffer);
    case 'doc':
      // DOC files are harder to parse, try as DOCX first
      try {
        return await parseDOCX(buffer);
      } catch {
        throw new Error('DOC format is not fully supported. Please convert to DOCX or PDF.');
      }
    case 'txt':
      return parseTXT(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}. Supported formats: PDF, DOCX, TXT`);
  }
}

/**
 * Determine file type from MIME type or filename extension
 */
function getFileType(mimeType: string, filename: string): string {
  // Check MIME type first
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
  };
  
  if (mimeMap[mimeType]) {
    return mimeMap[mimeType];
  }
  
  // Fall back to filename extension
  const ext = filename.toLowerCase().split('.').pop();
  if (ext && ['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
    return ext;
  }
  
  return 'unknown';
}

/**
 * Parse PDF file using pdf-parse v2
 */
async function parsePDF(buffer: Buffer): Promise<ParsedResume> {
  try {
    // Convert Buffer to Uint8Array for pdf-parse
    const uint8Array = new Uint8Array(buffer);
    
    const parser = new PDFParse({ data: uint8Array });
    const textResult = await parser.getText();
    
    // Get page count from text result
    const pageCount = textResult.pages?.length;
    
    await parser.destroy();
    
    const fullText = textResult.text || textResult.pages?.map(p => p.text).join('\n') || '';
    
    return {
      text: cleanText(fullText),
      metadata: {
        pages: pageCount,
        wordCount: countWords(fullText),
        fileType: 'pdf',
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse DOCX file
 */
async function parseDOCX(buffer: Buffer): Promise<ParsedResume> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      text: cleanText(result.value),
      metadata: {
        wordCount: countWords(result.value),
        fileType: 'docx',
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse plain text file
 */
function parseTXT(buffer: Buffer): ParsedResume {
  const text = buffer.toString('utf-8');
  
  return {
    text: cleanText(text),
    metadata: {
      wordCount: countWords(text),
      fileType: 'txt',
    },
  };
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  // Handle both English and Chinese
  const englishWords = text.match(/[a-zA-Z]+/g)?.length || 0;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  return englishWords + Math.ceil(chineseChars / 2); // Rough estimate for Chinese
}
