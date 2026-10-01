import type {AuthProvider} from '../contexts/SessionContext';

export interface SignInProvider {
  id: AuthProvider;
  label: string;
}

export interface SignInProviderButtonState {
  disabled: boolean;
  label: string;
  cursor: 'pointer' | 'default';
  opacity: number;
}

/**
 * Pure view-state for a single provider button in SignInDialog. Extracted so the dialog
 * component stays under the CodeScene cyclomatic-complexity threshold. `busy` holds the
 * provider whose OAuth redirect is in flight (or null when idle). The button is active
 * only when auth is enabled and no redirect is in flight; while a provider's redirect is
 * in flight its label switches to a redirecting notice.
 */
export function signInProviderButtonState(
  provider: SignInProvider,
  enabled: boolean,
  busy: AuthProvider | null,
): SignInProviderButtonState {
  const active = enabled && busy === null;
  return {
    disabled: !active,
    label: busy === provider.id ? 'Redirecting…' : provider.label,
    cursor: active ? 'pointer' : 'default',
    opacity: active ? 1 : 0.6,
  };
}
