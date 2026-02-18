import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should redirect to login page if not authenticated', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/.*login\.html/);
    });

    test('should allow user to sign up', async ({ page }) => {
        const timestamp = Date.now();
        const username = `testuser_${timestamp}`;
        const password = 'password123';

        await page.goto('/signup.html');
        await page.fill('#username', username);
        await page.fill('#password', password);
        await page.click('#signup-btn');

        // Should redirect to main app (root path)
        // We check for URL ending with / or just being the base URL
        await expect(page).toHaveURL(/\/$/);

        // Verify user name in UI (assuming #current-user-name exists from previous phases)
        // Wait for socket connection and UI update
        await expect(page.locator('#current-user-name')).toBeVisible();
        await expect(page.locator('#current-user-name')).toHaveText(username);
    });

    test('should allow user to log in', async ({ page }) => {
        // 1. Create a user first (since in-memory store is empty on restart)
        const timestamp = Date.now();
        const username = `loginuser_${timestamp}`;
        const password = 'password123';

        await page.goto('/signup.html');
        await page.fill('#username', username);
        await page.fill('#password', password);
        await page.click('#signup-btn');
        await expect(page).toHaveURL(/\/$/);

        // 2. Simulate Logout
        await page.evaluate(() => localStorage.removeItem('token'));
        await page.reload();
        await expect(page).toHaveURL(/.*login\.html/);

        // 3. Login with created user
        await page.fill('#username', username);
        await page.fill('#password', password);
        await page.click('#login-btn');

        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('#current-user-name')).toHaveText(username);
    });
});
