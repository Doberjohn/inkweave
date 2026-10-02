import type {AuthProvider} from '../contexts/SessionContext';

export interface SignInProvider {
  id: AuthProvider;
  label: string;
}

export interface SignInProviderButtonState {
  disabled: boolean;
  label: string;
}

/**
 * Pure view-state for a single provider button in SignInDialog. Extracted so the dialog
 * component stays under the CodeScene cyclomatic-complexity threshold. `busy` holds the
 * provider whose OAuth redirect is in flight (or null when idle). The button is active
 * only when auth is enabled and no redirect is in flight; while a provider's redirect is
 * in flight its label switches to a redirecting notice.
 *
 * Appearance is deliberately NOT returned. It used to hand back view styles that no
 * caller read: CtaButton applies DISABLED_STYLE from its own `disabled` prop, and
 * restating a token value here is what the design gate forbids.
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
  };
}
