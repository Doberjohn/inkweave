import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SessionProvider, useIsSignedIn} from '../SessionContext';
import {_resetClient} from '../../lib/supabase';

function Probe() {
  return <span data-testid="probe">{String(useIsSignedIn())}</span>;
}

beforeEach(() => {
  _resetClient();
  // Override .env.local values so "not configured" tests work
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('useIsSignedIn', () => {
  // The whole point of this hook: the desktop nav reacts to auth without
  // requiring it, so it must not throw the way useSession does.
  it('returns false outside a SessionProvider instead of throwing', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });

  // Named for what it actually covers: beforeEach blanks both env vars, so Supabase is not
  // configured and the provider mounts auth-disabled. The signed-in case needs a client double
  // and lives in contexts/SessionContext.test.tsx.
  it('returns false inside a provider when auth is not configured', () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });
});
