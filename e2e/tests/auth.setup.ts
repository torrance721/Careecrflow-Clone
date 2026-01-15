import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // 由于 OAuth 登录需要真实用户交互，我们使用已登录的浏览器状态
  // 首先尝试访问一个受保护的页面
  await page.goto('/dashboard');
  
  // 检查是否已登录
  const isLoggedIn = await page.getByText(/Hi,|Welcome|Dashboard/).isVisible().catch(() => false);
  
  if (!isLoggedIn) {
    // 如果未登录，跳过认证测试
    // E2E 测试将只测试公开页面
    console.log('Not logged in, skipping auth setup');
  }
  
  // 保存认证状态
  await page.context().storageState({ path: authFile });
});
