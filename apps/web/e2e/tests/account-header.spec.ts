import {test, expect} from '../fixtures';

/**
 * The accounts surface is behind `VITE_SHOW_ACCOUNTS`, shipped OFF until there is
 * something to do with an account. `playwright.config.ts` pins it on, along with
 * placeholder Supabase config, so these run against the flag's active path.
 *
 * Both pins are load-bearing. Without the credentials `isSupabaseConfigured()` is false,
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

  /*
    supabase-js loads only when there is a session to restore (#729). These watch the network
    for the SDK itself: under Vite dev it arrives as our supabaseClient.ts module plus the
    prebundled @supabase/supabase-js dependency.
  */
  const isSdkRequest = (url: string) => url.includes('supabaseClient') || url.includes('supabase_supabase-js');

  test('an anonymous visit never downloads the Supabase SDK', async ({page}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    const sdkRequests: string[] = [];
    page.on('request', (request) => {
      if (isSdkRequest(request.url())) sdkRequests.push(request.url());
    });

    await page.goto('/browse');
    // The auth control renders from the env check alone, with no SDK behind it.
    await expect(page.getByTestId('compact-header').getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(sdkRequests).toEqual([]);
  });

  test('a stored session downloads the Supabase SDK to restore it', async ({page}) => {
    await page.addInitScript(() => {
      localStorage.setItem('inkweave:auth', JSON.stringify({access_token: 'stored', refresh_token: 'stored'}));
    });
    const sdkRequest = page.waitForRequest((request) => isSdkRequest(request.url()));

    await page.goto('/browse');

    await sdkRequest;
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
