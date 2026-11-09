import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {REVEAL_SET_NUMBER} from '../../../shared/constants';
import {RevealsPromoCard} from '../RevealsPromoCard';

function renderOnHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RevealsPromoCard />} />
        <Route path="/reveals" element={<h1>Reveals page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByRole('link', {name: `NEW Set ${REVEAL_SET_NUMBER} reveals are here!`});
}

describe('RevealsPromoCard', () => {
  it('links to the reveals page', async () => {
    await userEvent.click(renderOnHome());
    expect(screen.getByRole('heading', {name: 'Reveals page'})).toBeInTheDocument();
  });

  it('opens the reveals page from the keyboard', async () => {
    const link = renderOnHome();
    await userEvent.tab();
    expect(link).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('heading', {name: 'Reveals page'})).toBeInTheDocument();
  });
});
