/**
 * JobH Chrome Extension - LinkedIn Content Script
 * Extracts job and profile information from LinkedIn pages
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'EXTRACT_JOB':
      const job = extractJobData();
      sendResponse({ job });
      break;
      
    case 'EXTRACT_PROFILE':
      const profile = extractProfileData();
      sendResponse({ profile });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true;
});

/**
 * Extract job data from LinkedIn job posting page
 * Selectors based on LinkedIn's current DOM structure (as of 2024)
 */
function extractJobData() {
  try {
    // Job title - multiple possible selectors
    const titleSelectors = [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title',
      '.t-24.t-bold.inline',
      'h1.topcard__title',
      '.jobs-details-top-card__job-title'
    ];
    const title = findText(titleSelectors) || 'Unknown Title';
    
    // Company name
    const companySelectors = [
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a',
      '.topcard__org-name-link',
      '.jobs-details-top-card__company-url'
    ];
    const company = findText(companySelectors) || 'Unknown Company';
    
    // Location
    const locationSelectors = [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
      '.jobs-details-top-card__bullet'
    ];
    const location = findText(locationSelectors) || '';
    
    // Salary (if available)
    const salarySelectors = [
      '.job-details-jobs-unified-top-card__job-insight span',
      '.compensation__salary',
      '[class*="salary"]'
    ];
    const salary = findSalary(salarySelectors) || '';
    
    // Job description
    const descriptionSelectors = [
      '.jobs-description__content',
      '.jobs-box__html-content',
      '.description__text'
    ];
    const description = findText(descriptionSelectors, true) || '';
    
    // Job URL
    const url = window.location.href;
    
    // Posted date
    const postedSelectors = [
      '.jobs-unified-top-card__posted-date',
      '.posted-time-ago__text'
    ];
    const posted = findText(postedSelectors) || '';
    
    // Tags/Skills
    const tags = extractTags();
    
    return {
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      salary: salary.trim(),
      description: description.substring(0, 500).trim(),
      url,
      posted: posted.trim(),
      tags,
      source: 'linkedin'
    };
  } catch (error) {
    console.error('Error extracting job data:', error);
    return null;
  }
}

/**
 * Extract profile data from LinkedIn profile page
 */
function extractProfileData() {
  try {
    // Profile photo
    const photoSelectors = [
      '.pv-top-card-profile-picture__image',
      '.profile-photo-edit__preview',
      '.presence-entity__image'
    ];
    const photoElement = findElement(photoSelectors);
    const hasPhoto = photoElement && photoElement.src && !photoElement.src.includes('ghost');
    
    // Headline
    const headlineSelectors = [
      '.text-body-medium.break-words',
      '.pv-top-card--list-bullet .text-body-medium',
      '.pv-top-card-profile-picture + div .text-body-medium'
    ];
    const headline = findText(headlineSelectors) || '';
    
    // Summary/About
    const summarySelectors = [
      '#about ~ div .inline-show-more-text',
      '.pv-about__summary-text',
      '[data-generated-suggestion-target="urn:li:fsu_profileActionDelegate"]'
    ];
    const summary = findText(summarySelectors, true) || '';
    
    // Experience count
    const experienceSection = document.querySelector('#experience');
    const experienceItems = experienceSection ? 
      experienceSection.parentElement.querySelectorAll('.artdeco-list__item') : [];
    const experience = Array.from(experienceItems).map(item => ({
      title: item.querySelector('.t-bold span')?.textContent?.trim() || '',
      company: item.querySelector('.t-normal span')?.textContent?.trim() || ''
    }));
    
    // Education count
    const educationSection = document.querySelector('#education');
    const educationItems = educationSection ? 
      educationSection.parentElement.querySelectorAll('.artdeco-list__item') : [];
    const education = Array.from(educationItems).map(item => ({
      school: item.querySelector('.t-bold span')?.textContent?.trim() || '',
      degree: item.querySelector('.t-normal span')?.textContent?.trim() || ''
    }));
    
    // Skills
    const skillsSection = document.querySelector('#skills');
    const skillItems = skillsSection ? 
      skillsSection.parentElement.querySelectorAll('.artdeco-list__item') : [];
    const skills = Array.from(skillItems).map(item => 
      item.querySelector('.t-bold span')?.textContent?.trim() || ''
    ).filter(Boolean);
    
    // Connections
    const connectionsSelectors = [
      '.pv-top-card--list-bullet .t-black--light span',
      '.pv-top-card-v2-ctas__connections'
    ];
    const connectionsText = findText(connectionsSelectors) || '0';
    const connections = parseInt(connectionsText.replace(/[^0-9]/g, '')) || 0;
    
    // Recommendations
    const recommendationsSection = document.querySelector('#recommendations');
    const recommendationItems = recommendationsSection ? 
      recommendationsSection.parentElement.querySelectorAll('.artdeco-list__item') : [];
    const recommendations = Array.from(recommendationItems).map(item => ({
      text: item.querySelector('.inline-show-more-text')?.textContent?.trim() || ''
    }));
    
    return {
      hasPhoto,
      headline: headline.trim(),
      summary: summary.trim(),
      experience,
      education,
      skills,
      connections,
      recommendations
    };
  } catch (error) {
    console.error('Error extracting profile data:', error);
    return null;
  }
}

/**
 * Helper function to find text from multiple selectors
 */
function findText(selectors, innerHTML = false) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return innerHTML ? element.innerHTML : element.textContent;
    }
  }
  return null;
}

/**
 * Helper function to find element from multiple selectors
 */
function findElement(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

/**
 * Helper function to find salary information
 */
function findSalary(selectors) {
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent;
      if (text && (text.includes('$') || text.includes('salary') || text.includes('/yr'))) {
        return text;
      }
    }
  }
  return null;
}

/**
 * Extract tags/skills from job posting
 */
function extractTags() {
  const tags = [];
  
  // Look for skills in the job description
  const skillKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'AWS',
    'SQL', 'MongoDB', 'Docker', 'Kubernetes', 'Git', 'Agile', 'Scrum',
    'Machine Learning', 'AI', 'Data Science', 'Product Management'
  ];
  
  const pageText = document.body.textContent.toLowerCase();
  
  for (const skill of skillKeywords) {
    if (pageText.includes(skill.toLowerCase())) {
      tags.push(skill);
    }
  }
  
  return tags.slice(0, 10); // Limit to 10 tags
}

// Inject save button into job posting page
function injectSaveButton() {
  // Check if we're on a job page
  if (!window.location.href.includes('/jobs/')) return;
  
  // Check if button already exists
  if (document.querySelector('.jobh-save-btn')) return;
  
  // Find the action buttons container
  const actionsContainer = document.querySelector('.jobs-save-button') || 
                          document.querySelector('.jobs-unified-top-card__content--two-pane');
  
  if (actionsContainer) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'jobh-save-btn';
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
      Save to JobH
    `;
    
    saveBtn.addEventListener('click', async () => {
      const job = extractJobData();
      if (job) {
        try {
          const response = await chrome.runtime.sendMessage({ action: 'SAVE_JOB', job });
          if (response.success) {
            saveBtn.innerHTML = '✓ Saved!';
            saveBtn.classList.add('saved');
          } else {
            alert(response.error || 'Failed to save job');
          }
        } catch (error) {
          alert('Please log in to JobH first');
        }
      }
    });
    
    actionsContainer.appendChild(saveBtn);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  injectSaveButton();
});

// Re-inject button on navigation (LinkedIn is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(injectSaveButton, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log('JobH LinkedIn content script loaded');
