import {afterEach, describe, it, expect} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {PageAbout} from '../PageAbout';

afterEach(cleanup);

function renderAbout() {
  render(
    <MemoryRouter>
      <PageAbout heading="About Amber cards">
        <p>Every Amber card in the Core format.</p>
      </PageAbout>
    </MemoryRouter>,
  );
  return screen.getByRole('heading', {name: 'About Amber cards'}).closest('details')!;
}

describe('PageAbout', () => {
  it('starts closed under its heading, with its text in the page for search engines', () => {
    const details = renderAbout();
    expect(details.open).toBe(false);
    expect(screen.getByText('Every Amber card in the Core format.')).not.toBeVisible();
  });

  // Enter and Space on the summary are the browser's own, which jsdom doesn't run: seo.spec.ts
  // presses them in a real browser.
  it('opens and closes from its heading', async () => {
    const user = userEvent.setup();
    const details = renderAbout();
    await user.click(screen.getByRole('heading', {name: 'About Amber cards'}));
    expect(details.open).toBe(true);
    expect(screen.getByText('Every Amber card in the Core format.')).toBeVisible();
    await user.click(screen.getByRole('heading', {name: 'About Amber cards'}));
    expect(details.open).toBe(false);
  });
});
