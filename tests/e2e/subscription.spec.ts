import { test, expect } from '@playwright/test';
import { mockAuth } from './helpers/mockAuth';

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test.describe('Subscription page', () => {
  test('page renders without error', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.locator('h1, h2').filter({ hasText: /upgrade runivo/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('"Upgrade Runivo" heading is visible', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByText(/upgrade runivo/i)).toBeVisible({ timeout: 8000 });
  });

  test('all 3 tier cards are visible', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Runner Plus' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('heading', { name: 'Territory Lord' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Empire Builder' })).toBeVisible();
  });

  test('Runner Plus price "$4.99/mo" is visible', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByText('$4.99/mo')).toBeVisible({ timeout: 8000 });
  });

  test('Territory Lord shows "Most Popular" badge', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByText(/most popular/i)).toBeVisible({ timeout: 8000 });
  });

  test('Empire Builder price "$19.99/mo" is visible', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByText('$19.99/mo')).toBeVisible({ timeout: 8000 });
  });

  test('Subscribe buttons are present for a free-tier user', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    const upgradeButtons = page.getByRole('button', { name: /upgrade to/i });
    await expect(upgradeButtons.first()).toBeVisible({ timeout: 8000 });
    const count = await upgradeButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('back arrow button is visible in header', async ({ page }) => {
    await page.goto('/subscription');
    // Back button is always the first button in the sticky header
    const backBtn = page.locator('button').first();
    await expect(backBtn).toBeVisible({ timeout: 8000 });
  });
});
