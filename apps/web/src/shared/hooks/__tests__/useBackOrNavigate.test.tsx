import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {Link, MemoryRouter, Navigate, Route, Routes, useLocation} from 'react-router-dom';
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
        {/* ComparePage's same-card case: /compare/X/X shows /card/X instead. */}
        <Route path="/compare/:a/:b" element={<Navigate replace to="/card/1938" />} />
        <Route path="/browse" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

const path = () => screen.getByTestId('path').textContent;

afterEach(() => {
  window.history.replaceState(null, '');
});

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

  // The redirect's replace gives the location a new key, but it is still the page the visit
  // started on: the browser router keeps its history index at 0 there.
  it('goes to the fallback after a redirect from the entry page, too', () => {
    window.history.replaceState({idx: 0}, '');
    renderApp('/compare/1938/1938');
    expect(path()).toBe('/card/1938');

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(path()).toBe('/browse');
  });
});
