import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('#display-name-input', 'Chatter');
    await page.click('#join-button');
});

test('user can send a message', async ({ page }) => {
    const messageText = 'Hello Playwright!';

    // Type and send message
    await page.fill('#chat-input', messageText);
    await page.click('#send-btn');

    // Verify message in chat
    const messageLocator = page.locator('.message-content', { hasText: messageText });
    await expect(messageLocator).toBeVisible();

    // Verify author
    await expect(page.locator('.message-author', { hasText: 'Chatter' })).toBeVisible();
});
