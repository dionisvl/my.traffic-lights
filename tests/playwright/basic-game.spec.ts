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
  await player1Page.locator('input[type="checkbox"]').check();
  await player1Page.getByPlaceholder('Enter questions, one per line').fill(questions.join('\n'));
  
  // Wait for the Create Game button to be enabled
  const createButton = player1Page.getByRole('button', { name: 'Create Game' });
  await expect(createButton).toBeEnabled();
  await createButton.click();
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
  await expect(player1Page.getByText(`Question #1`)).toBeVisible();
  await expect(player2Page.getByText(`Question #1`)).toBeVisible();

  return { player1Page, player2Page };
}


test.describe('Basic Game Flow', () => {
  test('should create a game and show the waiting state', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('input[type="checkbox"]').check();
    await page.getByPlaceholder('Enter questions, one per line').fill('Test question 1\nTest question 2');
    
    // Wait for the Create Game button to be enabled
    const createButton = page.getByRole('button', { name: 'Create Game' });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    
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

  test('should keep final answers logical after chaotic toggles across 4 questions', async ({ context }) => {
    const questions = ['Q1', 'Q2', 'Q3', 'Q4'];
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, questions);

    const p1Ready = player1Page.getByLabel('Ready for next');
    const p2Ready = player2Page.getByLabel('Ready for next');

    // Q1 (normal): P1=🟢, P2=🔴
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    await p1Ready.check();
    await p2Ready.check();
    await expect(player1Page.getByText('Question #2')).toBeVisible();
    await expect(player2Page.getByText('Question #2')).toBeVisible();

    // Q2 (chaotic): final P1=🟢, P2=🔴
    // P1 plays around; changes answer resets ready automatically
    await player1Page.getByRole('button', { name: '🔴 No' }).click();
    await p1Ready.check();
    await player1Page.getByRole('button', { name: '🟡 Maybe' }).click();
    await expect(p1Ready).not.toBeChecked();
    // Keep P1 not ready for now
    // P2 plays around and ends up ready with 🔴
    await player2Page.getByRole('button', { name: '🟢 Yes' }).click();
    await p2Ready.check();
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    await expect(p2Ready).not.toBeChecked();
    await p2Ready.check();
    // P1 sets final 🟢 and becomes ready
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await p1Ready.check();
    // Both should now advance
    await expect(player1Page.getByText('Question #3')).toBeVisible();
    await expect(player2Page.getByText('Question #3')).toBeVisible();

    // Q3 (more chaos): final P1=🔴, P2=🟡
    // P2 toggles answers; changes auto-reset ready; keep P2 not ready until the end
    await player2Page.getByRole('button', { name: '🟡 Maybe' }).click();
    await p2Ready.check();
    await player2Page.getByRole('button', { name: '🟢 Yes' }).click();
    await expect(p2Ready).not.toBeChecked();
    await player2Page.getByRole('button', { name: '🟡 Maybe' }).click();
    await expect(p2Ready).not.toBeChecked();
    // P1 toggles and ends up ready with 🔴
    await player1Page.getByRole('button', { name: '🟡 Maybe' }).click();
    await p1Ready.check();
    await player1Page.getByRole('button', { name: '🔴 No' }).click();
    await expect(p1Ready).not.toBeChecked();
    await p1Ready.check();
    // Now confirm P2 final maybe and ready to advance
    await p2Ready.check();
    // Proceed to Q4
    await expect(player1Page.getByText('Question #4')).toBeVisible();
    await expect(player2Page.getByText('Question #4')).toBeVisible();

    // Q4 (normal): final P1=🔴, P2=🟢
    await player1Page.getByRole('button', { name: '🔴 No' }).click();
    await player2Page.getByRole('button', { name: '🟢 Yes' }).click();
    await p1Ready.check();
    await p2Ready.check();

    // Game should complete
    await expect(player1Page.getByText('Game completed')).toBeVisible();
    await expect(player2Page.getByText('Game completed')).toBeVisible();

    // Helper to assert a row shows expected emojis for both players
    async function expectRow(page, questionText: string, p1Emoji: string, p2Emoji: string) {
      const row = page.locator('tbody tr').filter({ hasText: questionText });
      await expect(row).toHaveCount(1);
      // New table layout has a leading # column; adjust indices
      await expect(row.getByRole('cell').nth(2)).toHaveText(p1Emoji);
      await expect(row.getByRole('cell').nth(4)).toHaveText(p2Emoji);
    }

    // Validate final results table (8 answers = 4 per player)
    await expect(player1Page.locator('table')).toBeVisible();
    await expectRow(player1Page, 'Q1', '🟢', '🔴');
    await expectRow(player1Page, 'Q2', '🟢', '🔴');
    await expectRow(player1Page, 'Q3', '🔴', '🟡');
    await expectRow(player1Page, 'Q4', '🔴', '🟢');

    // Cross-check on player 2 page as well
    await expectRow(player2Page, 'Q1', '🟢', '🔴');
    await expectRow(player2Page, 'Q2', '🟢', '🔴');
    await expectRow(player2Page, 'Q3', '🔴', '🟡');
    await expectRow(player2Page, 'Q4', '🔴', '🟢');
  });

  test('should show correct partner status messages during answer flow', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['What is your favorite color?']);
    
    // Initial state: Both players see "Partner is choosing..." with spinner
    await expect(player1Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player1Page.locator('.spinner')).toBeVisible();
    await expect(player2Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player2Page.locator('.spinner')).toBeVisible();
    
    // Player 1 chooses an answer but doesn't mark ready yet
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    
    // Player 2 should still see spinner until partner marks ready
    await expect(player2Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player2Page.locator('.spinner')).toBeVisible();
    
    // Player 1 should still see "Partner is choosing..." with spinner since Player 2 hasn't answered
    await expect(player1Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player1Page.locator('.spinner')).toBeVisible();
    
    // Player 2 chooses an answer but doesn't mark ready yet
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    
    // Player 1 should still see spinner until partner marks ready
    await expect(player1Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player1Page.locator('.spinner')).toBeVisible();
    
    // Player 1 marks ready
    await player1Page.getByLabel('Ready for next').check();
    
    // Player 2 should now see "Partner is ready"
    await expect(player2Page.getByText('Partner is ready')).toBeVisible();
    await expect(player2Page.locator('.spinner')).not.toBeVisible();
    
    // Player 1 should still see spinner since Player 2 is not ready yet
    await expect(player1Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player1Page.locator('.spinner')).toBeVisible();
    
    // Player 2 marks ready
    await player2Page.getByLabel('Ready for next').check();
    
    // Game should complete since this is the only question
    await expect(player1Page.getByText('Game completed')).toBeVisible();
    await expect(player2Page.getByText('Game completed')).toBeVisible();
  });
});
