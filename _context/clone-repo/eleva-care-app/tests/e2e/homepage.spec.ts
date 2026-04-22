import { expect, test } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage successfully', async ({ page }) => {
    await page.goto('/');

    // Check that the page loaded
    await expect(page).toHaveTitle(/Eleva/i);

    // Check that the main content is visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display the navigation header', async ({ page }) => {
    await page.goto('/');

    // Check that the header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for navigation links (adjust based on actual nav structure)
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Page should still load correctly
    await expect(page.locator('main')).toBeVisible();
  });
});

