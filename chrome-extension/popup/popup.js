/**
 * JobH Chrome Extension - Popup Script
 * Handles popup UI interactions and communication with background script
 */

// DOM Elements
const authStatus = document.getElementById('auth-status');
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const settingsSection = document.getElementById('settings-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsBtn = document.getElementById('settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiUrlInput = document.getElementById('api-url');
const openDashboard = document.getElementById('open-dashboard');

// Action buttons
const saveJobBtn = document.getElementById('save-job-btn');
const tailorResumeBtn = document.getElementById('tailor-resume-btn');
const coverLetterBtn = document.getElementById('cover-letter-btn');
const scoreProfileBtn = document.getElementById('score-profile-btn');
const viewTrackerBtn = document.getElementById('view-tracker-btn');
const aiToolsBtn = document.getElementById('ai-tools-btn');

// Resume selection elements
const resumeSelection = document.getElementById('resume-selection');
const resumeList = document.getElementById('resume-list');
const cancelTailorBtn = document.getElementById('cancel-tailor-btn');

// Tailor result elements
const tailorResult = document.getElementById('tailor-result');
const tailorContent = document.getElementById('tailor-content');
const copyTailorBtn = document.getElementById('copy-tailor-btn');
const openResumeBtn = document.getElementById('open-resume-btn');
const closeTailorBtn = document.getElementById('close-tailor-btn');

// User info elements
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');

// Stats elements
const savedCount = document.getElementById('saved-count');
const appliedCount = document.getElementById('applied-count');
const interviewCount = document.getElementById('interview-count');

// Page info
const pageInfo = document.getElementById('page-info');
const pageDetails = document.getElementById('page-details');

// State
let currentTab = null;
let pageType = null;
let isSettingsOpen = false;
let currentJobData = null;
let tailoredContent = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  // Detect page type
  detectPageType(tab.url);
  
  // Check auth status
  checkAuthStatus();
  
  // Load settings
  loadSettings();
  
  // Setup event listeners
  setupEventListeners();
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_AUTH_STATUS' });
    updateAuthUI(response);
  } catch (error) {
    console.error('Failed to check auth status:', error);
    updateAuthUI({ isLoggedIn: false });
  }
}

// Update UI based on auth status
function updateAuthUI(authState) {
  const statusDot = authStatus.querySelector('.status-dot');
  const statusText = authStatus.querySelector('.status-text');
  
  if (authState.isLoggedIn) {
    statusDot.classList.add('online');
    statusDot.classList.remove('offline');
    statusText.textContent = 'Connected';
    
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    
    // Update user info
    if (authState.user) {
      const initials = (authState.user.name || 'U').charAt(0).toUpperCase();
      userAvatar.textContent = initials;
      userName.textContent = authState.user.name || 'User';
      userEmail.textContent = authState.user.email || '';
    }
    
    // Load stats
    loadStats();
  } else {
    statusDot.classList.remove('online');
    statusDot.classList.add('offline');
    statusText.textContent = 'Not connected';
    
    loginSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
}

// Detect page type from URL
function detectPageType(url) {
  const pageTypeSpan = pageDetails.querySelector('.page-type');
  
  if (url.includes('linkedin.com/jobs')) {
    pageType = 'linkedin-job';
    pageTypeSpan.textContent = 'LinkedIn Job Posting';
    pageTypeSpan.classList.add('job-page');
    saveJobBtn.disabled = false;
    tailorResumeBtn.disabled = false;
    coverLetterBtn.disabled = false;
  } else if (url.includes('linkedin.com/in/')) {
    pageType = 'linkedin-profile';
    pageTypeSpan.textContent = 'LinkedIn Profile';
    pageTypeSpan.classList.add('profile-page');
    scoreProfileBtn.disabled = false;
  } else if (url.includes('indeed.com/viewjob') || url.includes('indeed.com/jobs')) {
    pageType = 'indeed-job';
    pageTypeSpan.textContent = 'Indeed Job Posting';
    pageTypeSpan.classList.add('job-page');
    saveJobBtn.disabled = false;
    tailorResumeBtn.disabled = false;
    coverLetterBtn.disabled = false;
  } else if (url.includes('glassdoor.com/job-listing') || url.includes('glassdoor.com/Job')) {
    pageType = 'glassdoor-job';
    pageTypeSpan.textContent = 'Glassdoor Job Posting';
    pageTypeSpan.classList.add('job-page');
    saveJobBtn.disabled = false;
    tailorResumeBtn.disabled = false;
    coverLetterBtn.disabled = false;
  } else {
    pageType = null;
    pageTypeSpan.textContent = 'Not a supported job page';
    pageTypeSpan.classList.remove('job-page', 'profile-page');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Login button
  loginBtn.addEventListener('click', () => {
    chrome.storage.local.get(['apiUrl'], (result) => {
      const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
      chrome.tabs.create({ url: baseUrl });
    });
  });
  
  // Logout button
  logoutBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'LOGOUT' });
    checkAuthStatus();
    showToast('Logged out successfully');
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    isSettingsOpen = !isSettingsOpen;
    if (isSettingsOpen) {
      mainSection.classList.add('hidden');
      loginSection.classList.add('hidden');
      settingsSection.classList.remove('hidden');
    } else {
      settingsSection.classList.add('hidden');
      checkAuthStatus();
    }
  });
  
  // Save settings button
  saveSettingsBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    if (apiUrl) {
      await chrome.runtime.sendMessage({ action: 'SET_API_URL', url: apiUrl });
      await chrome.storage.local.set({ apiUrl });
      showToast('Settings saved!', 'success');
      isSettingsOpen = false;
      settingsSection.classList.add('hidden');
      checkAuthStatus();
    }
  });
  
  // Open dashboard
  openDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.local.get(['apiUrl'], (result) => {
      const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
      chrome.tabs.create({ url: `${baseUrl}/dashboard` });
    });
  });
  
  // Save job button
  saveJobBtn.addEventListener('click', async () => {
    if (!pageType || !pageType.includes('job')) {
      showToast('Please navigate to a job posting first', 'error');
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_JOB' });
      
      if (response && response.job) {
        currentJobData = response.job;
        const saveResponse = await chrome.runtime.sendMessage({ 
          action: 'SAVE_JOB', 
          job: response.job 
        });
        
        if (saveResponse.success) {
          showToast('Job saved to tracker!', 'success');
          loadStats();
        } else {
          showToast(saveResponse.error || 'Failed to save job', 'error');
        }
      } else {
        showToast('Could not extract job information', 'error');
      }
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  });
  
  // Tailor Resume button
  tailorResumeBtn.addEventListener('click', async () => {
    if (!pageType || !pageType.includes('job')) {
      showToast('Please navigate to a job posting first', 'error');
      return;
    }
    
    try {
      // First extract job data
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_JOB' });
      
      if (response && response.job) {
        currentJobData = response.job;
        // Load user's resumes
        await loadResumes();
      } else {
        showToast('Could not extract job information', 'error');
      }
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  });
  
  // Cover Letter button
  coverLetterBtn.addEventListener('click', async () => {
    if (!pageType || !pageType.includes('job')) {
      showToast('Please navigate to a job posting first', 'error');
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_JOB' });
      
      if (response && response.job) {
        currentJobData = response.job;
        // Open AI Toolbox with job data
        chrome.storage.local.get(['apiUrl'], (result) => {
          const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
          const jobData = encodeURIComponent(JSON.stringify({
            title: response.job.title,
            company: response.job.company,
            description: response.job.description
          }));
          chrome.tabs.create({ url: `${baseUrl}/cover-letters?job=${jobData}` });
        });
      } else {
        showToast('Could not extract job information', 'error');
      }
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  });
  
  // Score profile button
  scoreProfileBtn.addEventListener('click', async () => {
    if (pageType !== 'linkedin-profile') {
      showToast('Please navigate to a LinkedIn profile first', 'error');
      return;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'EXTRACT_PROFILE' });
      
      if (response && response.profile) {
        const scoreResponse = await chrome.runtime.sendMessage({ 
          action: 'GET_LINKEDIN_SCORE', 
          profileData: response.profile 
        });
        
        if (scoreResponse.success) {
          showProfileScore(scoreResponse.score);
        } else {
          showToast(scoreResponse.error || 'Failed to calculate score', 'error');
        }
      } else {
        showToast('Could not extract profile information', 'error');
      }
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
  });
  
  // View tracker button
  viewTrackerBtn.addEventListener('click', () => {
    chrome.storage.local.get(['apiUrl'], (result) => {
      const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
      chrome.tabs.create({ url: `${baseUrl}/job-tracker` });
    });
  });
  
  // AI tools button
  aiToolsBtn.addEventListener('click', () => {
    chrome.storage.local.get(['apiUrl'], (result) => {
      const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
      chrome.tabs.create({ url: `${baseUrl}/cover-letters` });
    });
  });
  
  // Cancel tailor button
  cancelTailorBtn.addEventListener('click', () => {
    resumeSelection.classList.add('hidden');
    document.querySelector('.quick-actions').classList.remove('hidden');
    document.querySelector('.stats').classList.remove('hidden');
  });
  
  // Copy tailor button
  copyTailorBtn.addEventListener('click', () => {
    if (tailoredContent) {
      navigator.clipboard.writeText(tailoredContent).then(() => {
        showToast('Copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Failed to copy', 'error');
      });
    }
  });
  
  // Open resume button
  openResumeBtn.addEventListener('click', () => {
    chrome.storage.local.get(['apiUrl'], (result) => {
      const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
      chrome.tabs.create({ url: `${baseUrl}/resume-builder` });
    });
  });
  
  // Close tailor button
  closeTailorBtn.addEventListener('click', () => {
    tailorResult.classList.add('hidden');
    document.querySelector('.quick-actions').classList.remove('hidden');
    document.querySelector('.stats').classList.remove('hidden');
  });
}

// Load user's resumes
async function loadResumes() {
  try {
    showToast('Loading your resumes...', 'info');
    
    const response = await chrome.runtime.sendMessage({ action: 'GET_RESUMES' });
    
    if (response.success && response.resumes && response.resumes.length > 0) {
      // Hide other sections
      document.querySelector('.quick-actions').classList.add('hidden');
      document.querySelector('.stats').classList.add('hidden');
      
      // Show resume selection
      resumeSelection.classList.remove('hidden');
      
      // Populate resume list
      resumeList.innerHTML = response.resumes.map(resume => `
        <div class="resume-item" data-id="${resume.id}">
          <div class="resume-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="resume-info">
            <span class="resume-name">${resume.name || 'Untitled Resume'}</span>
            <span class="resume-date">${new Date(resume.updatedAt).toLocaleDateString()}</span>
          </div>
          <button class="btn btn-small btn-primary tailor-btn">Tailor</button>
        </div>
      `).join('');
      
      // Add click handlers to tailor buttons
      resumeList.querySelectorAll('.tailor-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const resumeId = e.target.closest('.resume-item').dataset.id;
          await tailorResume(resumeId);
        });
      });
    } else {
      showToast('No resumes found. Create one in JobH first.', 'error');
      chrome.storage.local.get(['apiUrl'], (result) => {
        const baseUrl = result.apiUrl || 'https://your-jobh-domain.com';
        chrome.tabs.create({ url: `${baseUrl}/resume-builder` });
      });
    }
  } catch (error) {
    showToast('Failed to load resumes: ' + error.message, 'error');
  }
}

// Tailor resume for the job
async function tailorResume(resumeId) {
  try {
    showToast('Tailoring your resume...', 'info');
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'TAILOR_RESUME', 
      resumeId,
      jobData: currentJobData
    });
    
    if (response.success) {
      tailoredContent = response.tailoredContent;
      
      // Hide resume selection
      resumeSelection.classList.add('hidden');
      
      // Show tailor result
      tailorResult.classList.remove('hidden');
      
      // Display tailored content
      tailorContent.innerHTML = `
        <div class="tailor-summary">
          <h4>Tailored for: ${currentJobData.title}</h4>
          <p class="company">${currentJobData.company}</p>
        </div>
        <div class="tailor-suggestions">
          <h4>Suggested Changes:</h4>
          <ul>
            ${response.suggestions.map(s => `<li>${s}</li>`).join('')}
          </ul>
        </div>
        <div class="skill-match">
          <h4>Skill Match: ${response.skillMatch}%</h4>
          <div class="progress-bar">
            <div class="progress" style="width: ${response.skillMatch}%"></div>
          </div>
        </div>
      `;
      
      showToast('Resume tailored successfully!', 'success');
    } else {
      showToast(response.error || 'Failed to tailor resume', 'error');
    }
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
}

// Load settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiUrl']);
  if (result.apiUrl) {
    apiUrlInput.value = result.apiUrl;
  }
}

// Load stats from backend
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_STATS' });
    
    if (response.success) {
      savedCount.textContent = response.stats.saved || '0';
      appliedCount.textContent = response.stats.applied || '0';
      interviewCount.textContent = response.stats.interviewing || '0';
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Show profile score
function showProfileScore(score) {
  const modal = document.createElement('div');
  modal.className = 'score-modal';
  modal.innerHTML = `
    <div class="score-content">
      <h2>LinkedIn Profile Score</h2>
      <div class="score-circle">
        <span class="score-value">${score.total}</span>
        <span class="score-max">/100</span>
      </div>
      <div class="score-breakdown">
        ${Object.entries(score.breakdown).map(([key, value]) => `
          <div class="score-item">
            <span class="score-label">${key}</span>
            <span class="score-points">${value}</span>
          </div>
        `).join('')}
      </div>
      ${score.suggestions.length > 0 ? `
        <div class="suggestions">
          <h3>Suggestions</h3>
          <ul>
            ${score.suggestions.slice(0, 3).map(s => `<li>${s.message}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <button class="btn btn-primary close-modal">Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.remove();
  });
}

// Show toast notification
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}
