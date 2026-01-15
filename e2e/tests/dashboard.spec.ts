import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/dashboard');
    await waitForPageLoad(page);
  });

  test('should display Dashboard page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for greeting or dashboard content
    const hasGreeting = await page.getByText(/Hi,/).isVisible().catch(() => false);
    const hasActionPlan = await page.getByText(/action plan/).isVisible().catch(() => false);
    
    expect(hasGreeting || hasActionPlan).toBeTruthy();
  });

  test('should show user greeting', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText(/Hi,/)).toBeVisible();
  });

  test('should show statistics cards', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Resumes Created')).toBeVisible();
    await expect(page.getByText('Jobs Tracked')).toBeVisible();
  });

  test('should show progress section', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Your Progress')).toBeVisible();
  });

  test('should show AI Assistant section', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('AI Assistant')).toBeVisible();
  });

  test('should show Quick Actions section', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Quick Actions text is visible
    await expect(page.getByText('Quick Actions', { exact: true })).toBeVisible();
  });

  test('should show sidebar navigation', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for sidebar navigation items using exact match
    await expect(page.getByRole('link', { name: 'Resume Builder', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Job Tracker', exact: true })).toBeVisible();
  });
});
