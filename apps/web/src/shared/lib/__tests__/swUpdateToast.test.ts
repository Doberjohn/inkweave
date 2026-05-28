import {afterEach, describe, expect, it} from 'vitest';
import {showUpdateToast} from '../swUpdateToast';

describe('showUpdateToast', () => {
  afterEach(() => {
    document.getElementById('sw-update-toast')?.remove();
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

  it('is idempotent: calling twice does not mount a second toast', () => {
    const first = showUpdateToast();
    const second = showUpdateToast();

    expect(second).toBe(first);
    expect(document.querySelectorAll('#sw-update-toast')).toHaveLength(1);
  });
});
