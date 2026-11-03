import {createHash} from 'node:crypto';
import type {Page, Request} from '@playwright/test';
import {test, expect} from '../fixtures';
import {E2E_FRIEND_CODE, E2E_SUPABASE_ORIGIN} from '../fixtures/supabaseStub';
import {serveFriends, type Player} from '../helpers/friends';
import {signInAs, storedSession} from '../helpers/session';

/**
 * The account page and the sign-in round-trip around it, against the placeholder Supabase
 * project (`fixtures/supabaseStub.ts`). The OAuth provider is played by the test: it answers
 * the SDK's `/auth/v1/authorize` with the provider's redirect back, and its code exchange with
 * a session.
 */

const ME: Player = {id: 'e2e-account', handle: 'amber_dreamer', displayName: 'Amber Dreamer', code: E2E_FRIEND_CODE};

const onProject = (pathname: string) => (url: URL) => url.origin === E2E_SUPABASE_ORIGIN && url.pathname === pathname;

/** The signed-out card's own Sign in, not the header's or the phone nav's. */
const signedOutCard = (page: Page) => page.locator('section').filter({hasText: 'Sign in to name yourself.'});

test.describe('Signing in', () => {
  test('a sign-in through the provider comes back through the auth callback, signed in', async ({page}) => {
    await serveFriends(page, {me: ME, others: [], rows: []});
    // The provider: consent given at once, back to where the SDK asked, with a code.
    let authorize: URL | undefined;
    await page.route(onProject('/auth/v1/authorize'), (route) => {
      authorize = new URL(route.request().url());
      const back = new URL(authorize.searchParams.get('redirect_to') ?? '');
      back.searchParams.set('code', 'e2e-code');
      return route.fulfill({status: 302, headers: {location: back.href}});
    });
    let exchange: Request | undefined;
    await page.route(onProject('/auth/v1/token'), (route) => {
      exchange = route.request();
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(storedSession(ME.id))});
    });

    await page.goto('/account');
    const visited: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(frame.url());
    });
    await signedOutCard(page).getByRole('button', {name: 'Sign in', exact: true}).click();
    await page.getByRole('dialog', {name: 'Sign in to Inkweave'}).getByRole('button', {name: 'Continue with Discord'}).click();

    await expect(page.getByRole('button', {name: 'Sign out'})).toBeVisible();
    await expect(page).toHaveURL(/\/account$/);
    expect(visited.map((url) => new URL(url).pathname + new URL(url).search)).toContain('/auth/callback?code=e2e-code');
    await expect(page.getByText('@amber_dreamer')).toBeVisible();
    // The SDK traded the provider's code with the verifier it kept for it (PKCE): the challenge
    // it sent the provider is that verifier's hash.
    expect(new URL(exchange?.url() ?? '').searchParams.get('grant_type')).toBe('pkce');
    const sent = exchange?.postDataJSON() as {auth_code: string; code_verifier: string};
    expect(sent.auth_code).toBe('e2e-code');
    expect(authorize?.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(sent.code_verifier).digest('base64url'),
    );
  });

  test("the auth callback with no session to finish says the sign-in didn't complete", async ({page}) => {
    await page.clock.install();
    await page.goto('/auth/callback');
    await expect(page.getByText('Finishing sign-in…')).toBeVisible();
    // Nothing to restore: once the SDK has looked, the page waits 4 s before it gives up.
    await page.waitForLoadState('networkidle');
    await expect(page.getByText("Sign-in didn't complete.")).toHaveCount(0);
    await page.clock.fastForward(4000);

    await expect(page.getByText("Sign-in didn't complete.")).toBeVisible();
    await page.getByRole('button', {name: 'Go to your account'}).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(signedOutCard(page)).toBeVisible();
  });

  test.describe('on a phone', () => {
    test.use({viewport: {width: 390, height: 844}});

    // A phone has no header: this card and the bottom nav's tab are its ways in.
    test("signed out, the account page's Sign in opens the sign-in dialog", async ({page}) => {
      await page.goto('/account');
      await expect(signedOutCard(page)).toBeVisible();

      await signedOutCard(page).getByRole('button', {name: 'Sign in', exact: true}).click();
      await expect(page.getByRole('dialog', {name: 'Sign in to Inkweave'})).toBeVisible();
    });
  });
});

test.describe('Signing out', () => {
  test('Sign out ends the session: the page asks to sign in, and nothing is stored', async ({page}, testInfo) => {
    await signInAs(page, ME.id);
    await serveFriends(page, {me: ME, others: [], rows: []});
    await page.goto('/account');
    const logout = page.waitForRequest((request) => request.url().startsWith(`${E2E_SUPABASE_ORIGIN}/auth/v1/logout`));

    await page.getByRole('button', {name: 'Sign out'}).click();
    await logout;
    await expect(signedOutCard(page)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('inkweave:auth'))).toBeNull();
    if (!testInfo.project.name.startsWith('mobile-')) {
      await expect(page.getByTestId('compact-header').getByRole('button', {name: 'Sign in', exact: true})).toBeVisible();
    }
  });
});

test.describe('Display name', () => {
  /**
   * Answers the display name's update as `profiles` would, or with `status`, and keeps each
   * write. After `serveFriends`, whose `profiles` route answers reads: Playwright tries the
   * newest route first.
   */
  async function serveNameWrites(page: Page, status: number): Promise<{display_name: string}[]> {
    const writes: {display_name: string}[] = [];
    await page.route(onProject('/rest/v1/profiles'), async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const sent = route.request().postDataJSON() as {display_name: string};
      writes.push(sent);
      if (status !== 200) return route.fulfill({status, contentType: 'application/json', body: '{"message":"refused"}'});
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify([sent])});
    });
    return writes;
  }

  /** Signed in on the account page, with its name dialog open; returns the dialog and the writes. */
  async function openNameDialog(page: Page, writeStatus = 200) {
    await signInAs(page, ME.id);
    await serveFriends(page, {me: ME, others: [], rows: []});
    const writes = await serveNameWrites(page, writeStatus);
    await page.goto('/account');
    await expect(nameRow(page)).toContainText('Amber Dreamer');
    await page.getByRole('button', {name: 'Change display name'}).click();
    const dialog = page.getByRole('dialog', {name: 'Change your display name'});
    await expect(dialog.getByRole('textbox', {name: 'Display name'})).toHaveValue('Amber Dreamer');
    return {dialog, writes};
  }

  /** The Identity section's row: its label, and the name beside it. */
  const nameRow = (page: Page) => page.getByText('Display name', {exact: true}).locator('..');

  test('a new name saves, goes to the account and shows on the page', async ({page}) => {
    const {dialog, writes} = await openNameDialog(page);

    await dialog.getByRole('textbox', {name: 'Display name'}).fill('Ruby Ranger');
    await dialog.getByRole('button', {name: 'Save'}).click();

    await expect(dialog).toBeHidden();
    await expect(nameRow(page)).toContainText('Ruby Ranger');
    expect(writes).toEqual([{display_name: 'Ruby Ranger'}]);
  });

  test.describe('refused', () => {
    test.use({expectedConsoleErrors: [/^\[profile\] save name failed:/]});

    test('a refused save says so and keeps the dialog and the old name', async ({page}) => {
      const {dialog, writes} = await openNameDialog(page, 500);

      await dialog.getByRole('textbox', {name: 'Display name'}).fill('Ruby Ranger');
      await dialog.getByRole('button', {name: 'Save'}).click();

      await expect(dialog.getByRole('alert')).toHaveText('Could not save that name. Try again.');
      await expect(dialog).toBeVisible();
      expect(writes).toHaveLength(1);
      await dialog.getByRole('button', {name: 'Cancel'}).click();
      await expect(nameRow(page)).toContainText('Amber Dreamer');
    });
  });

  test('Cancel drops the typed name and writes nothing', async ({page}) => {
    const {dialog, writes} = await openNameDialog(page);

    await dialog.getByRole('textbox', {name: 'Display name'}).fill('Ruby Ranger');
    await dialog.getByRole('button', {name: 'Cancel'}).click();

    await expect(dialog).toBeHidden();
    await expect(nameRow(page)).toContainText('Amber Dreamer');
    // Opened again, the field starts from the name in force.
    await page.getByRole('button', {name: 'Change display name'}).click();
    await expect(dialog.getByRole('textbox', {name: 'Display name'})).toHaveValue('Amber Dreamer');
    expect(writes).toEqual([]);
  });
});
