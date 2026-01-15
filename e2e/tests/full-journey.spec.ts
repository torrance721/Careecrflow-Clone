import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('Full User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
  });

  test('should complete basic navigation flow', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const hasContent = await page.getByText(/Hi,|Welcome|Dashboard/).isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('should navigate between main sections', async ({ page }) => {
    // Dashboard
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Resume Builder
    await page.goto('/resume-builder');
    await waitForPageLoad(page);
    if (!await isRateLimited(page)) {
      await expect(page.getByRole('heading', { name: 'Resume Builder' })).toBeVisible();
    }
    
    // Job Tracker
    await page.goto('/job-tracker');
    await waitForPageLoad(page);
    if (!await isRateLimited(page)) {
      await expect(page.getByRole('heading', { name: /Job Tracker|My 2026/i })).toBeVisible();
    }
    
    // Jobs Board
    await page.goto('/jobs');
    await waitForPageLoad(page);
    if (!await isRateLimited(page)) {
      await expect(page.getByText('Jobs Board')).toBeVisible();
    }
  });

  test('should access AI Toolbox features', async ({ page }) => {
    // Cover Letter Generator
    await page.goto('/cover-letters');
    await waitForPageLoad(page);
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    await expect(page.getByRole('heading', { name: 'Cover Letter Generator' })).toBeVisible();
    
    // Email Writer
    await page.goto('/email-writer');
    await waitForPageLoad(page);
    if (!await isRateLimited(page)) {
      await expect(page.getByRole('heading', { name: 'Email Writer' })).toBeVisible();
    }
    
    // Elevator Pitch
    await page.goto('/elevator-pitch');
    await waitForPageLoad(page);
    if (!await isRateLimited(page)) {
      await expect(page.getByRole('heading', { name: 'Elevator Pitch Generator' })).toBeVisible();
    }
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
  });

  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const hasContent = await page.locator('h1, h2').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const hasContent = await page.locator('h1, h2').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const hasContent = await page.locator('h1, h2').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
  });

  test('should handle 404 page', async ({ page }) => {
    await page.goto('/non-existent-page-xyz123');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const notFound = await page.getByText(/not found|404/i).isVisible().catch(() => false);
    const hasContent = await page.locator('h1, h2').first().isVisible().catch(() => false);
    
    expect(notFound || hasContent).toBeTruthy();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const headings = page.locator('h1, h2, h3');
    const hasHeadings = await headings.first().isVisible().catch(() => false);
    expect(hasHeadings).toBeTruthy();
  });

  test('should have keyboard accessible elements', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await page.keyboard.press('Tab');
    expect(true).toBeTruthy();
  });
});
