import { chromium, FullConfig } from '@playwright/test';
import { TEST_USERS } from './helpers';

async function globalSetup(config: FullConfig) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Seed test users first
    const seedResponse = await page.request.post(`${baseUrl}/api/test-auth/seed`);
    if (!seedResponse.ok()) {
      console.warn('Failed to seed test users, continuing anyway...');
    }
    
    // Login with test user
    const loginResponse = await page.request.post(`${baseUrl}/api/test-auth/login`, {
      data: {
        email: TEST_USERS.testUser1.email,
        password: TEST_USERS.testUser1.password,
      },
    });
    
    if (loginResponse.ok()) {
      // Save storage state for reuse
      await context.storageState({ path: 'e2e/.auth/user.json' });
      console.log('✓ Test user logged in and session saved');
    } else {
      console.warn('Failed to login test user');
    }
  } catch (error) {
    console.error('Global setup error:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
