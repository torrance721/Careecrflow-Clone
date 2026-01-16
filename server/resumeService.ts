/**
 * Resume Service
 * 
 * Provides enhanced resume functionality including:
 * - PDF generation with proper download
 * - Score calculation with detailed feedback
 * - Resume duplication
 */

import { Resume } from "../drizzle/schema";
import { generateResumeHTML } from "./resumePdfGenerator";

// ============ Score Calculation ============

export interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
  suggestions: string[];
}

export interface ResumeScoreResult {
  totalScore: number;
  breakdown: ScoreBreakdown[];
  overallFeedback: string;
  priority: "low" | "medium" | "high";
}

/**
 * Calculate comprehensive resume score with detailed feedback
 */
export function calculateResumeScore(resume: Resume): ResumeScoreResult {
  const breakdown: ScoreBreakdown[] = [];
  
  // 1. Contact Information (10 points)
  const personalInfo = resume.personalInfo as any || {};
  let contactScore = 0;
  const contactSuggestions: string[] = [];
  
  if (personalInfo.fullName || personalInfo.firstName || personalInfo.lastName) contactScore += 3;
  else contactSuggestions.push("Add your full name");
  
  if (personalInfo.email) contactScore += 3;
  else contactSuggestions.push("Add your email address");
  
  if (personalInfo.phone) contactScore += 2;
  else contactSuggestions.push("Add your phone number");
  
  if (personalInfo.location) contactScore += 1;
  else contactSuggestions.push("Add your location (city, state)");
  
  if (personalInfo.linkedinUrl) contactScore += 1;
  else contactSuggestions.push("Add your LinkedIn profile URL");
  
  breakdown.push({
    category: "Contact Information",
    score: contactScore,
    maxScore: 10,
    feedback: contactScore >= 8 ? "Great! Your contact info is complete." : "Missing some contact details.",
    suggestions: contactSuggestions,
  });
  
  // 2. Professional Summary (15 points)
  const summary = resume.summary || "";
  let summaryScore = 0;
  const summarySuggestions: string[] = [];
  
  if (summary.length > 0) {
    summaryScore += 5;
    if (summary.length >= 100) summaryScore += 3;
    else summarySuggestions.push("Expand your summary to at least 100 characters");
    
    if (summary.length >= 200) summaryScore += 3;
    else if (summary.length >= 100) summarySuggestions.push("Consider expanding to 200+ characters for more impact");
    
    // Check for action words
    const actionWords = ["led", "managed", "developed", "created", "improved", "achieved", "delivered", "built", "designed", "implemented"];
    const hasActionWords = actionWords.some(word => summary.toLowerCase().includes(word));
    if (hasActionWords) summaryScore += 2;
    else summarySuggestions.push("Use action verbs like 'led', 'developed', 'achieved'");
    
    // Check for quantifiable achievements
    const hasNumbers = /\d+/.test(summary);
    if (hasNumbers) summaryScore += 2;
    else summarySuggestions.push("Add quantifiable achievements (numbers, percentages)");
  } else {
    summarySuggestions.push("Add a professional summary to introduce yourself");
  }
  
  breakdown.push({
    category: "Professional Summary",
    score: summaryScore,
    maxScore: 15,
    feedback: summaryScore >= 12 ? "Excellent summary!" : summaryScore >= 8 ? "Good summary, but could be improved." : "Your summary needs work.",
    suggestions: summarySuggestions,
  });
  
  // 3. Work Experience (30 points)
  const experience = (resume.experience as any[]) || [];
  let expScore = 0;
  const expSuggestions: string[] = [];
  
  if (experience.length > 0) {
    expScore += 10;
    
    if (experience.length >= 2) expScore += 5;
    else expSuggestions.push("Add more work experience if available");
    
    if (experience.length >= 3) expScore += 3;
    
    // Check for descriptions
    const hasDescriptions = experience.every(exp => exp.description && exp.description.length > 50);
    if (hasDescriptions) expScore += 5;
    else expSuggestions.push("Add detailed descriptions for each position (50+ characters)");
    
    // Check for quantifiable achievements
    const hasQuantified = experience.some(exp => /\d+/.test(exp.description || ""));
    if (hasQuantified) expScore += 4;
    else expSuggestions.push("Include quantifiable achievements in your experience");
    
    // Check for highlights/bullet points
    const hasHighlights = experience.some(exp => exp.highlights && exp.highlights.length > 0);
    if (hasHighlights) expScore += 3;
    else expSuggestions.push("Add bullet point highlights for key achievements");
  } else {
    expSuggestions.push("Add your work experience");
  }
  
  breakdown.push({
    category: "Work Experience",
    score: expScore,
    maxScore: 30,
    feedback: expScore >= 25 ? "Strong work experience section!" : expScore >= 15 ? "Good experience, but add more details." : "Your experience section needs more content.",
    suggestions: expSuggestions,
  });
  
  // 4. Education (15 points)
  const education = (resume.education as any[]) || [];
  let eduScore = 0;
  const eduSuggestions: string[] = [];
  
  if (education.length > 0) {
    eduScore += 10;
    
    // Check for complete info
    const hasCompleteInfo = education.every(edu => 
      (edu.school || edu.institution) && edu.degree && edu.startDate
    );
    if (hasCompleteInfo) eduScore += 3;
    else eduSuggestions.push("Complete all education fields (school, degree, dates)");
    
    // Check for GPA (if recent grad)
    const hasGPA = education.some(edu => edu.gpa);
    if (hasGPA) eduScore += 2;
    else eduSuggestions.push("Consider adding GPA if it's strong (3.5+)");
  } else {
    eduSuggestions.push("Add your education background");
  }
  
  breakdown.push({
    category: "Education",
    score: eduScore,
    maxScore: 15,
    feedback: eduScore >= 12 ? "Education section is complete!" : eduScore >= 8 ? "Good, but could add more details." : "Add your education information.",
    suggestions: eduSuggestions,
  });
  
  // 5. Skills (15 points)
  const skills = (resume.skills as any[]) || [];
  let skillScore = 0;
  const skillSuggestions: string[] = [];
  
  // Handle both array of strings and array of objects
  const skillCount = Array.isArray(skills) 
    ? skills.reduce((count, s) => {
        if (typeof s === 'string') return count + 1;
        if (s.items) return count + s.items.length;
        if (s.name) return count + 1;
        return count;
      }, 0)
    : 0;
  
  if (skillCount > 0) {
    skillScore += 5;
    
    if (skillCount >= 5) skillScore += 3;
    else skillSuggestions.push("Add at least 5 relevant skills");
    
    if (skillCount >= 10) skillScore += 4;
    else if (skillCount >= 5) skillSuggestions.push("Consider adding more skills (10+ recommended)");
    
    // Check for categorization
    const hasCategorized = skills.some(s => s.category);
    if (hasCategorized) skillScore += 3;
    else skillSuggestions.push("Organize skills into categories (Technical, Soft Skills, etc.)");
  } else {
    skillSuggestions.push("Add your skills to highlight your expertise");
  }
  
  breakdown.push({
    category: "Skills",
    score: skillScore,
    maxScore: 15,
    feedback: skillScore >= 12 ? "Great skills section!" : skillScore >= 8 ? "Good skills, consider adding more." : "Add more skills to your resume.",
    suggestions: skillSuggestions,
  });
  
  // 6. Projects (10 points - optional but valuable)
  const projects = (resume.projects as any[]) || [];
  let projScore = 0;
  const projSuggestions: string[] = [];
  
  if (projects.length > 0) {
    projScore += 5;
    
    if (projects.length >= 2) projScore += 3;
    
    // Check for technologies
    const hasTech = projects.some(p => p.technologies && p.technologies.length > 0);
    if (hasTech) projScore += 2;
    else projSuggestions.push("List technologies used in your projects");
  } else {
    projSuggestions.push("Add projects to showcase your practical skills");
  }
  
  breakdown.push({
    category: "Projects",
    score: projScore,
    maxScore: 10,
    feedback: projScore >= 8 ? "Nice project showcase!" : projScore >= 5 ? "Good start, add more projects." : "Consider adding projects.",
    suggestions: projSuggestions,
  });
  
  // 7. Certifications & Awards (5 points - bonus)
  const certifications = (resume.certifications as any[]) || [];
  const awards = (resume.awards as any[]) || [];
  let bonusScore = 0;
  const bonusSuggestions: string[] = [];
  
  if (certifications.length > 0) bonusScore += 2;
  else bonusSuggestions.push("Add relevant certifications if you have any");
  
  if (awards.length > 0) bonusScore += 3;
  else bonusSuggestions.push("Include awards or achievements if applicable");
  
  breakdown.push({
    category: "Certifications & Awards",
    score: bonusScore,
    maxScore: 5,
    feedback: bonusScore >= 4 ? "Great additions!" : bonusScore > 0 ? "Good, consider adding more." : "Optional but can strengthen your resume.",
    suggestions: bonusSuggestions,
  });
  
  // Calculate total
  const totalScore = breakdown.reduce((sum, b) => sum + b.score, 0);
  const maxPossible = breakdown.reduce((sum, b) => sum + b.maxScore, 0);
  
  // Determine priority
  let priority: "low" | "medium" | "high";
  if (totalScore >= 80) priority = "low";
  else if (totalScore >= 50) priority = "medium";
  else priority = "high";
  
  // Generate overall feedback
  let overallFeedback: string;
  if (totalScore >= 90) {
    overallFeedback = "Excellent resume! You're ready to apply.";
  } else if (totalScore >= 75) {
    overallFeedback = "Great resume! A few improvements could make it even better.";
  } else if (totalScore >= 50) {
    overallFeedback = "Good foundation. Focus on the suggested improvements.";
  } else {
    overallFeedback = "Your resume needs significant improvements. Start with the high-priority items.";
  }
  
  return {
    totalScore,
    breakdown,
    overallFeedback,
    priority,
  };
}

// ============ Resume Duplication ============

export interface DuplicateResumeData {
  title: string;
  type: "technical" | "behavioral" | "case" | "base" | "tailored" | "headline" | "about";
  personalInfo: any;
  summary: string | null;
  experience: any;
  education: any;
  skills: any;
  projects: any;
  certifications: any;
  awards: any;
  publications: any;
  volunteering: any;
  templateId: string | null;
  colorScheme: string | null;
  fontSize: string | null;
  sectionVisibility: any;
}

/**
 * Prepare resume data for duplication
 */
export function prepareResumeDuplicate(resume: Resume, newTitle?: string): DuplicateResumeData {
  return {
    title: newTitle || `${resume.title} (Copy)`,
    type: resume.type,
    personalInfo: resume.personalInfo,
    summary: resume.summary,
    experience: resume.experience,
    education: resume.education,
    skills: resume.skills,
    projects: resume.projects,
    certifications: resume.certifications,
    awards: resume.awards,
    publications: resume.publications,
    volunteering: resume.volunteering,
    templateId: resume.templateId,
    colorScheme: resume.colorScheme,
    fontSize: resume.fontSize,
    sectionVisibility: resume.sectionVisibility,
  };
}

// ============ PDF Generation ============

/**
 * Generate PDF-ready HTML with print styles
 */
export function generatePrintableHTML(resume: Resume): string {
  const html = generateResumeHTML(resume);
  
  // Add print-specific styles
  return html.replace('</head>', `
    <style>
      @media print {
        @page {
          size: letter;
          margin: 0.5in;
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
  </head>`);
}
