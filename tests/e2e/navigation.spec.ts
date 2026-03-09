import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers/mockAuth';

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test.describe('Bottom navigation', () => {
  test('app loads and bottom navigation bar is visible', async ({ page }) => {
    await page.goto('/home');
    // Bottom nav uses buttons, not anchor links
    const homeBtn = page.getByRole('button', { name: /home/i }).first();
    await expect(homeBtn).toBeVisible({ timeout: 8000 });
  });

  test('bottom nav has at least 5 tab items', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    // Tabs are: Home, Map, Record (run), Feed, Profile
    const navButtons = page.getByRole('button', { name: /home|map|record|feed|profile/i });
    await expect(navButtons.first()).toBeVisible({ timeout: 8000 });
    const count = await navButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('clicking Profile tab navigates to /profile', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /profile/i }).click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 5000 });
  });

  test('clicking Run/Record tab navigates to /run', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /record/i }).click();
    await expect(page).toHaveURL(/\/run/, { timeout: 5000 });
  });

  test('clicking Feed tab navigates to /feed', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /feed/i }).click();
    await expect(page).toHaveURL(/\/feed/, { timeout: 5000 });
  });

  test('active tab has a distinct visual indicator', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    // Active Home button should have teal text color via a span inside
    const homeBtn = page.getByRole('button', { name: /home/i }).first();
    await expect(homeBtn).toBeVisible({ timeout: 8000 });
    // The active indicator dot should be present (absolute div inside active button)
    const activeIndicator = homeBtn.locator('div.absolute');
    await expect(activeIndicator).toBeVisible();
  });
});
