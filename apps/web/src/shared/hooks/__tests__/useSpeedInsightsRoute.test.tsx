import {describe, it, expect} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import {Outlet, RouterProvider, createMemoryRouter} from 'react-router-dom';
import {useSpeedInsightsRoute} from '../useSpeedInsightsRoute';

/** Calls the hook where AppLayout does: in the root layout, above the page that matched. */
function Layout() {
  return (
    <>
      <output data-testid="route">{useSpeedInsightsRoute()}</output>
      <Outlet />
    </>
  );
}

/** A slice of router.tsx's tree, with Layout in AppLayout's place. */
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Layout />,
        children: [
          {index: true, element: null},
          {path: 'card/:cardId/:slug', element: null},
          {path: 'compare/:idA/:idB', element: null},
          {path: 'ink/:inkSlug', element: null},
          {path: 'playstyles/vinelings', element: null},
          {path: 'playstyles/:playstyleId', element: null},
          {path: '*', element: null},
        ],
      },
    ],
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

  it('reads the card page params from the root layout', () => {
    renderAt('/card/1936/bruno-madrigal-undetected-uncle');
    expect(route()).toBe('/card/[cardId]/[slug]');
  });

  it('names both compare ids when they are the same card', () => {
    renderAt('/compare/1936/1936');
    expect(route()).toBe('/compare/[idA]/[idB]');
  });

  it('keeps a static route that sits beside a param route', () => {
    renderAt('/playstyles/vinelings');
    expect(route()).toBe('/playstyles/vinelings');
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
