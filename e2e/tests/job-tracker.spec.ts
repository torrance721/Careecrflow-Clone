import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('Job Tracker Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/job-tracker');
    await waitForPageLoad(page);
  });

  test('should display Job Tracker page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for page title - screenshot shows "My 2026 Job Search"
    await expect(page.getByRole('heading', { name: /My 2026 Job Search|Job Tracker/i })).toBeVisible();
  });

  test('should show Kanban columns', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for status columns - screenshot shows Saved, Interviewing, Offer
    const hasSaved = await page.getByText('Saved', { exact: true }).isVisible().catch(() => false);
    const hasInterviewing = await page.getByText('Interviewing', { exact: true }).isVisible().catch(() => false);
    const hasOffer = await page.getByText('Offer', { exact: true }).isVisible().catch(() => false);
    
    expect(hasSaved || hasInterviewing || hasOffer).toBeTruthy();
  });

  test('should have Add Job button', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByRole('button', { name: /Add Job/i })).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByPlaceholder(/Search jobs/i)).toBeVisible();
  });

  test('should show statistics', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Total Jobs')).toBeVisible();
  });
});

test.describe('Job Tracker Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
  });

  test('should open Add Job dialog', async ({ page }) => {
    await page.goto('/job-tracker');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await page.getByRole('button', { name: /Add Job/i }).click();
    await page.waitForTimeout(500);
    
    // Check for dialog title "Add New Job"
    await expect(page.getByText('Add New Job')).toBeVisible();
  });

  test('should have form fields in Add Job dialog', async ({ page }) => {
    await page.goto('/job-tracker');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await page.getByRole('button', { name: /Add Job/i }).click();
    await page.waitForTimeout(500);
    
    // Check for form fields - screenshot shows Job Title *, Company Name *, Location, Salary, etc.
    const hasJobTitle = await page.getByText('Job Title').isVisible().catch(() => false);
    const hasCompanyName = await page.getByText('Company Name').isVisible().catch(() => false);
    const hasLocation = await page.getByText('Location').isVisible().catch(() => false);
    const hasSalary = await page.getByText('Salary').isVisible().catch(() => false);
    
    expect(hasJobTitle || hasCompanyName || hasLocation || hasSalary).toBeTruthy();
  });

  test('should filter jobs by status', async ({ page }) => {
    await page.goto('/job-tracker');
    await waitForPageLoad(page);
    
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Check for status filter dropdown - screenshot shows "All Status"
    await expect(page.getByText('All Status')).toBeVisible();
  });
});
