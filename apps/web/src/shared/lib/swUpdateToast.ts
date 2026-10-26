/**
 * Mounts a "Updating to new version..." toast in the bottom-right corner of
 * the viewport, above the tab bar on a phone (#914). Called from main.tsx's
 * service-worker `onNeedRefresh` handler just before triggering the reload, so
 * users see acknowledgement of the version swap rather than a silent reload.
 *
 * Plain DOM (no React) on purpose: it's invoked from the bootstrap path
 * before `createRoot`, and a reload firing mid-render of a React component
 * could leave a partial commit. Vanilla DOM keeps it bulletproof.
 */

import {BREAKPOINTS, COLORS, FONTS, FONT_SIZES, LAYOUT, RADIUS, SHADOWS, SPACING, Z_INDEX} from '../constants';

const TOAST_ID = 'sw-update-toast';

/**
 * How long the toast waits for the reload before it goes. The swap takes about a second, but
 * Chrome holds a new worker back until the old one's requests finish, for up to five minutes,
 * and a browser that never reports the swap would leave the toast up for good. The reload
 * still comes whenever the new worker takes over.
 */
export const UPDATE_TOAST_MAX_MS = 10000;

export function showUpdateToast(): HTMLElement {
  const existing = document.getElementById(TOAST_ID);
  if (existing) return existing;

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = 'sw-update-toast';
  // The offset is picked once: the toast lives about a second, until the reload.
  const bottom = window.innerWidth < BREAKPOINTS.tablet ? LAYOUT.mobileNavHeight + SPACING.lg : SPACING.lg;
  toast.style.cssText =
    `position:fixed;right:${SPACING.lg}px;bottom:${bottom}px;background:${COLORS.surface};color:${COLORS.text};` +
    `padding:${SPACING.md}px ${SPACING.lg}px;border-radius:${RADIUS.lg}px;border:1px solid ${COLORS.surfaceBorder};` +
    `display:flex;align-items:center;gap:${SPACING.md}px;z-index:${Z_INDEX.swUpdate};` +
    `font-family:${FONTS.body};font-size:${FONT_SIZES.base}px;box-shadow:${SHADOWS.float}`;

  const spinner = document.createElement('span');
  spinner.className = 'sw-update-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = 'Updating to new version...';

  toast.append(spinner, label);
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), UPDATE_TOAST_MAX_MS);
  return toast;
}
