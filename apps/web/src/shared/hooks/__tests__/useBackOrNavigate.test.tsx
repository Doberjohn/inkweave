import {describe, it, expect} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {Link, MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {useBackOrNavigate} from '../useBackOrNavigate';

function CurrentPath() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function CardPageStub() {
  const close = useBackOrNavigate('/browse');
  return (
    <>
      <CurrentPath />
      <Link to="/card/14019">Aurora</Link>
      <button onClick={close}>Close</button>
    </>
  );
}

/** A browser tab whose first page in Inkweave is `entry`. */
function renderApp(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/card/:cardId" element={<CardPageStub />} />
        <Route path="/browse" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

const path = () => screen.getByTestId('path').textContent;

describe('useBackOrNavigate', () => {
  it('steps back to the page the user came from inside the app', () => {
    renderApp('/card/1938');
    fireEvent.click(screen.getByRole('link', {name: 'Aurora'}));

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(path()).toBe('/card/1938');
  });

  it('goes to the fallback when this page is where the user entered (a search result, a shared link)', () => {
    renderApp('/card/1938');

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(path()).toBe('/browse');
  });
});
