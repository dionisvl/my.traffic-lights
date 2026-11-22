import { expect, test } from '@playwright/test';

test('two players can answer, cancel readiness and see the final results', async ({ page, browser, baseURL }) => {
  const peer = await browser.newContext({ baseURL });
  try {
    const other = await peer.newPage();
    await page.goto('/');
    await page.getByRole('checkbox', { name: "I'm 18+" }).check();
    await page.getByPlaceholder('Enter questions, one per line').fill('Test question');
    await page.getByRole('button', { name: 'Create Game', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+$/);
    await other.goto(page.url());
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(other.getByRole('heading', { name: 'Question 1 of 1' })).toBeVisible();

    await page.getByRole('button', { name: /Yes/ }).click();
    await page.getByRole('textbox', { name: 'Comment' }).fill('Shared after the round');
    await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(other.getByText('Shared after the round')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel ready' }).click();
    await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cancel ready' })).toBeEnabled();

    await other.getByRole('button', { name: /No/ }).click();
    await other.getByRole('button', { name: 'Ready', exact: true }).click();
    await expect(other.getByText('Game completed - all questions have been answered')).toBeVisible();
    await other.getByRole('link', { name: 'Open results' }).click();
    await expect(other.getByRole('table', { name: 'Game results' })).toContainText('Shared after the round');
  } finally {
    await peer.close();
  }
});
