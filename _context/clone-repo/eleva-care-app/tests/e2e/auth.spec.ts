import { expect, test } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    // Try to access a protected route (dashboard)
    await page.goto('/dashboard');

    // Should be redirected to login page or show auth prompt
    // WorkOS AuthKit handles this - check for sign-in button or redirect
    await expect(page).toHaveURL(/login|sign-in|auth/i);
  });

  test('should display sign in button on homepage', async ({ page }) => {
    await page.goto('/');

    // Look for sign in link/button in header
    const signInButton = page.getByRole('link', { name: /sign in|log in/i });
    await expect(signInButton).toBeVisible();
  });

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto('/');

    // Check for security headers
    const headers = response?.headers() || {};

    // Content-Security-Policy or X-Content-Type-Options should be present
    expect(headers['x-content-type-options'] || headers['content-security-policy']).toBeDefined();
  });

  test('should handle login page load', async ({ page }) => {
    await page.goto('/login');

    // Page should load without errors
    // WorkOS AuthKit will handle the actual login flow
    await expect(page).not.toHaveTitle(/error/i);
  });
});

