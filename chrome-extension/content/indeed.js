/**
 * JobH Chrome Extension - Indeed Content Script
 * Extracts job information from Indeed pages
 */

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'EXTRACT_JOB':
      const job = extractJobData();
      sendResponse({ job });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true;
});

/**
 * Extract job data from Indeed job posting page
 * Selectors based on Indeed's current DOM structure
 */
function extractJobData() {
  try {
    // Job title
    const titleSelectors = [
      '.jobsearch-JobInfoHeader-title',
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      '.icl-u-xs-mb--xs.icl-u-xs-mt--none.jobsearch-JobInfoHeader-title',
      'h1.jobTitle'
    ];
    const title = findText(titleSelectors) || 'Unknown Title';
    
    // Company name
    const companySelectors = [
      '[data-testid="inlineHeader-companyName"] a',
      '.jobsearch-InlineCompanyRating-companyHeader a',
      '.icl-u-lg-mr--sm.icl-u-xs-mr--xs a',
      '.companyName'
    ];
    const company = findText(companySelectors) || 'Unknown Company';
    
    // Location
    const locationSelectors = [
      '[data-testid="job-location"]',
      '[data-testid="inlineHeader-companyLocation"]',
      '.jobsearch-JobInfoHeader-subtitle .css-6z8o9s',
      '.companyLocation'
    ];
    const location = findText(locationSelectors) || '';
    
    // Salary
    const salarySelectors = [
      '[data-testid="attribute_snippet_testid"]',
      '.jobsearch-JobMetadataHeader-item',
      '.salary-snippet-container',
      '#salaryInfoAndJobType'
    ];
    const salary = findSalary(salarySelectors) || '';
    
    // Job description
    const descriptionSelectors = [
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[data-testid="jobsearch-JobComponent-description"]'
    ];
    const description = findText(descriptionSelectors, true) || '';
    
    // Job URL
    const url = window.location.href;
    
    // Job type (Full-time, Part-time, etc.)
    const jobTypeSelectors = [
      '[data-testid="attribute_snippet_testid"]',
      '.jobsearch-JobMetadataHeader-item'
    ];
    const jobType = findJobType(jobTypeSelectors) || '';
    
    // Tags/Skills
    const tags = extractTags(description);
    
    return {
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      salary: salary.trim(),
      description: cleanDescription(description).substring(0, 500).trim(),
      url,
      jobType: jobType.trim(),
      tags,
      source: 'indeed'
    };
  } catch (error) {
    console.error('Error extracting job data:', error);
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
 * Helper function to find salary information
 */
function findSalary(selectors) {
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent;
      if (text && (text.includes('$') || text.includes('a year') || text.includes('an hour'))) {
        return text.trim();
      }
    }
  }
  return null;
}

/**
 * Helper function to find job type
 */
function findJobType(selectors) {
  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent;
      for (const type of jobTypes) {
        if (text.toLowerCase().includes(type.toLowerCase())) {
          return type;
        }
      }
    }
  }
  return null;
}

/**
 * Clean HTML from description
 */
function cleanDescription(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

/**
 * Extract tags/skills from job description
 */
function extractTags(description) {
  const tags = [];
  const text = cleanDescription(description).toLowerCase();
  
  const skillKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'AWS',
    'SQL', 'MongoDB', 'Docker', 'Kubernetes', 'Git', 'Agile', 'Scrum',
    'Machine Learning', 'AI', 'Data Science', 'Excel', 'Communication',
    'Leadership', 'Project Management', 'Customer Service', 'Sales'
  ];
  
  for (const skill of skillKeywords) {
    if (text.includes(skill.toLowerCase())) {
      tags.push(skill);
    }
  }
  
  return tags.slice(0, 10);
}

// Inject save button into job posting page
function injectSaveButton() {
  // Check if button already exists
  if (document.querySelector('.jobh-save-btn')) return;
  
  // Find the action buttons container
  const actionsContainer = document.querySelector('.jobsearch-ViewJobButtons-container') ||
                          document.querySelector('.jobsearch-JobInfoHeader-title-container');
  
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
  setTimeout(injectSaveButton, 1000);
});

// Re-inject button on navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(injectSaveButton, 1000);
  }
}).observe(document, { subtree: true, childList: true });

console.log('JobH Indeed content script loaded');
