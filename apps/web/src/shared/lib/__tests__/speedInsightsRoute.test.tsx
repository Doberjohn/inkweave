import {describe, it, expect} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import {Outlet, RouterProvider, createMemoryRouter} from 'react-router-dom';
import {useSpeedInsightsRoute, withSpeedInsightsRoutes} from '../speedInsightsRoute';

/** Calls the hook where AppLayout does: in the root layout, above the page that matched. */
function Layout() {
  return (
    <>
      <output data-testid="route">{useSpeedInsightsRoute()}</output>
      <Outlet />
    </>
  );
}

/** A slice of router.tsx's tree, wrapped the way router.tsx wraps its own. */
function renderAt(path: string) {
  const router = createMemoryRouter(
    withSpeedInsightsRoutes([
      {
        path: '/',
        element: <Layout />,
        children: [
          {index: true, element: null},
          {path: 'card/:cardId/:slug', element: null},
          {path: 'ink/:inkSlug', element: null},
          {path: 'playstyles/vinelings', element: null},
          {path: 'playstyles/:playstyleId', element: null},
          {path: 'decks', children: [{path: ':id/edit', element: null}]},
          {path: '*', element: null},
        ],
      },
    ]),
    {initialEntries: [path]},
  );
  render(<RouterProvider router={router} />);
  return router;
}

const route = () => screen.getByTestId('route').textContent;

describe('useSpeedInsightsRoute', () => {
  it('reports the homepage as /', () => {
    renderAt('/');
    expect(route()).toBe('/');
  });

  it('reports a card page by its pattern from the root layout', () => {
    renderAt('/card/1936/bruno-madrigal-undetected-uncle');
    expect(route()).toBe('/card/[cardId]/[slug]');
  });

  it('keeps segment order when a slug spells a static segment', () => {
    renderAt('/card/1936/card');
    expect(route()).toBe('/card/[cardId]/[slug]');
  });

  it('labels a percent-encoded URL by its pattern', () => {
    renderAt('/card/1936/caf%C3%A9');
    expect(route()).toBe('/card/[cardId]/[slug]');
  });

  it('keeps a static route that sits beside a param route', () => {
    renderAt('/playstyles/vinelings');
    expect(route()).toBe('/playstyles/vinelings');
  });

  it('joins a nested route onto its parent', () => {
    renderAt('/decks/42/edit');
    expect(route()).toBe('/decks/[id]/edit');
  });

  it('files every unknown URL under one route', () => {
    renderAt('/no/such/page');
    expect(route()).toBe('/[*]');
  });

  it('follows client-side navigation', async () => {
    const router = renderAt('/');
    await act(() => router.navigate('/ink/amber'));
    expect(route()).toBe('/ink/[inkSlug]');
  });
});
