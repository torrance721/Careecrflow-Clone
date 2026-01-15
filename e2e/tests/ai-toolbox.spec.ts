import { test, expect } from '@playwright/test';
import { isRateLimited, waitForPageLoad, loginTestUser, TEST_USERS } from './helpers';

test.describe('Cover Letter Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/cover-letters');
    await waitForPageLoad(page);
  });

  test('should display Cover Letter Generator page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Cover Letter Generator')).toBeVisible();
  });

  test('should have job title input', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.locator('input#jobTitle')).toBeVisible();
  });

  test('should have company name input', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.locator('input#companyName')).toBeVisible();
  });

  test('should have Generate button', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Generate Cover Letter')).toBeVisible();
  });
});

test.describe('Email Writer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/email-writer');
    await waitForPageLoad(page);
  });

  test('should display Email Writer page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Email Writer')).toBeVisible();
  });

  test('should have email type options', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const hasFollowUp = await page.getByText('Follow-up Email').isVisible().catch(() => false);
    const hasThankYou = await page.getByText('Thank You Email').isVisible().catch(() => false);
    
    expect(hasFollowUp || hasThankYou).toBeTruthy();
  });

  test('should have Generate button', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText('Generate Email')).toBeVisible();
  });
});

test.describe('Elevator Pitch Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginTestUser(page, TEST_USERS.testUser1);
    await page.goto('/elevator-pitch');
    await waitForPageLoad(page);
  });

  test('should display Elevator Pitch page', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    // Screenshot shows "Elevator Pitch Generator" as the title
    await expect(page.getByRole('heading', { name: 'Elevator Pitch Generator' })).toBeVisible();
  });

  test('should have duration options', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    const has30s = await page.getByText(/30 seconds|30s/).isVisible().catch(() => false);
    const has60s = await page.getByText(/60 seconds|60s/).isVisible().catch(() => false);
    const has90s = await page.getByText(/90 seconds|90s/).isVisible().catch(() => false);
    
    expect(has30s || has60s || has90s).toBeTruthy();
  });

  test('should have Generate button', async ({ page }) => {
    if (await isRateLimited(page)) {
      test.skip();
      return;
    }
    
    await expect(page.getByText(/Generate.*Pitch/)).toBeVisible();
  });
});
