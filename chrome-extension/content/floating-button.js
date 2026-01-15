/**
 * JobH Chrome Extension - Floating Button Component
 * Careerflow-style floating action button with panel
 */

(function() {
  'use strict';
  
  // Prevent multiple initializations
  if (window.jobhFloatingButtonInitialized) return;
  window.jobhFloatingButtonInitialized = true;

  class JobHFloatingButton {
    constructor() {
      this.isExpanded = false;
      this.container = null;
      this.panel = null;
      this.shadowRoot = null;
      this.jobData = null;
      this.baseUrl = 'https://3000-i2czjuajwubwpkedghhtt-00c2d68f.us1.manus.computer';
      
      this.init();
    }
    
    init() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.createButton());
      } else {
        // Small delay to ensure page is ready
        setTimeout(() => this.createButton(), 500);
      }
      
      // Listen for URL changes (SPA navigation)
      this.observeUrlChanges();
    }
    
    createButton() {
      // Don't create if already exists
      if (document.querySelector('#jobh-extension-root')) return;
      
      // Create container using Shadow DOM for style isolation
      const shadowHost = document.createElement('div');
      shadowHost.id = 'jobh-extension-root';
      shadowHost.style.cssText = 'position: fixed; z-index: 2147483647; right: 0; bottom: 0; pointer-events: none;';
      document.body.appendChild(shadowHost);
      
      this.shadowRoot = shadowHost.attachShadow({ mode: 'open' });
      
      // Inject styles inline (more reliable than external CSS in shadow DOM)
      const style = document.createElement('style');
      style.textContent = this.getStyles();
      this.shadowRoot.appendChild(style);
      
      // Create main container
      this.container = document.createElement('div');
      this.container.className = 'jobh-floating-container';
      this.container.innerHTML = this.getButtonHTML();
      this.shadowRoot.appendChild(this.container);
      
      // Store panel reference
      this.panel = this.container.querySelector('.jobh-panel');
      
      // Bind events
      this.bindEvents();
      
      // Extract job data if on job page
      this.extractJobData();
      
      console.log('JobH floating button initialized');
    }
    
    getStyles() {
      return `
        /* Container for the floating button */
        .jobh-floating-container {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          pointer-events: auto;
        }

        /* Main floating button */
        .jobh-floating-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          outline: none;
        }

        .jobh-floating-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .jobh-floating-btn:active {
          transform: scale(0.95);
        }

        .jobh-floating-btn.expanded {
          background: linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%);
        }

        /* Logo inside button */
        .jobh-floating-btn .jobh-logo {
          width: 32px;
          height: 32px;
          color: white;
          transition: transform 0.3s ease;
        }

        .jobh-floating-btn.expanded .jobh-logo {
          transform: rotate(45deg);
        }

        /* Expanded panel */
        .jobh-panel {
          position: absolute;
          bottom: 70px;
          right: 0;
          width: 280px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
          opacity: 0;
          visibility: hidden;
          transform: translateY(10px) scale(0.95);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .jobh-panel.visible {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        /* Panel header */
        .jobh-panel-header {
          background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
          padding: 16px 20px;
          color: white;
        }

        .jobh-panel-header h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .jobh-panel-header p {
          margin: 0;
          font-size: 12px;
          opacity: 0.9;
        }

        /* Panel content */
        .jobh-panel-content {
          padding: 12px;
        }

        /* Action buttons */
        .jobh-action-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 8px;
          text-align: left;
          font-family: inherit;
          font-size: 14px;
        }

        .jobh-action-btn:last-child {
          margin-bottom: 0;
        }

        .jobh-action-btn:hover {
          background: #EFF6FF;
          border-color: #3B82F6;
          transform: translateX(4px);
        }

        .jobh-action-btn:active {
          transform: translateX(2px);
        }

        .jobh-action-btn .icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .jobh-action-btn .icon.save {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        }

        .jobh-action-btn .icon.resume {
          background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        }

        .jobh-action-btn .icon.cover {
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
        }

        .jobh-action-btn .icon svg {
          width: 20px;
          height: 20px;
          color: white;
        }

        .jobh-action-btn .text {
          flex: 1;
        }

        .jobh-action-btn .text .title {
          font-size: 14px;
          font-weight: 600;
          color: #1E293B;
          margin-bottom: 2px;
        }

        .jobh-action-btn .text .desc {
          font-size: 11px;
          color: #64748B;
        }

        .jobh-action-btn .arrow {
          color: #94A3B8;
          transition: transform 0.2s ease;
        }

        .jobh-action-btn:hover .arrow {
          transform: translateX(4px);
          color: #3B82F6;
        }

        /* Success state */
        .jobh-action-btn.success {
          background: #ECFDF5;
          border-color: #10B981;
        }

        .jobh-action-btn.success .text .title {
          color: #059669;
        }

        /* Loading state */
        .jobh-action-btn.loading {
          opacity: 0.7;
          pointer-events: none;
        }

        .jobh-action-btn.loading .icon {
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Panel footer */
        .jobh-panel-footer {
          padding: 12px 16px;
          border-top: 1px solid #E2E8F0;
          background: #F8FAFC;
        }

        .jobh-panel-footer a {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #64748B;
          text-decoration: none;
          font-size: 12px;
          transition: color 0.2s ease;
        }

        .jobh-panel-footer a:hover {
          color: #3B82F6;
        }

        /* Toast notification */
        .jobh-toast {
          position: fixed;
          bottom: 90px;
          right: 20px;
          background: #1E293B;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.3s ease;
          z-index: 2147483648;
          pointer-events: none;
        }

        .jobh-toast.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .jobh-toast.success {
          background: #059669;
        }

        .jobh-toast.error {
          background: #DC2626;
        }
      `;
    }
    
    getButtonHTML() {
      return `
        <!-- Main floating button -->
        <button class="jobh-floating-btn" id="jobh-main-btn" title="JobH - Job Search Assistant">
          <svg class="jobh-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        </button>
        
        <!-- Expanded panel -->
        <div class="jobh-panel" id="jobh-panel">
          <div class="jobh-panel-header">
            <h3>JobH Assistant</h3>
            <p>Supercharge your job search</p>
          </div>
          
          <div class="jobh-panel-content">
            <!-- Save Job Button -->
            <button class="jobh-action-btn" id="jobh-save-job">
              <div class="icon save">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="text">
                <div class="title">Save Job</div>
                <div class="desc">Add to your Job Tracker</div>
              </div>
              <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
            
            <!-- Tailor Resume Button -->
            <button class="jobh-action-btn" id="jobh-tailor-resume">
              <div class="icon resume">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div class="text">
                <div class="title">Tailor Resume</div>
                <div class="desc">Customize for this job</div>
              </div>
              <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
            
            <!-- Cover Letter Button -->
            <button class="jobh-action-btn" id="jobh-cover-letter">
              <div class="icon cover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div class="text">
                <div class="title">Cover Letter</div>
                <div class="desc">Generate tailored letter</div>
              </div>
              <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
          
          <div class="jobh-panel-footer">
            <a href="${this.baseUrl}" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open JobH Dashboard
            </a>
          </div>
        </div>
        
        <!-- Toast notification -->
        <div class="jobh-toast" id="jobh-toast"></div>
      `;
    }
    
    bindEvents() {
      // Main button click - use arrow function to preserve 'this'
      const mainBtn = this.shadowRoot.querySelector('#jobh-main-btn');
      mainBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePanel();
      });
      
      // Save job button
      const saveBtn = this.shadowRoot.querySelector('#jobh-save-job');
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.saveJob();
      });
      
      // Tailor resume button
      const resumeBtn = this.shadowRoot.querySelector('#jobh-tailor-resume');
      resumeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.tailorResume();
      });
      
      // Cover letter button
      const coverBtn = this.shadowRoot.querySelector('#jobh-cover-letter');
      coverBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.generateCoverLetter();
      });
      
      // Close panel when clicking outside (on the main document)
      document.addEventListener('click', (e) => {
        // Check if click is outside our shadow host
        const shadowHost = document.querySelector('#jobh-extension-root');
        if (this.isExpanded && shadowHost && !shadowHost.contains(e.target)) {
          this.closePanel();
        }
      });
      
      // Keyboard shortcut (Alt+J)
      document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'j') {
          e.preventDefault();
          this.togglePanel();
        }
      });
    }
    
    togglePanel() {
      this.isExpanded = !this.isExpanded;
      const mainBtn = this.shadowRoot.querySelector('#jobh-main-btn');
      const panel = this.shadowRoot.querySelector('#jobh-panel');
      
      if (this.isExpanded) {
        mainBtn.classList.add('expanded');
        panel.classList.add('visible');
        this.extractJobData(); // Refresh job data
      } else {
        mainBtn.classList.remove('expanded');
        panel.classList.remove('visible');
      }
    }
    
    closePanel() {
      this.isExpanded = false;
      const mainBtn = this.shadowRoot.querySelector('#jobh-main-btn');
      const panel = this.shadowRoot.querySelector('#jobh-panel');
      mainBtn.classList.remove('expanded');
      panel.classList.remove('visible');
    }
    
    extractJobData() {
      // Detect which job site we're on
      const url = window.location.href;
      
      if (url.includes('linkedin.com')) {
        this.jobData = this.extractLinkedInJob();
      } else if (url.includes('indeed.com')) {
        this.jobData = this.extractIndeedJob();
      } else if (url.includes('glassdoor.com')) {
        this.jobData = this.extractGlassdoorJob();
      }
      
      return this.jobData;
    }
    
    extractLinkedInJob() {
      try {
        // Job title
        const titleSelectors = [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.job-details-jobs-unified-top-card__job-title a',
          '.jobs-unified-top-card__job-title',
          '.t-24.t-bold.inline',
          'h1.topcard__title',
          '.jobs-details-top-card__job-title',
          'h1 a',
          '.job-details-jobs-unified-top-card__job-title'
        ];
        const title = this.findText(titleSelectors) || 'Unknown Title';
        
        // Company name
        const companySelectors = [
          '.job-details-jobs-unified-top-card__company-name a',
          '.job-details-jobs-unified-top-card__primary-description-container a',
          '.jobs-unified-top-card__company-name a',
          '.topcard__org-name-link',
          '.jobs-details-top-card__company-url'
        ];
        const company = this.findText(companySelectors) || 'Unknown Company';
        
        // Location
        const locationSelectors = [
          '.job-details-jobs-unified-top-card__bullet',
          '.jobs-unified-top-card__bullet',
          '.topcard__flavor--bullet',
          '.jobs-details-top-card__bullet'
        ];
        const location = this.findText(locationSelectors) || '';
        
        // Job description
        const descriptionSelectors = [
          '.jobs-description__content',
          '.jobs-box__html-content',
          '.description__text'
        ];
        const description = this.findText(descriptionSelectors, true) || '';
        
        return {
          title: title.trim(),
          company: company.trim(),
          location: location.trim(),
          description: description.substring(0, 2000).trim(),
          url: window.location.href,
          source: 'linkedin'
        };
      } catch (error) {
        console.error('Error extracting LinkedIn job:', error);
        return null;
      }
    }
    
    extractIndeedJob() {
      try {
        const title = document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent || 'Unknown Title';
        const company = document.querySelector('[data-company-name]')?.textContent || 'Unknown Company';
        const location = document.querySelector('[data-testid="job-location"]')?.textContent || '';
        const description = document.querySelector('#jobDescriptionText')?.innerHTML || '';
        
        return {
          title: title.trim(),
          company: company.trim(),
          location: location.trim(),
          description: description.substring(0, 2000).trim(),
          url: window.location.href,
          source: 'indeed'
        };
      } catch (error) {
        console.error('Error extracting Indeed job:', error);
        return null;
      }
    }
    
    extractGlassdoorJob() {
      try {
        const title = document.querySelector('[data-test="job-title"]')?.textContent || 'Unknown Title';
        const company = document.querySelector('[data-test="employer-name"]')?.textContent || 'Unknown Company';
        const location = document.querySelector('[data-test="location"]')?.textContent || '';
        const description = document.querySelector('.jobDescriptionContent')?.innerHTML || '';
        
        return {
          title: title.trim(),
          company: company.trim(),
          location: location.trim(),
          description: description.substring(0, 2000).trim(),
          url: window.location.href,
          source: 'glassdoor'
        };
      } catch (error) {
        console.error('Error extracting Glassdoor job:', error);
        return null;
      }
    }
    
    findText(selectors, innerHTML = false) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return innerHTML ? element.innerHTML : element.textContent;
        }
      }
      return null;
    }
    
    async saveJob() {
      const saveBtn = this.shadowRoot.querySelector('#jobh-save-job');
      
      if (!this.jobData) {
        this.showToast('Could not extract job data', 'error');
        return;
      }
      
      // Show loading state
      saveBtn.classList.add('loading');
      
      try {
        // Send to background script
        const response = await chrome.runtime.sendMessage({
          action: 'SAVE_JOB',
          job: this.jobData
        });
        
        if (response && response.success) {
          saveBtn.classList.remove('loading');
          saveBtn.classList.add('success');
          saveBtn.querySelector('.title').textContent = 'Saved!';
          this.showToast('Job saved to tracker!', 'success');
          
          // Reset after 2 seconds
          setTimeout(() => {
            saveBtn.classList.remove('success');
            saveBtn.querySelector('.title').textContent = 'Save Job';
          }, 2000);
        } else {
          throw new Error(response?.error || 'Failed to save');
        }
      } catch (error) {
        saveBtn.classList.remove('loading');
        this.showToast(error.message || 'Failed to save job. Please log in first.', 'error');
      }
    }
    
    tailorResume() {
      if (!this.jobData) {
        this.showToast('Could not extract job data', 'error');
        return;
      }
      
      // Encode job data and open resume builder
      const params = new URLSearchParams({
        company: this.jobData.company,
        position: this.jobData.title,
        source: this.jobData.source
      });
      
      const url = `${this.baseUrl}/resume-builder?${params.toString()}`;
      window.open(url, '_blank');
      
      this.showToast('Opening Resume Builder...', 'success');
      this.closePanel();
    }
    
    generateCoverLetter() {
      if (!this.jobData) {
        this.showToast('Could not extract job data', 'error');
        return;
      }
      
      // Encode job data and open cover letter generator
      const params = new URLSearchParams({
        company: this.jobData.company,
        position: this.jobData.title,
        source: this.jobData.source
      });
      
      const url = `${this.baseUrl}/cover-letter?${params.toString()}`;
      window.open(url, '_blank');
      
      this.showToast('Opening Cover Letter Generator...', 'success');
      this.closePanel();
    }
    
    showToast(message, type = 'info') {
      const toast = this.shadowRoot.querySelector('#jobh-toast');
      toast.textContent = message;
      toast.className = `jobh-toast visible ${type}`;
      
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 3000);
    }
    
    observeUrlChanges() {
      let lastUrl = location.href;
      
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          // Re-extract job data on navigation
          setTimeout(() => this.extractJobData(), 1000);
        }
      }).observe(document, { subtree: true, childList: true });
    }
  }

  // Initialize the floating button
  new JobHFloatingButton();

  console.log('JobH floating button script loaded');
})();
