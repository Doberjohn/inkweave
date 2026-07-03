import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';

/**
 * Renders children only when VITE_SHOW_ADMIN_ANALYTICS === 'true'.
 * Otherwise redirects to '/'. Mirrors RevealsGate; the flag is the only gate
 * (the analytics data is not sensitive, so no auth layer).
 */
export function AdminGate({children}: {children: ReactNode}) {
  if (import.meta.env.VITE_SHOW_ADMIN_ANALYTICS !== 'true') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
