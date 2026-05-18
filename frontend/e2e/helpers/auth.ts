import { Page } from '@playwright/test';

// Default mock credentials (must match auth.ts mockUsers)
export const TEST_ADMIN = {
  email: 'admin@ki-os.local',
  password: 'orbit-demo',
};

export async function loginAs(page: Page, user = TEST_ADMIN) {
  await page.goto('/login');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}
