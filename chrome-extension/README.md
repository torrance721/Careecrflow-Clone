# JobH Chrome Extension

A Chrome extension that helps you save jobs from LinkedIn, Indeed, and Glassdoor with one click, and provides LinkedIn profile scoring.

## Features

### Job Saving
- **LinkedIn**: Save job postings directly from LinkedIn job pages
- **Indeed**: Save job postings from Indeed search results and job detail pages
- **Glassdoor**: Save job postings from Glassdoor job listings

### LinkedIn Profile Scoring
- Get a comprehensive score (0-100) for your LinkedIn profile
- Breakdown by category: Photo, Headline, Summary, Experience, Education, Skills, Connections, Recommendations
- Actionable suggestions to improve your profile

### Quick Actions
- View your Job Tracker
- Access AI Tools (Cover Letter, Email Writer, Elevator Pitch)
- See your job search statistics

## Installation

### Development Mode
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project

### Configuration
1. Click the JobH extension icon
2. Click the settings (gear) icon
3. Enter your JobH API URL (e.g., `https://your-domain.com/api`)
4. Click "Save Settings"

## Usage

### Saving Jobs
1. Navigate to a job posting on LinkedIn, Indeed, or Glassdoor
2. Click the "Save to JobH" button that appears on the page, OR
3. Click the extension icon and click "Save Job"

### LinkedIn Profile Score
1. Navigate to any LinkedIn profile page
2. Click the extension icon
3. Click "Profile Score" to see the analysis

## File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── src/
│   └── background.js      # Service worker for auth & API calls
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── content/
│   ├── linkedin.js        # LinkedIn content script
│   ├── indeed.js          # Indeed content script
│   ├── glassdoor.js       # Glassdoor content script
│   └── styles.css         # Injected styles
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Permissions

- `storage`: Store user settings and auth state
- `activeTab`: Access current tab for job extraction
- `tabs`: Detect page type and inject content scripts

## Host Permissions

- `linkedin.com/*`: Job and profile extraction
- `indeed.com/*`: Job extraction
- `glassdoor.com/*`: Job extraction

## Development

### Testing
The extension logic is tested via Vitest. Run tests with:
```bash
pnpm test server/chromeExtension.test.ts
```

### Building for Production
1. Update version in `manifest.json`
2. Create a ZIP file of the `chrome-extension` folder
3. Upload to Chrome Web Store

## Troubleshooting

### Extension not working
1. Check that you're logged into JobH on the main website
2. Verify the API URL is correctly configured
3. Refresh the page and try again

### Jobs not saving
1. Make sure you're on a supported job page
2. Check the browser console for errors
3. Verify your authentication status in the extension popup

## Privacy

This extension only collects job posting data when you explicitly click "Save". No browsing data is tracked or stored without user action.
