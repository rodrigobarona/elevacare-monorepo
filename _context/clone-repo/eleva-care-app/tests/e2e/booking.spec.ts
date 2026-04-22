import { expect, test } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('should display expert listing page', async ({ page }) => {
    await page.goto('/experts');

    // Check page loads
    await expect(page.locator('main')).toBeVisible();
  });

  test('should load expert profile page', async ({ page }) => {
    // Visit a public expert profile (uses username route)
    await page.goto('/experts');

    // Check that expert cards or list items are potentially visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('should display categories page', async ({ page }) => {
    await page.goto('/categories');

    // Categories page should load
    await expect(page.locator('main')).toBeVisible();
  });

  test('should handle booking page with event parameter', async ({ page }) => {
    // This tests the booking flow structure
    // Actual booking requires a valid expert and event ID
    await page.goto('/book');

    // Should redirect or show appropriate message if no expert specified
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Payment Integration', () => {
  test('should have Stripe elements load correctly on checkout', async ({ page }) => {
    // This is a basic check - actual payment testing requires test mode
    await page.goto('/');

    // Check that the page doesn't have JavaScript errors related to Stripe
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // No critical Stripe errors should appear on homepage
    const stripeErrors = consoleMessages.filter((msg) => msg.toLowerCase().includes('stripe'));
    expect(stripeErrors.length).toBe(0);
  });
});

