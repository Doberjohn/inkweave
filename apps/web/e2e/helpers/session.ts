import type {Page} from '@playwright/test';

/** base64url, for the session's token. */
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * A session the Supabase SDK restores from storage as it stands: unexpired (a day out, far
 * past its refresh margin), with the user the app reads `user` from. The token is shaped like a
 * JWT; nothing in the browser verifies its signature.
 *
 * SIGNED IN WITHOUT SIGNING IN: an OAuth round-trip is out of E2E's reach, but a session
 * the Supabase SDK RESTORES needs none. Stored under the app's auth key before the first
 * navigation, `getSession()` hands it back without a network check.
 */
export function storedSession(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 24 * 60 * 60;
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${userId}@example.test`,
    app_metadata: {provider: 'discord', providers: ['discord']},
    user_metadata: {},
    created_at: '2026-10-01T00:00:00Z',
  };
  const payload = {
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    iat: now,
    exp: expiresAt,
  };
  return {
    access_token: `${base64url({alg: 'HS256', typ: 'JWT'})}.${base64url(payload)}.e2e`,
    token_type: 'bearer',
    expires_in: expiresAt - now,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user,
  };
}

/** Signs the page in as `userId` before its first navigation, with `storedSession`. */
export async function signInAs(page: Page, userId: string): Promise<void> {
  await page.addInitScript((session) => {
    localStorage.setItem('inkweave:auth', JSON.stringify(session));
  }, storedSession(userId));
}
