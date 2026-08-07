import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {Breadcrumb} from '../Breadcrumb';

const TRAIL = [{label: 'Playstyles', to: '/playstyles'}, {label: 'Lore Denial'}];
const withRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Breadcrumb', () => {
  it('links every ancestor', () => {
    withRouter(<Breadcrumb crumbs={TRAIL} />);
    expect(screen.getByRole('link', {name: 'Playstyles'}).getAttribute('href')).toBe('/playstyles');
  });

  // You are already here, so it is text. A link to the current page is a dead control
  // that still looks pressable.
  it('does not link the current page', () => {
    withRouter(<Breadcrumb crumbs={TRAIL} />);
    expect(screen.queryByRole('link', {name: 'Lore Denial'})).toBeNull();
    expect(screen.getByText('Lore Denial').getAttribute('aria-current')).toBe('page');
  });

  // Even if a caller passes `to` on the last crumb — which is easy to do when the
  // trail is built by mapping over route data.
  it('ignores a destination on the last crumb', () => {
    withRouter(<Breadcrumb crumbs={[{label: 'Playstyles', to: '/playstyles'}, {label: 'Here', to: '/here'}]} />);
    expect(screen.queryByRole('link', {name: 'Here'})).toBeNull();
  });

  it('is announced as a breadcrumb', () => {
    withRouter(<Breadcrumb crumbs={TRAIL} />);
    expect(screen.getByRole('navigation', {name: 'Breadcrumb'})).toBeTruthy();
  });
});
