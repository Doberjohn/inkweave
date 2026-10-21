import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SignInDialog} from '../SignInDialog';
import {trackSignInFailed, trackSignInStarted} from '../../lib/signInAnalytics';

const {mockSignIn} = vi.hoisted(() => ({mockSignIn: vi.fn()}));

vi.mock('../../contexts/SessionContext', () => ({
  useSession: () => ({signIn: mockSignIn, enabled: true}),
}));

vi.mock('../../lib/signInAnalytics', () => ({
  trackSignInStarted: vi.fn(),
  trackSignInFailed: vi.fn(),
}));

function renderDialog() {
  render(<SignInDialog isOpen onClose={() => {}} surface="collection" />);
}

describe('SignInDialog analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks a provider press with the surface the dialog opened from', async () => {
    mockSignIn.mockResolvedValue({error: null});
    renderDialog();

    await userEvent.click(screen.getByRole('button', {name: 'Continue with Google'}));

    expect(trackSignInStarted).toHaveBeenCalledWith({provider: 'google', surface: 'collection'});
    expect(trackSignInFailed).not.toHaveBeenCalled();
  });

  it.each([
    {outcome: 'returns an error', signIn: () => Promise.resolve({error: 'Provider is disabled'})},
    {outcome: 'throws', signIn: () => Promise.reject(new Error('offline'))},
  ])('tracks a start that $outcome as a failed start', async ({signIn}) => {
    mockSignIn.mockImplementation(signIn);
    renderDialog();

    await userEvent.click(screen.getByRole('button', {name: 'Continue with Discord'}));

    await waitFor(() =>
      expect(trackSignInFailed).toHaveBeenCalledWith({
        provider: 'discord',
        stage: 'start',
        reason: 'error',
      }),
    );
  });
});
