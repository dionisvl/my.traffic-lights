import { test, expect, type BrowserContext } from '@playwright/test';

/**
 * Sets up a two-player game environment.
 * @param context - The browser context from Playwright.
 * @param questions - An array of strings representing the questions for the game.
 * @returns A promise that resolves to an object containing the pages for player 1 and player 2.
 */
async function setupTwoPlayerGame(context: BrowserContext, questions: string[]) {
  const player1Page = await context.newPage();
  const player2Page = await context.newPage();

  // Player 1 creates the game
  await player1Page.goto('/');
  await player1Page.getByLabel("I'm 18+").check();
  await player1Page.getByPlaceholder('Enter questions, one per line').fill(questions.join('\n'));
  await player1Page.getByRole('button', { name: 'Create Game' }).click();
  await expect(player1Page).toHaveURL(/\/game\/[a-f0-9-]+$/);
  const gameUrl = player1Page.url();

  // Player 2 joins via the shared link
  await player2Page.goto(gameUrl);

  // Wait for both players to be online and start the game
  await expect(player1Page.getByText('P2: Online')).toBeVisible({ timeout: 5000 });
  await expect(player2Page.getByText('P1: Online')).toBeVisible({ timeout: 5000 });

  await player1Page.getByRole('button', { name: 'Start Game' }).click();
  await expect(player1Page.getByRole('button', { name: 'Start Game' })).toBeHidden();

  // Verify the game has started for both players
  await expect(player1Page.getByText(`Question 1 of ${questions.length}`)).toBeVisible();
  await expect(player2Page.getByText(`Question 1 of ${questions.length}`)).toBeVisible();

  return { player1Page, player2Page };
}


test.describe('Basic Game Flow', () => {
  test('should create a game and show the waiting state', async ({ page }) => {
    await page.goto('/');
    
    await page.getByLabel("I'm 18+").check();
    await page.getByPlaceholder('Enter questions, one per line').fill('Test question 1\nTest question 2');
    await page.getByRole('button', { name: 'Create Game' }).click();
    
    await expect(page).toHaveURL(/\/game\/[a-f0-9-]+$/);
    await expect(page.getByText('Waiting for the second player...')).not.toBeVisible();
    
    // Check for player status indicators
    await expect(page.getByText('P1: Online')).toBeVisible();
    await expect(page.getByText('P2: Offline')).toBeVisible();

    // Assert that interactive elements are not visible for Player 1 in waiting state
    await expect(page.getByRole('button', { name: '🟢 Yes' })).not.toBeVisible();
    await expect(page.getByPlaceholder('Comment')).not.toBeVisible();
    await expect(page.getByLabel('Ready for next')).not.toBeVisible();

    await expect(page.getByText('Waiting for Player 2 to connect. Once Player 2 is online, you can start the game.')).toBeVisible();
  });

  test('should handle two players and show the results table', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['Do you like pizza?', 'Do you like ice cream?']);

    // Players choose answers for the first question
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    
    // The results table should appear and contain the answers
    await expect(player1Page.locator('table')).toBeVisible();
    await expect(player2Page.locator('table')).toBeVisible();
    
    await expect(player1Page.getByRole('cell', { name: '🟢' })).toBeVisible();
    await expect(player1Page.getByRole('cell', { name: '🔴' })).toBeVisible();
    await expect(player2Page.getByRole('cell', { name: '🟢' })).toBeVisible();
    await expect(player2Page.getByRole('cell', { name: '🔴' })).toBeVisible();
  });

  test('should reset the "ready" checkbox when the answer changes', async ({ context }) => {
    const { player1Page } = await setupTwoPlayerGame(context, ['Test question']);
    
    // Player 1 answers and marks as ready
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    const readyCheckbox = player1Page.getByLabel('Ready for next');
    await readyCheckbox.check();
    await expect(readyCheckbox).toBeChecked();
    
    // When the answer is changed, the checkbox should be unchecked
    await player1Page.getByRole('button', { name: '🔴 No' }).click();
    await expect(readyCheckbox).not.toBeChecked();
  });

  test('should complete the game and show the final message', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['Final question']);
    
    // Both players answer
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    
    // Both players mark themselves as ready
    await player1Page.getByLabel('Ready for next').check();
    await player2Page.getByLabel('Ready for next').check();
    
    // The game completion message should be visible to both players
    await expect(player1Page.getByText('Game completed')).toBeVisible();
    await expect(player2Page.getByText('Game completed')).toBeVisible();
  });

  test('should show real-time comment updates in the results', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['Comment test question']);
    
    // Players answer, and the results table appears
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    await expect(player1Page.locator('table')).toBeVisible();

    // Player 1 adds a comment
    await player1Page.getByPlaceholder('Comment').fill('Great choice!');
    
    // The comment should appear for both players
    await expect(player1Page.getByRole('cell', { name: 'Great choice!' })).toBeVisible();
    await expect(player2Page.getByRole('cell', { name: 'Great choice!' })).toBeVisible();
    
    // Player 2 adds a comment
    await player2Page.getByPlaceholder('Comment').fill('Not for me');
    
    // Both comments should now be visible to both players
    await expect(player1Page.getByRole('cell', { name: 'Not for me' })).toBeVisible();
    await expect(player2Page.getByRole('cell', { name: 'Not for me' })).toBeVisible();
  });
});
