import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('LinkedIn Import Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/linkedin-import');
    await waitForPageLoad(page);
  });

  test('should display LinkedIn Import page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for page title - exact text from screenshot
    await expect(page.getByRole('heading', { name: 'Import from LinkedIn' })).toBeVisible();
  });

  test('should have import instructions', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows "How to export your LinkedIn profile:" section
    await expect(page.getByText('How to export your LinkedIn profile')).toBeVisible();
  });

  test('should have upload area', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows "Drag and drop your LinkedIn PDF here" and "Browse Files" button
    const hasDragDrop = await page.getByText('Drag and drop your LinkedIn PDF here').isVisible().catch(() => false);
    const hasBrowseButton = await page.getByRole('button', { name: 'Browse Files' }).isVisible().catch(() => false);
    
    expect(hasDragDrop || hasBrowseButton).toBeTruthy();
  });

  test('should show step indicators', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows steps: Upload, Processing, Review, Complete
    await expect(page.getByText('Upload', { exact: true })).toBeVisible();
    await expect(page.getByText('Processing')).toBeVisible();
  });
});
