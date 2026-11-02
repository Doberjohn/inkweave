import type {ReactNode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {render} from '@testing-library/react';
import {RouterProvider, createMemoryRouter} from 'react-router-dom';
import {AppLayout} from '../AppLayout';
import {withoutAccountParams} from '../shared/lib/vercelBeforeSend';

/** The props each Vercel tool last rendered with. */
const vercel = vi.hoisted(() => ({analytics: {} as Record<string, unknown>, speedInsights: {} as Record<string, unknown>}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props: Record<string, unknown>) => {
    vercel.analytics = props;
    return null;
  },
}));
vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: (props: Record<string, unknown>) => {
    vercel.speedInsights = props;
    return null;
  },
}));

// The layout's providers, as pass-throughs: these tests are about the two tools beside them.
const passThrough = vi.hoisted(() => ({children}: {children: ReactNode}) => children);
vi.mock('../shared/contexts/SessionContext', () => ({SessionProvider: passThrough}));
vi.mock('../features/profile', () => ({ProfileProvider: passThrough}));
vi.mock('../shared/contexts/CardModalContext', () => ({CardModalProvider: passThrough}));
vi.mock('../shared/contexts/CardDataContext', () => ({
  CardDataProvider: passThrough,
  useCardDataContext: () => ({error: null, retryLoad: () => {}, requestLoad: () => {}}),
}));
const reveal = vi.hoisted(() => ({phase: 'off'}));
vi.mock('../features/reveals', () => ({RevealsPromoCard: () => null, useRevealPhase: () => reveal.phase}));

function renderLayout() {
  render(<RouterProvider router={createMemoryRouter([{path: '/', element: <AppLayout />}])} />);
}

// Both scripts send the page's whole address, so each needs the hook that keeps a friend's handle
// and a sign-in code out of it.
describe('AppLayout', () => {
  it('hands Web Analytics the hook that drops account params', () => {
    renderLayout();

    expect(vercel.analytics.beforeSend).toBe(withoutAccountParams);
  });

  it('hands Speed Insights the hook that drops account params', () => {
    renderLayout();

    expect(vercel.speedInsights.beforeSend).toBe(withoutAccountParams);
  });
});

// The home page's beta notice keeps clear of the Reveals promo by this mark (index.css), so it
// must follow the promo's own breakpoint.
describe('AppLayout, the Reveals promo mark', () => {
  const width = window.innerWidth;
  afterEach(() => {
    reveal.phase = 'off';
    window.innerWidth = width;
  });
  const mark = () => document.querySelector('[data-reveals-promo]')?.getAttribute('data-reveals-promo');

  it('marks the page while the promo sits in the top-right corner', () => {
    reveal.phase = 'pre-release';
    window.innerWidth = 768;
    renderLayout();

    expect(mark()).toBe('corner');
  });

  it("leaves no mark while the promo sits at a phone's foot", () => {
    reveal.phase = 'pre-release';
    window.innerWidth = 767;
    renderLayout();

    expect(mark()).toBeUndefined();
  });

  it('leaves no mark outside the reveal season', () => {
    window.innerWidth = 1280;
    renderLayout();

    expect(mark()).toBeUndefined();
  });
});
