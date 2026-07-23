/**
 * Mounts a "Updating to new version..." toast in the bottom-right corner of
 * the viewport. Called from main.tsx's service-worker `onNeedRefresh` handler
 * just before triggering the reload, so users see acknowledgement of the
 * version swap rather than a silent reload.
 *
 * Plain DOM (no React) on purpose: it's invoked from the bootstrap path
 * before `createRoot`, and a reload firing mid-render of a React component
 * could leave a partial commit. Vanilla DOM keeps it bulletproof.
 */

import {COLORS, FONTS, FONT_SIZES, RADIUS, SHADOWS, Z_INDEX} from '../constants';

const TOAST_ID = 'sw-update-toast';

export function showUpdateToast(): HTMLElement {
  const existing = document.getElementById(TOAST_ID);
  if (existing) return existing;

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = 'sw-update-toast';
  toast.style.cssText =
    `position:fixed;right:16px;bottom:16px;background:${COLORS.surface};color:${COLORS.text};` +
    `padding:12px 16px;border-radius:${RADIUS.lg}px;border:1px solid ${COLORS.surfaceBorder};` +
    `display:flex;align-items:center;gap:10px;z-index:${Z_INDEX.swUpdate};` +
    `font-family:${FONTS.body};font-size:${FONT_SIZES.base}px;box-shadow:${SHADOWS.float}`;

  const spinner = document.createElement('span');
  spinner.className = 'sw-update-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = 'Updating to new version...';

  toast.append(spinner, label);
  document.body.appendChild(toast);
  return toast;
}
