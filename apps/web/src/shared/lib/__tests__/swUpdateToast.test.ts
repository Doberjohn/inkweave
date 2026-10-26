import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  UPDATE_TOAST_LEAD_MS,
  UPDATE_TOAST_MAX_MS,
  announceReload,
  showUpdateToast,
} from '../swUpdateToast';

describe('showUpdateToast', () => {
  afterEach(() => {
    document.getElementById('sw-update-toast')?.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('mounts a polite live-region toast in the document body', () => {
    const toast = showUpdateToast();

    expect(toast.parentElement).toBe(document.body);
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.textContent).toContain('Updating');
  });

  it('renders an aria-hidden spinner span with the .sw-update-spinner class', () => {
    const toast = showUpdateToast();
    const spinner = toast.querySelector('.sw-update-spinner');

    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });

  // Chrome holds a new worker back while the old one has requests in flight, for up to 5 minutes.
  it('goes after UPDATE_TOAST_MAX_MS when no reload comes', () => {
    vi.useFakeTimers();
    showUpdateToast();

    vi.advanceTimersByTime(UPDATE_TOAST_MAX_MS - 1);
    expect(document.getElementById('sw-update-toast')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.getElementById('sw-update-toast')).toBeNull();
  });

  it('is idempotent: calling twice does not mount a second toast', () => {
    const first = showUpdateToast();
    const second = showUpdateToast();

    expect(second).toBe(first);
    expect(document.querySelectorAll('#sw-update-toast')).toHaveLength(1);
  });

  // #914: on a phone it sits above the tab bar (110 px) rather than over its active tab.
  it.each([
    {width: 390, bottom: '126px'},
    {width: 1440, bottom: '16px'},
  ])('sits $bottom from the bottom at $width px wide', ({width, bottom}) => {
    vi.stubGlobal('innerWidth', width);

    expect(showUpdateToast().style.bottom).toBe(bottom);
  });
});

describe('announceReload', () => {
  afterEach(() => {
    document.getElementById('sw-update-toast')?.remove();
  });

  it('asks for no wait while the toast is up', () => {
    showUpdateToast();

    expect(announceReload()).toBe(0);
  });

  // Chrome can hold the swap past UPDATE_TOAST_MAX_MS, and the reload still comes then.
  it('shows the toast again, and asks for UPDATE_TOAST_LEAD_MS, once it went', () => {
    expect(announceReload()).toBe(UPDATE_TOAST_LEAD_MS);
    expect(document.getElementById('sw-update-toast')).not.toBeNull();
  });
});
