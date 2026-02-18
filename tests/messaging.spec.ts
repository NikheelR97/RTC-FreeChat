import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#display-name-input', 'Chatter');
    await page.click('#join-button');
});

test('user can send a message', async ({ page }) => {
    const messageText = `Hello Playwright! ${Date.now()}`;

    // Wait for channel auto-join
    await expect(page.locator('#current-channel-name')).not.toHaveText('Select Channel');

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
