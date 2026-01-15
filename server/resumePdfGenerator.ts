/**
 * Resume PDF Generator Service
 * 
 * This service generates PDF files from resume data.
 * Uses HTML template rendering + PDF conversion.
 */

import { Resume } from "../drizzle/schema";

interface PersonalInfo {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
}

interface Experience {
  company: string;
  position: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description: string;
  highlights?: string[];
}

interface Education {
  school: string;
  degree: string;
  field?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
  highlights?: string[];
}

interface Project {
  name: string;
  description: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

interface Certification {
  name: string;
  issuer: string;
  date?: string;
  expirationDate?: string;
  credentialId?: string;
  url?: string;
}

interface Award {
  title: string;
  issuer: string;
  date?: string;
  description?: string;
}

// Color schemes for different templates
const colorSchemes: Record<string, { primary: string; secondary: string; accent: string }> = {
  professional: { primary: '#1a365d', secondary: '#2d3748', accent: '#3182ce' },
  modern: { primary: '#6366f1', secondary: '#4f46e5', accent: '#818cf8' },
  minimal: { primary: '#111827', secondary: '#374151', accent: '#6b7280' },
  creative: { primary: '#7c3aed', secondary: '#5b21b6', accent: '#a78bfa' },
  executive: { primary: '#0f172a', secondary: '#1e293b', accent: '#475569' },
};

// Font size mappings
const fontSizes: Record<string, { base: string; heading: string; subheading: string }> = {
  small: { base: '10px', heading: '16px', subheading: '12px' },
  medium: { base: '12px', heading: '18px', subheading: '14px' },
  large: { base: '14px', heading: '20px', subheading: '16px' },
};

export function generateResumeHTML(resume: Resume): string {
  const personalInfo = (resume.personalInfo as PersonalInfo) || {};
  const experience = (resume.experience as Experience[]) || [];
  
  // Handle education data - may come as institution or school
  const rawEducation = (resume.education as any[]) || [];
  const education: Education[] = rawEducation.map(edu => ({
    school: edu.school || edu.institution || '',
    degree: edu.degree || '',
    field: edu.field,
    location: edu.location,
    startDate: edu.startDate || '',
    endDate: edu.endDate,
    gpa: edu.gpa,
    highlights: edu.highlights,
  }));
  
  // Handle skills data - may come as string[] or object[]
  const rawSkills = resume.skills as any;
  const skills: string[] = Array.isArray(rawSkills) 
    ? rawSkills.map((s: any) => typeof s === 'string' ? s : s.name || '')
    : [];
  
  const projects = (resume.projects as Project[]) || [];
  const certifications = (resume.certifications as Certification[]) || [];
  const awards = (resume.awards as Award[]) || [];
  const summary = resume.summary || '';
  
  const colors = colorSchemes[resume.colorScheme || 'professional'] || colorSchemes.professional;
  const fonts = fontSizes[resume.fontSize || 'medium'] || fontSizes.medium;
  
  const sectionVisibility = (resume.sectionVisibility as Record<string, boolean>) || {
    summary: true,
    experience: true,
    education: true,
    skills: true,
    projects: true,
    certifications: true,
    awards: true,
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: ${fonts.base};
      line-height: 1.5;
      color: ${colors.secondary};
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.5in;
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid ${colors.primary};
    }
    
    .name {
      font-size: 28px;
      font-weight: 700;
      color: ${colors.primary};
      margin-bottom: 8px;
    }
    
    .contact-info {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 15px;
      font-size: ${fonts.subheading};
      color: ${colors.secondary};
    }
    
    .contact-info a {
      color: ${colors.accent};
      text-decoration: none;
    }
    
    .section {
      margin-bottom: 18px;
    }
    
    .section-title {
      font-size: ${fonts.heading};
      font-weight: 600;
      color: ${colors.primary};
      border-bottom: 1px solid ${colors.accent};
      padding-bottom: 4px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .summary {
      text-align: justify;
    }
    
    .entry {
      margin-bottom: 12px;
    }
    
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }
    
    .entry-title {
      font-weight: 600;
      color: ${colors.primary};
      font-size: ${fonts.subheading};
    }
    
    .entry-subtitle {
      color: ${colors.accent};
      font-style: italic;
    }
    
    .entry-date {
      color: ${colors.secondary};
      font-size: 11px;
    }
    
    .entry-description {
      margin-top: 4px;
    }
    
    .entry-description ul {
      margin-left: 20px;
    }
    
    .entry-description li {
      margin-bottom: 2px;
    }
    
    .skills-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .skill-tag {
      background: ${colors.primary}15;
      color: ${colors.primary};
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
    }
    
    .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    
    @media print {
      body {
        padding: 0;
      }
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${personalInfo.fullName || 'Your Name'}</div>
    <div class="contact-info">
      ${personalInfo.email ? `<span>${personalInfo.email}</span>` : ''}
      ${personalInfo.phone ? `<span>${personalInfo.phone}</span>` : ''}
      ${personalInfo.location ? `<span>${personalInfo.location}</span>` : ''}
      ${personalInfo.linkedinUrl ? `<a href="${personalInfo.linkedinUrl}">LinkedIn</a>` : ''}
      ${personalInfo.portfolioUrl ? `<a href="${personalInfo.portfolioUrl}">Portfolio</a>` : ''}
    </div>
  </div>
  
  ${sectionVisibility.summary && summary ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary">${summary}</div>
  </div>
  ` : ''}
  
  ${sectionVisibility.experience && experience.length > 0 ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${experience.map(exp => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <span class="entry-title">${exp.position}</span>
          <span class="entry-subtitle"> at ${exp.company}</span>
        </div>
        <span class="entry-date">${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || 'Present'}</span>
      </div>
      ${exp.location ? `<div style="font-size: 11px; color: #666;">${exp.location}</div>` : ''}
      <div class="entry-description">
        ${exp.description}
        ${exp.highlights && exp.highlights.length > 0 ? `
        <ul>
          ${exp.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
        ` : ''}
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${sectionVisibility.education && education.length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${education.map(edu => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <span class="entry-title">${edu.degree}${edu.field ? ` in ${edu.field}` : ''}</span>
          <span class="entry-subtitle"> - ${edu.school}</span>
        </div>
        <span class="entry-date">${edu.startDate} - ${edu.endDate || 'Present'}</span>
      </div>
      ${edu.gpa ? `<div style="font-size: 11px;">GPA: ${edu.gpa}</div>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${sectionVisibility.skills && skills.length > 0 ? `
  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skills-list">
      ${skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
    </div>
  </div>
  ` : ''}
  
  ${sectionVisibility.projects && projects.length > 0 ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projects.map(proj => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${proj.name}</span>
        ${proj.url ? `<a href="${proj.url}" style="font-size: 11px; color: ${colors.accent};">View Project</a>` : ''}
      </div>
      <div class="entry-description">${proj.description}</div>
      ${proj.technologies && proj.technologies.length > 0 ? `
      <div style="margin-top: 4px; font-size: 11px; color: #666;">
        Technologies: ${proj.technologies.join(', ')}
      </div>
      ` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}
  
  ${sectionVisibility.certifications && certifications.length > 0 ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    <div class="two-column">
      ${certifications.map(cert => `
      <div class="entry">
        <div class="entry-title">${cert.name}</div>
        <div style="font-size: 11px;">${cert.issuer}${cert.date ? ` • ${cert.date}` : ''}</div>
      </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  ${sectionVisibility.awards && awards.length > 0 ? `
  <div class="section">
    <div class="section-title">Awards & Achievements</div>
    ${awards.map(award => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${award.title}</span>
        <span class="entry-date">${award.date || ''}</span>
      </div>
      <div style="font-size: 11px;">${award.issuer}</div>
      ${award.description ? `<div class="entry-description">${award.description}</div>` : ''}
    </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>
  `.trim();
}

// Note: PDF generation requires puppeteer or similar library
// For now, we return HTML that can be printed to PDF from the browser
export async function generateResumePDF(resume: Resume): Promise<{ html: string; filename: string }> {
  const html = generateResumeHTML(resume);
  const filename = `${resume.title.replace(/[^a-zA-Z0-9]/g, '_')}_resume.pdf`;
  
  return { html, filename };
}
