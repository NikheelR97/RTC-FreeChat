import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    // Signup flow
    const username = `Navigator_${Date.now()}`;
    await page.goto('/signup.html');
    await page.fill('#username', username);
    await page.fill('#password', 'password');
    await page.click('#signup-btn');
    // Wait for redirect and socket connection
    await expect(page).toHaveURL(/\/$/);
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
