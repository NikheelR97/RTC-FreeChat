import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#display-name-input', 'Navigator');
    await page.click('#join-button');
});

test('user can switch channels', async ({ page }) => {
    // Join Text Channel
    await page.waitForSelector('.channel-item');
    await page.click('.channel-item:has-text("# general")');
    await expect(page.locator('#current-channel-name')).toHaveText('general');

    // Join Voice Channel
    await page.click('.channel-item:has-text("# Lounge")');

    // Verify Voice Panel appears
    await expect(page.locator('#voice-panel')).toBeVisible();
    await expect(page.locator('#voice-channel-name')).toHaveText('Lounge');

    // Verify Voice Controls
    await expect(page.locator('#voice-disconnect-btn')).toBeVisible();
});
