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

  it('returns false inside a provider when nobody is signed in', () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('false');
  });
});
