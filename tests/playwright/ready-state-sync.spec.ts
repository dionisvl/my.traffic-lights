import { test, expect, type BrowserContext } from '@playwright/test';

/**
 * Sets up a two-player game environment.
 */
async function setupTwoPlayerGame(context: BrowserContext, questions: string[]) {
  const player1Page = await context.newPage();
  const player2Page = await context.newPage();

  // Player 1 creates the game
  await player1Page.goto('/');
  // Check the "I'm 18+" checkbox if it's not already checked
  const adultCheckbox = player1Page.locator('input[type="checkbox"]');
  if (!(await adultCheckbox.isChecked())) {
    await adultCheckbox.check();
  }
  await player1Page.getByPlaceholder('Enter questions, one per line').fill(questions.join('\n'));

  const createButton = player1Page.getByRole('button', { name: 'Create Game' });
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await expect(player1Page).toHaveURL(/\/game\/[a-f0-9-]+$/);
  const gameUrl = player1Page.url();

  // Player 2 joins
  await player2Page.goto(gameUrl);

  // Wait for both players to be online and start the game
  await expect(player1Page.getByText('P2: Online')).toBeVisible({ timeout: 5000 });
  await expect(player2Page.getByText('P1: Online')).toBeVisible({ timeout: 5000 });

  await player1Page.getByRole('button', { name: 'Start Game' }).click();

  // Verify game started
  await expect(player1Page.getByText(`Question #1`)).toBeVisible();
  await expect(player2Page.getByText(`Question #1`)).toBeVisible();

  return { player1Page, player2Page };
}

test.describe('Ready State Synchronization Bug Fix', () => {
  test('should reset ready checkbox when player edits comment after marking ready', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['Do you like pizza?']);

    // Player 1 chooses answer and marks ready
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    const p1ReadyCheckbox = player1Page.getByLabel('Ready for next');
    await p1ReadyCheckbox.check();
    await expect(p1ReadyCheckbox).toBeChecked();

    // Player 2 should see "Partner is ready" since Player 1 is ready
    await expect(player2Page.getByText('Partner is ready')).toBeVisible();

    // Player 1 starts typing a comment - this should reset their ready state
    const commentBox = player1Page.getByPlaceholder('Comment');
    await commentBox.fill('I love pizza!');

    // The ready checkbox should automatically uncheck (client-side fix)
    await expect(p1ReadyCheckbox).not.toBeChecked();

    // Player 2 should now see spinner again because Player 1 is no longer ready (server-side fix)
    await expect(player2Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player2Page.locator('.spinner')).toBeVisible();
  });

  test('should synchronize ready state when both players edit comments after being ready', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['What is your favorite color?']);

    const p1ReadyCheckbox = player1Page.getByLabel('Ready for next');
    const p2ReadyCheckbox = player2Page.getByLabel('Ready for next');

    // Player 1 chooses answer and marks ready
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await p1ReadyCheckbox.check();

    // Player 2 should see "Partner is ready" after Player 1 marks ready
    await expect(player2Page.getByText('Partner is ready')).toBeVisible();

    // Player 1 adds a comment - should reset their ready state
    await player1Page.getByPlaceholder('Comment').fill('Green is nice');
    await expect(p1ReadyCheckbox).not.toBeChecked();
    await expect(player2Page.getByText('Partner is choosing…')).toBeVisible();

    // Player 2 chooses answer and marks ready
    await player2Page.getByRole('button', { name: '🔴 No' }).click();
    await p2ReadyCheckbox.check();

    // Both players mark ready - game should progress
    await p1ReadyCheckbox.check();

    // Game should complete since this is the only question
    await expect(player1Page.getByText('Game completed')).toBeVisible();
    await expect(player2Page.getByText('Game completed')).toBeVisible();

    // Comments should be visible in results
    await expect(player1Page.getByRole('cell', { name: 'Green is nice' })).toBeVisible();
  });

  test('should handle rapid comment editing without getting stuck', async ({ context }) => {
    const { player1Page, player2Page } = await setupTwoPlayerGame(context, ['Quick test']);

    const p1ReadyCheckbox = player1Page.getByLabel('Ready for next');
    const p1CommentBox = player1Page.getByPlaceholder('Comment');

    // Player 1 answers and marks ready
    await player1Page.getByRole('button', { name: '🟢 Yes' }).click();
    await p1ReadyCheckbox.check();

    // Player 2 should see "Partner is ready"
    await expect(player2Page.getByText('Partner is ready')).toBeVisible();

    // Rapid comment editing
    await p1CommentBox.fill('First thought');
    await expect(p1ReadyCheckbox).not.toBeChecked();

    await p1CommentBox.fill('Second thought');
    await expect(p1ReadyCheckbox).not.toBeChecked();

    await p1CommentBox.fill('Final thought');
    await expect(p1ReadyCheckbox).not.toBeChecked();

    // Player 2 should consistently see spinner during all edits
    await expect(player2Page.getByText('Partner is choosing…')).toBeVisible();
    await expect(player2Page.locator('.spinner')).toBeVisible();

    // Player 1 can still mark ready after editing
    await p1ReadyCheckbox.check();
    await expect(player2Page.getByText('Partner is ready')).toBeVisible();
  });
});