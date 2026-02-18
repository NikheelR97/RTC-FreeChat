import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
    // Signup flow
    const username = `Chatter_${Date.now()}`;
    await page.goto('/signup.html');
    await page.fill('#username', username);
    await page.fill('#password', 'password');
    await page.click('#signup-btn');
    await expect(page).toHaveURL(/\/$/);
});

test('user can send a message', async ({ page }) => {
    const messageText = `Hello Playwright! ${Date.now()}`;

    // Explicitly join general channel
    await page.waitForSelector('.channel-item');
    await page.click('.channel-item:has-text("# general")');
    await expect(page.locator('#current-channel-name')).toHaveText('general');

    // Type and send message
    await page.fill('#chat-input', messageText);
    await page.click('.dock-send-btn');

    // Verify message in chat - usage of .chat-text is correct based on ui-chat.js
    const messageLocator = page.locator('.chat-text', { hasText: messageText });
    await expect(messageLocator).toBeVisible();

    // Verify message bubble style for own message
    const bubbleLocator = page.locator('.chat-message.own-message', { hasText: messageText });
    await expect(bubbleLocator).toBeVisible();
});
