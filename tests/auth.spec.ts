import { test, expect } from '@playwright/test';

test('user can log in with display name', async ({ page }) => {
    await page.goto('/');

    // Check initial state
    await expect(page.locator('#join-screen')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();

    // Fill display name
    await page.fill('#display-name-input', 'TestUser');
    await page.click('#join-button');

    // Verify transition
    await expect(page.locator('#join-screen')).toBeHidden();
    await expect(page.locator('#app')).toBeVisible();

    // Verify user name in UI
    // await expect(page.locator('#current-user-name')).toHaveText('TestUser');
    await expect(page.locator('#current-channel-name')).toBeVisible();
});
