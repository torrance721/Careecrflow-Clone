/**
 * JobH Chrome Extension - Background Service Worker
 * Handles authentication, API calls, and cross-tab communication
 */

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://3000-igtg2dtkoewk0tidir605-446b72e1.us2.manus.computer/api', // UHired API
  AUTH_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// State
let authState = {
  isLoggedIn: false,
  user: null,
  token: null,
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('JobH Extension installed');
  checkAuthStatus();
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'GET_AUTH_STATUS':
      sendResponse(authState);
      break;
      
    case 'SAVE_JOB':
      saveJobToTracker(request.job)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
      
    case 'GET_LINKEDIN_SCORE':
      calculateLinkedInScore(request.profileData)
        .then(score => sendResponse({ success: true, score }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_RESUMES':
      getResumes()
        .then(resumes => sendResponse({ success: true, resumes }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'TAILOR_RESUME':
      tailorResume(request.resumeId, request.jobData)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'GET_STATS':
      getJobStats()
        .then(stats => sendResponse({ success: true, stats }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'SET_API_URL':
      CONFIG.API_BASE_URL = request.url;
      chrome.storage.local.set({ apiUrl: request.url });
      sendResponse({ success: true });
      break;
      
    case 'LOGIN':
      handleLogin(request.credentials)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'LOGOUT':
      handleLogout();
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const stored = await chrome.storage.local.get(['authToken', 'user', 'apiUrl']);
    
    if (stored.apiUrl) {
      CONFIG.API_BASE_URL = stored.apiUrl;
    }
    
    if (stored.authToken) {
      // Verify token with server
      const response = await fetch(`${CONFIG.API_BASE_URL}/trpc/auth.me`, {
        headers: {
          'Authorization': `Bearer ${stored.authToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        authState = {
          isLoggedIn: true,
          user: data.result?.data || stored.user,
          token: stored.authToken,
        };
      } else {
        // Token invalid, clear auth
        await chrome.storage.local.remove(['authToken', 'user']);
        authState = { isLoggedIn: false, user: null, token: null };
      }
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

// Handle login
async function handleLogin(credentials) {
  try {
    // For now, we'll use cookie-based auth from the main site
    // User needs to log in on the main site first
    await checkAuthStatus();
    return { success: authState.isLoggedIn, user: authState.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle logout
async function handleLogout() {
  await chrome.storage.local.remove(['authToken', 'user']);
  authState = { isLoggedIn: false, user: null, token: null };
}

// Save job to tracker
async function saveJobToTracker(job) {
  if (!authState.isLoggedIn) {
    throw new Error('Please log in to save jobs');
  }
  
  const response = await fetch(`${CONFIG.API_BASE_URL}/trpc/jobTracker.create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authState.token}`,
    },
    body: JSON.stringify({
      json: {
        jobTitle: job.title,
        companyName: job.company,
        location: job.location,
        salary: job.salary || '',
        jobUrl: job.url,
        description: job.description || '',
        status: 'saved',
        source: job.source,
        tags: job.tags || [],
      },
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to save job');
  }
  
  return await response.json();
}

// Get user's resumes
async function getResumes() {
  if (!authState.isLoggedIn) {
    throw new Error('Please log in to view resumes');
  }
  
  const response = await fetch(`${CONFIG.API_BASE_URL}/trpc/resume.list`, {
    headers: {
      'Authorization': `Bearer ${authState.token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to load resumes');
  }
  
  const data = await response.json();
  return data.result?.data || [];
}

// Tailor resume for job
async function tailorResume(resumeId, jobData) {
  if (!authState.isLoggedIn) {
    throw new Error('Please log in to tailor resume');
  }
  
  const response = await fetch(`${CONFIG.API_BASE_URL}/trpc/resume.tailorForJob`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authState.token}`,
    },
    body: JSON.stringify({
      json: {
        resumeId,
        jobTitle: jobData.title,
        companyName: jobData.company,
        jobDescription: jobData.description,
        jobUrl: jobData.url,
      },
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to tailor resume');
  }
  
  const data = await response.json();
  const result = data.result?.data;
  
  return {
    tailoredContent: result?.tailoredContent || '',
    suggestions: result?.suggestions || [],
    skillMatch: result?.skillMatch || 0,
    tailoredResumeId: result?.tailoredResumeId,
  };
}

// Get job stats
async function getJobStats() {
  if (!authState.isLoggedIn) {
    return { saved: 0, applied: 0, interviewing: 0 };
  }
  
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/trpc/jobTracker.getStats`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`,
      },
    });
    
    if (!response.ok) {
      return { saved: 0, applied: 0, interviewing: 0 };
    }
    
    const data = await response.json();
    return data.result?.data || { saved: 0, applied: 0, interviewing: 0 };
  } catch (error) {
    console.error('Failed to get stats:', error);
    return { saved: 0, applied: 0, interviewing: 0 };
  }
}

// Calculate LinkedIn profile score
async function calculateLinkedInScore(profileData) {
  const scores = {
    photo: profileData.hasPhoto ? 10 : 0,
    headline: calculateHeadlineScore(profileData.headline),
    summary: calculateSummaryScore(profileData.summary),
    experience: calculateExperienceScore(profileData.experience),
    education: calculateEducationScore(profileData.education),
    skills: calculateSkillsScore(profileData.skills),
    connections: calculateConnectionsScore(profileData.connections),
    recommendations: calculateRecommendationsScore(profileData.recommendations),
  };
  
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  return {
    total: totalScore,
    breakdown: scores,
    suggestions: generateSuggestions(scores, profileData),
  };
}

function calculateHeadlineScore(headline) {
  if (!headline) return 0;
  const length = headline.length;
  if (length >= 100) return 15;
  if (length >= 50) return 10;
  if (length >= 20) return 5;
  return 2;
}

function calculateSummaryScore(summary) {
  if (!summary) return 0;
  const length = summary.length;
  if (length >= 500) return 15;
  if (length >= 200) return 10;
  if (length >= 100) return 5;
  return 2;
}

function calculateExperienceScore(experience) {
  if (!experience || experience.length === 0) return 0;
  const count = experience.length;
  if (count >= 5) return 20;
  if (count >= 3) return 15;
  if (count >= 1) return 10;
  return 0;
}

function calculateEducationScore(education) {
  if (!education || education.length === 0) return 0;
  return education.length >= 1 ? 10 : 0;
}

function calculateSkillsScore(skills) {
  if (!skills || skills.length === 0) return 0;
  const count = skills.length;
  if (count >= 10) return 10;
  if (count >= 5) return 7;
  if (count >= 1) return 3;
  return 0;
}

function calculateConnectionsScore(connections) {
  if (!connections) return 0;
  if (connections >= 500) return 10;
  if (connections >= 200) return 7;
  if (connections >= 50) return 4;
  return 2;
}

function calculateRecommendationsScore(recommendations) {
  if (!recommendations || recommendations.length === 0) return 0;
  const count = recommendations.length;
  if (count >= 5) return 10;
  if (count >= 2) return 6;
  if (count >= 1) return 3;
  return 0;
}

function generateSuggestions(scores, profileData) {
  const suggestions = [];
  
  if (scores.photo === 0) {
    suggestions.push({
      priority: 'high',
      category: 'photo',
      message: 'Add a professional profile photo to increase profile views by up to 21x',
    });
  }
  
  if (scores.headline < 10) {
    suggestions.push({
      priority: 'high',
      category: 'headline',
      message: 'Expand your headline to include keywords and value proposition (aim for 100+ characters)',
    });
  }
  
  if (scores.summary < 10) {
    suggestions.push({
      priority: 'medium',
      category: 'summary',
      message: 'Write a compelling About section (500+ characters) highlighting your achievements',
    });
  }
  
  if (scores.experience < 15) {
    suggestions.push({
      priority: 'medium',
      category: 'experience',
      message: 'Add more work experience entries with detailed descriptions and achievements',
    });
  }
  
  if (scores.skills < 7) {
    suggestions.push({
      priority: 'low',
      category: 'skills',
      message: 'Add at least 10 relevant skills to improve searchability',
    });
  }
  
  if (scores.recommendations < 3) {
    suggestions.push({
      priority: 'low',
      category: 'recommendations',
      message: 'Request recommendations from colleagues to build credibility',
    });
  }
  
  return suggestions;
}

// Periodic auth check
setInterval(checkAuthStatus, CONFIG.AUTH_CHECK_INTERVAL);
