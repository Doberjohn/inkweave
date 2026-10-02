import {test, expect} from '../fixtures';

/**
 * The accounts surface is behind `VITE_SHOW_ACCOUNTS`, shipped OFF until there is
 * something to do with an account. `playwright.config.ts` pins it on, along with
 * placeholder Supabase config, so these run against the flag's active path.
 *
 * Both pins are load-bearing. Without the credentials `getSupabase()` returns null,
 * `enabled` is false and `AuthButton` renders nothing, which is what CI would see:
 * the assertion below would pass locally off a developer's `.env.local` and fail in
 * CI. Pinning both makes the state identical everywhere.
 */
test.describe('Account header control', () => {
  test('the header carries a sign-in control on every page', async ({page}, testInfo) => {
    // Desktop-only by design: CompactHeader returns null on mobile, where the chrome
    // is MobileBottomNav + SearchBottomSheet, so the header cannot carry this there.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const header = page.getByTestId('compact-header');

    // Two unrelated pages, to prove the HEADER carries it rather than the page.
    for (const path of ['/browse', '/playstyles']) {
      await page.goto(path);
      await expect(header.getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    }
  });

  test('the sign-in control opens the provider dialog', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    await page.goto('/browse');
    await page.getByTestId('compact-header').getByRole('button', {name: 'Sign in', exact: true}).click();

    // Stops at the provider choice: actually signing in needs a real round-trip,
    // which no placeholder project can serve.
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
