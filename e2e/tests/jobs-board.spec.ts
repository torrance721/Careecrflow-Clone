import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('Jobs Board Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/jobs');
    await waitForPageLoad(page);
  });

  test('should display Jobs Board page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for Jobs Board title - exact text from screenshot
    await expect(page.getByText('Jobs Board')).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for search input - placeholder from screenshot
    await expect(page.getByPlaceholder(/Search jobs, companies, or skills/i)).toBeVisible();
  });

  test('should show job listings', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for job cards - screenshot shows "Senior Software Engineer" at Google
    const hasJobCards = await page.getByText('Senior Software Engineer').isVisible().catch(() => false);
    const hasCompany = await page.getByText('Google').isVisible().catch(() => false);
    
    expect(hasJobCards || hasCompany).toBeTruthy();
  });

  test('should have filter options', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for filter dropdowns - screenshot shows "Location" button and "All Types" dropdown
    const hasLocation = await page.getByRole('button', { name: /Location/i }).isVisible().catch(() => false);
    const hasTypes = await page.getByText('All Types').isVisible().catch(() => false);
    
    expect(hasLocation || hasTypes).toBeTruthy();
  });

  test('should show job count', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows "50 jobs found"
    await expect(page.getByText(/\d+ jobs found/)).toBeVisible();
  });
});
