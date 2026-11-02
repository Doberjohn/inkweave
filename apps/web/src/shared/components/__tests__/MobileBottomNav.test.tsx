import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {RevealPhase} from '../../../features/reveals';

interface SessionStub {
  user: {id: string} | null;
  loading: boolean;
  enabled: boolean;
}

// Hoisted, so the modules each test loads afresh share one stub of each.
const mocks = vi.hoisted(() => ({session: null as SessionStub | null, trackSignInShown: vi.fn()}));

// Pinned, so no test depends on VITE_IS_REVEAL_SEASON or fetches reveal dates.
vi.mock('../../../features/reveals', () => ({useRevealPhase: (): RevealPhase => 'hidden'}));

vi.mock('../../contexts/SessionContext', () => ({
  useOptionalSession: () => mocks.session,
  // The sign-in dialog's own read, once the Sign in tab has opened it.
  useSession: () => ({...mocks.session, signIn: vi.fn(), signOut: vi.fn()}),
}));

vi.mock('../../lib/signInAnalytics', () => ({
  trackSignInShown: mocks.trackSignInShown,
  trackSignInStarted: vi.fn(),
  trackSignInFailed: vi.fn(),
}));

const SIGNED_OUT: SessionStub = {user: null, loading: false, enabled: true};
const SIGNED_IN: SessionStub = {user: {id: 'u1'}, loading: false, enabled: true};

/**
 * The nav reads `VITE_SHOW_ACCOUNTS` once, when its module loads, so each render loads it afresh
 * under the flag it asks for.
 */
interface NavSetup {
  accounts?: boolean;
  phase?: RevealPhase;
}

async function renderNav(path: string, {accounts = true, phase}: NavSetup = {}) {
  vi.stubEnv('VITE_SHOW_ACCOUNTS', accounts ? 'true' : 'false');
  vi.resetModules();
  const {MobileBottomNav} = await import('../MobileBottomNav');
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileBottomNav onSearchClick={vi.fn()} phaseOverride={phase} />
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', {name: 'Mobile navigation'});
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = SIGNED_OUT;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MobileBottomNav account tab', () => {
  it('signed out, is a Sign in tab that opens the sign-in dialog from the nav', async () => {
    const nav = await renderNav('/browse');

    await userEvent.click(within(nav).getByRole('button', {name: 'Sign in'}));

    expect(await screen.findByRole('dialog', {name: 'Sign in to Inkweave'})).toBeVisible();
    expect(mocks.trackSignInShown).toHaveBeenCalledExactlyOnceWith({surface: 'bottom_nav'});
  });

  it('signed in, links to the account page and lights up there', async () => {
    mocks.session = SIGNED_IN;
    const nav = await renderNav('/account');

    const tab = within(nav).getByRole('link', {name: 'Your account'});
    expect(tab).toHaveAttribute('href', '/account');
    expect(tab).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByText('Your account')).toBeVisible();
    expect(within(nav).queryByRole('button', {name: 'Sign in'})).toBeNull();
  });

  it('while a stored session is restoring, is the account tab rather than Sign in', async () => {
    mocks.session = {user: null, loading: true, enabled: true};
    const nav = await renderNav('/browse');

    expect(within(nav).getByRole('link', {name: 'Your account'})).toBeInTheDocument();
    expect(within(nav).queryByRole('button', {name: 'Sign in'})).toBeNull();
  });

  it('is left out while accounts are off, keeping four tabs', async () => {
    const nav = await renderNav('/browse', {accounts: false});

    expect(within(nav).queryByRole('button', {name: 'Sign in'})).toBeNull();
    expect(nav.querySelectorAll('.mbn-tab')).toHaveLength(4);
  });

  it('is left out when sign-in is not configured', async () => {
    mocks.session = {user: null, loading: false, enabled: false};
    const nav = await renderNav('/browse');

    expect(nav.querySelectorAll('.mbn-tab')).toHaveLength(4);
  });

  it('makes six tabs in reveal season, the account tab last', async () => {
    mocks.session = SIGNED_IN;
    const nav = await renderNav('/browse', {phase: 'pre-release'});

    const tabs = nav.querySelectorAll('.mbn-tab');
    expect(tabs).toHaveLength(6);
    expect(tabs[5]).toHaveAccessibleName('Your account');
    // On the arc: the last tab sits as low as the first.
    expect(tabs[5]).toHaveStyle({paddingTop: (tabs[0] as HTMLElement).style.paddingTop});
    expect(tabs[0]).toHaveStyle({paddingTop: '32px'});
  });
});
