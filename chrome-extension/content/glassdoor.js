/**
 * JobH Chrome Extension - Glassdoor Content Script
 * Extracts job information from Glassdoor pages
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
 * Extract job data from Glassdoor job posting page
 * Selectors based on Glassdoor's current DOM structure
 */
function extractJobData() {
  try {
    // Job title
    const titleSelectors = [
      '[data-test="jobTitle"]',
      '.e1tk4kwz4',
      '.css-1vg6q84.e1tk4kwz4',
      'h1.jobTitle'
    ];
    const title = findText(titleSelectors) || 'Unknown Title';
    
    // Company name
    const companySelectors = [
      '.EmployerProfile_compactEmployerName__9MGcV',
      '[data-test="employerName"]',
      '.e1tk4kwz1',
      '.css-87uc0g.e1tk4kwz1',
      '.employerName'
    ];
    const company = findText(companySelectors) || 'Unknown Company';
    
    // Location
    const locationSelectors = [
      '[data-test="location"]',
      '.e1tk4kwz2',
      '.css-56kyx5.e1tk4kwz2',
      '.location'
    ];
    const location = findText(locationSelectors) || '';
    
    // Salary
    const salarySelectors = [
      '[data-test="detailSalary"]',
      '.css-1bluz6i',
      '.salary-estimate'
    ];
    const salary = findText(salarySelectors) || '';
    
    // Job description
    const descriptionSelectors = [
      '[data-test="jobDescription"]',
      '.jobDescriptionContent',
      '.desc'
    ];
    const description = findText(descriptionSelectors, true) || '';
    
    // Job URL
    const url = window.location.href;
    
    // Company rating
    const ratingSelectors = [
      '[data-test="rating"]',
      '.e1tk4kwz0',
      '.rating'
    ];
    const rating = findText(ratingSelectors) || '';
    
    // Tags/Skills
    const tags = extractTags(description);
    
    return {
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      salary: salary.trim(),
      description: cleanDescription(description).substring(0, 500).trim(),
      url,
      rating: rating.trim(),
      tags,
      source: 'glassdoor'
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
    'Leadership', 'Project Management', 'Customer Service', 'Sales',
    'C++', 'Go', 'Ruby', 'PHP', 'Swift', 'Kotlin'
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
  const actionsContainer = document.querySelector('[data-test="applyButton"]')?.parentElement ||
                          document.querySelector('.css-1j389vi');
  
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

console.log('JobH Glassdoor content script loaded');
