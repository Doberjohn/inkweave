import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {CardModalProvider, useCardModal} from '../CardModalContext';
import {CardDataProvider} from '../CardDataContext';

function Probe() {
  const {selectedCardId, siblingCardIds, initialPrintingId, openCardModal, closeCardModal, goToSibling} =
    useCardModal();
  return (
    <div>
      <span data-testid="selected">{selectedCardId ?? 'none'}</span>
      <span data-testid="siblings">{siblingCardIds.join(',')}</span>
      <span data-testid="printing">{initialPrintingId ?? 'none'}</span>
      <button onClick={() => openCardModal('b', ['a', 'b', 'c'])}>open-b</button>
      <button onClick={() => openCardModal('b', ['a', 'b', 'c'], {printingId: 'b-enchanted'})}>open-b-printing</button>
      <button
        onClick={() =>
          openCardModal('b', ['a', 'b', 'c'], {printingFor: (id) => (id === 'c' ? undefined : `${id}-enchanted`)})
        }>
        open-b-each
      </button>
      <button
        onClick={() =>
          // A binder: card b's pocket, then its Epic printing's pocket under the same id.
          openCardModal('b', ['a', 'b', 'c', 'b'], {
            siblingIndex: 1,
            printingFor: (_id, index) => (index === 3 ? 'b-epic' : undefined),
          })
        }>
        open-binder
      </button>
      <button onClick={closeCardModal}>close</button>
      <button onClick={() => goToSibling(1)}>next</button>
      <button onClick={() => goToSibling(-1)}>prev</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <MemoryRouter>
      <CardDataProvider>
        <CardModalProvider>
          <Probe />
        </CardModalProvider>
      </CardDataProvider>
    </MemoryRouter>,
  );
}

test('goToSibling walks the snapshot and wraps at both ends', async () => {
  const user = userEvent.setup();
  renderProbe();
  await user.click(screen.getByText('open-b'));
  expect(screen.getByTestId('selected')).toHaveTextContent('b');
  expect(screen.getByTestId('siblings')).toHaveTextContent('a,b,c');

  await user.click(screen.getByText('next'));
  expect(screen.getByTestId('selected')).toHaveTextContent('c');

  await user.click(screen.getByText('next')); // wrap c -> a
  expect(screen.getByTestId('selected')).toHaveTextContent('a');

  await user.click(screen.getByText('prev')); // wrap a -> c
  expect(screen.getByTestId('selected')).toHaveTextContent('c');
});

test('a printing the modal opened on is dropped by paging and by closing', async () => {
  const user = userEvent.setup();
  renderProbe();
  await user.click(screen.getByText('open-b-printing'));
  expect(screen.getByTestId('printing')).toHaveTextContent('b-enchanted');

  await user.click(screen.getByText('next'));
  expect(screen.getByTestId('printing')).toHaveTextContent('none');

  await user.click(screen.getByText('open-b-printing'));
  await user.click(screen.getByText('close'));
  expect(screen.getByTestId('printing')).toHaveTextContent('none');
});

test("an open's printingFor names the printing of the opened card and of each card the arrows reach", async () => {
  const user = userEvent.setup();
  renderProbe();
  await user.click(screen.getByText('open-b-each'));
  expect(screen.getByTestId('printing')).toHaveTextContent('b-enchanted');

  await user.click(screen.getByText('next')); // c has none: its Standard printing
  expect(screen.getByTestId('printing')).toHaveTextContent('none');

  await user.click(screen.getByText('next')); // wraps to a
  expect(screen.getByTestId('printing')).toHaveTextContent('a-enchanted');
});

test('a list holding a card twice pages by place, each place keeping its own printing', async () => {
  const user = userEvent.setup();
  renderProbe();
  await user.click(screen.getByText('open-binder'));
  await user.click(screen.getByText('next'));
  expect(screen.getByTestId('selected')).toHaveTextContent('c');

  await user.click(screen.getByText('next')); // b's second place: its printing
  expect(screen.getByTestId('selected')).toHaveTextContent('b');
  expect(screen.getByTestId('printing')).toHaveTextContent('b-epic');

  await user.click(screen.getByText('next')); // on to a, not back to b's first place
  expect(screen.getByTestId('selected')).toHaveTextContent('a');
});
