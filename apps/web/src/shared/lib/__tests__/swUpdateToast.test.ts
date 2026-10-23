import {afterEach, describe, expect, it, vi} from 'vitest';
import {showUpdateToast} from '../swUpdateToast';

describe('showUpdateToast', () => {
  afterEach(() => {
    document.getElementById('sw-update-toast')?.remove();
    vi.unstubAllGlobals();
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

  // #914: on a phone it sits above the tab bar (110 px) rather than over its active tab.
  it.each([
    {width: 390, bottom: '126px'},
    {width: 1440, bottom: '16px'},
  ])('sits $bottom from the bottom at $width px wide', ({width, bottom}) => {
    vi.stubGlobal('innerWidth', width);

    expect(showUpdateToast().style.bottom).toBe(bottom);
  });
});
