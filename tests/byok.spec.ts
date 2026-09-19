import { test, expect } from '@playwright/test';

test.describe('Community Edition BYOK Enforcement', () => {
  test('opens BYOK modal immediately on initial visit, blocks unkeyed prompts, and accepts key input', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 2. Expect BYOK modal to appear automatically if no keys are configured
    const modalHeading = page.getByRole('heading', { name: 'Bring Your Own Key (BYOK)' });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // Capture screenshot of initial modal
    await page.screenshot({
      path: '/Users/macbookprom116/.gemini/antigravity/brain/53a5c077-d95a-4073-86fd-bdb2262c708d/byok_modal_initial_load.png',
      fullPage: true,
    });

    // 3. Close the modal by clicking Cancel
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();
    await expect(modalHeading).toBeHidden();

    // 4. Try to send a prompt without a key
    const textarea = page.locator('textarea');
    if (await textarea.count() > 0) {
      await textarea.first().fill('Create a calculator in React');
      await textarea.first().press('Enter');

      // The modal must re-appear to block generation without a key
      await expect(modalHeading).toBeVisible({ timeout: 5000 });
      await page.screenshot({
        path: '/Users/macbookprom116/.gemini/antigravity/brain/53a5c077-d95a-4073-86fd-bdb2262c708d/byok_modal_on_prompt.png',
        fullPage: true,
      });

      // 5. Test entering a key into the modal
      const keyInput = page.locator('input[type="password"]');
      await expect(keyInput).toBeVisible();
      await keyInput.fill('sk-or-v1-testcommunitykey9988776655');

      const saveButton = page.getByRole('button', { name: 'Save Key & Start Coding' });
      await saveButton.click();

      // Modal should close upon saving
      await expect(modalHeading).toBeHidden({ timeout: 5000 });

      // 6. Test clicking the header "API Keys" button
      const headerKeyBtn = page.getByRole('button', { name: /API Keys/i });
      await expect(headerKeyBtn).toBeVisible();
      await headerKeyBtn.click();
      await expect(modalHeading).toBeVisible({ timeout: 5000 });
    }
  });
});
