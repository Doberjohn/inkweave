import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_FRIEND_CODE} from '../fixtures/supabaseStub';
import {serveFriends} from '../helpers/friends';
import {signInAs} from '../helpers/session';

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
    The Supabase SDK loads only when there is a session to restore (#729). These watch the
    network for the SDK itself: under Vite dev it arrives as our supabaseClient.ts module plus
    the prebundled @supabase/auth-js and @supabase/postgrest-js dependencies, and in a production
    build as the supabaseClient-<hash>.js chunk.
  */
  const isSdkRequest = (url: string) =>
    url.includes('supabaseClient') || url.includes('/@supabase_');

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

/**
 * A phone has no header, so its bottom nav carries the same control as an account tab: Sign in
 * signed out, a link to the account page signed in.
 */
test.describe('Account tab on phones', () => {
  // The desktop projects carry this control in the header, tested above.
  test.skip(({isMobile}) => !isMobile, 'phones only');

  const mobileNav = (page: Page) => page.getByRole('navigation', {name: 'Mobile navigation'});

  test('signed out, the bottom nav opens the sign-in dialog', async ({page}) => {
    await page.goto('/browse');
    await mobileNav(page).getByRole('button', {name: 'Sign in', exact: true}).click();

    await expect(page.getByRole('dialog', {name: 'Sign in to Inkweave'})).toBeVisible();
  });

  test('signed in, the bottom nav opens the account page', async ({page}) => {
    const me = {id: 'e2e-phone', handle: 'amber_dreamer', displayName: 'Amber Dreamer', code: E2E_FRIEND_CODE};
    await signInAs(page, me.id);
    await serveFriends(page, {me, others: [], rows: []});
    await page.goto('/browse');

    await mobileNav(page).getByRole('link', {name: 'Your account', exact: true}).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', {name: 'Your account', level: 1})).toBeVisible();
    const tab = mobileNav(page).getByRole('link', {name: 'Your account', exact: true});
    await expect(tab).toHaveAttribute('aria-current', 'page');
  });
});
