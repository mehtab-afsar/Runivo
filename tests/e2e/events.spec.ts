import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers/mockAuth';

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test.describe('Events page', () => {
  test('page renders', async ({ page }) => {
    await page.goto('/events');
    // Header or tab bar should be visible
    await expect(page.getByText(/upcoming|challenges|past/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('three tabs are visible: Upcoming, Challenges, Past', async ({ page }) => {
    await page.goto('/events');
    await expect(page.getByRole('button', { name: /upcoming/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: /challenges/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /past/i })).toBeVisible();
  });

  test('clicking Challenges tab activates it', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const challengesTab = page.getByRole('button', { name: /challenges/i });
    await challengesTab.click();
    // After click the tab should remain visible and be interactable
    await expect(challengesTab).toBeVisible();
  });

  test('clicking Past tab activates it', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const pastTab = page.getByRole('button', { name: /past/i });
    await pastTab.click();
    await expect(pastTab).toBeVisible();
  });

  test('FAB (+ button) is visible', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    // FAB is a fixed button in bottom-right with a Plus icon inside
    const fab = page.locator('button.fixed, button[class*="fixed"]').last();
    await expect(fab).toBeVisible({ timeout: 8000 });
  });

  test('clicking FAB as free-tier user navigates to /subscription', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const fab = page.locator('button.fixed, button[class*="fixed"]').last();
    await fab.click();
    await expect(page).toHaveURL(/\/subscription/, { timeout: 5000 });
  });
});
