import { Page } from '@playwright/test';

// Test user credentials
export const TEST_USERS = {
  testUser1: {
    email: 'testuser1@test.com',
    password: 'testpass123',
  },
  testUser2: {
    email: 'testuser2@test.com',
    password: 'testpass456',
  },
  adminUser: {
    email: 'admin@test.com',
    password: 'adminpass789',
  },
};

// Helper function to check if on login/auth page
export async function isAuthPage(page: Page): Promise<boolean> {
  const authTexts = [
    'Sign up', 'Sign in', 'Login', 'Sign in to continue',
    'Access to this dashboard requires authentication',
    'Sign up to UHired'
  ];
  
  for (const text of authTexts) {
    const isVisible = await page.getByText(text).isVisible().catch(() => false);
    if (isVisible) return true;
  }
  return false;
}

// Helper function to check if rate limited
export async function isRateLimited(page: Page): Promise<boolean> {
  const rateLimitTexts = [
    'Too many requests',
    'Please try again later',
    'Rate limit exceeded'
  ];
  
  for (const text of rateLimitTexts) {
    const isVisible = await page.getByText(text).isVisible().catch(() => false);
    if (isVisible) return true;
  }
  return false;
}

// Helper function to wait and retry if rate limited
export async function waitForPageLoad(page: Page, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    await page.waitForLoadState('networkidle');
    
    if (await isRateLimited(page)) {
      // Wait 5 seconds before retrying
      await page.waitForTimeout(5000);
      await page.reload();
    } else {
      return;
    }
  }
}

// Helper function to login with test user
export async function loginTestUser(page: Page, user = TEST_USERS.testUser1): Promise<boolean> {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    // Call test auth login API
    const response = await page.request.post(`${baseUrl}/api/test-auth/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
    });
    
    if (response.ok()) {
      // Reload page to apply session cookie
      await page.reload();
      await page.waitForLoadState('networkidle');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Login failed:', error);
    return false;
  }
}

// Helper function to logout test user
export async function logoutTestUser(page: Page): Promise<void> {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    await page.request.post(`${baseUrl}/api/test-auth/logout`);
  } catch (error) {
    console.error('Logout failed:', error);
  }
}

// Helper function to seed test users
export async function seedTestUsers(page: Page): Promise<boolean> {
  try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await page.request.post(`${baseUrl}/api/test-auth/seed`);
    return response.ok();
  } catch (error) {
    console.error('Seed failed:', error);
    return false;
  }
}
