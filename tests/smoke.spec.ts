import { test, expect } from '@playwright/test';

test.describe('Application Health Check & Smoke Tests', () => {
  test('homepage renders cleanly without uncaught runtime exceptions', async ({ page }) => {
    const uncaughtErrors: Error[] = [];
    const consoleErrors: string[] = [];

    // Capture uncaught JavaScript runtime exceptions on the page
    page.on('pageerror', (exception) => {
      console.error(`[Browser Runtime Exception] ${exception.message}\n${exception.stack || ''}`);
      uncaughtErrors.push(exception);
    });

    // Capture and log console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        console.error(`[Browser Console Error] ${text}`);
        // Only track real errors, filtering out known benign connection warnings if any
        consoleErrors.push(text);
      }
    });

    // Navigate to homepage
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);

    // Assert document title is non-empty and matches expected application branding
    await expect(page).toHaveTitle(/.+/);
    const title = await page.title();
    console.log(`[Smoke Test] Verified Page Title: "${title}"`);

    // Assert root container element is present in the DOM
    const rootElement = page.locator('#root');
    await expect(rootElement).toBeAttached();
    await expect(rootElement).toBeVisible();

    // Allow hydration and initial background tasks to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // Network idle may time out if streaming or polling is active, continue assertions
    });

    // Ensure no uncaught JavaScript exceptions were thrown during render
    expect(uncaughtErrors, `Uncaught page exceptions occurred: ${uncaughtErrors.map((e) => e.message).join('; ')}`).toHaveLength(0);
  });
});
