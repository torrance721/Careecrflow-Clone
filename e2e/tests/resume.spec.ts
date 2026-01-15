import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('Resume Builder Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/resume-builder');
    await waitForPageLoad(page);
  });

  test('should display Resume Builder page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for Resume Builder heading
    await expect(page.getByRole('heading', { name: 'Resume Builder' })).toBeVisible();
  });

  test('should have Create New Resume button', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByRole('button', { name: /Create New Resume/i })).toBeVisible();
  });

  test('should have tabs for Base Resumes and Job Tailored', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Use role tab for more precise matching
    await expect(page.getByRole('tab', { name: /Base Resumes/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Job Tailored/i })).toBeVisible();
  });

  test('should show resume list or empty state', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows "No base resumes yet" empty state
    const hasEmptyState = await page.getByText('No base resumes yet').isVisible().catch(() => false);
    const hasCreateButton = await page.getByRole('button', { name: /Create Resume/i }).isVisible().catch(() => false);
    
    expect(hasEmptyState || hasCreateButton).toBeTruthy();
  });
});

test.describe('Resume Builder Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
  });

  test('should open create resume dialog', async ({ page }) => {
    await page.goto('/resume-builder');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await page.getByRole('button', { name: /Create New Resume/i }).click();
    await page.waitForTimeout(500);
    
    // Should navigate to editor or show dialog
    const isEditor = await page.url().includes('/resume/');
    const hasDialog = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    
    expect(isEditor || hasDialog).toBeTruthy();
  });

  test('should have search functionality', async ({ page }) => {
    await page.goto('/resume-builder');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows "Search resumes..." placeholder
    await expect(page.getByPlaceholder(/Search resumes/i)).toBeVisible();
  });
});
