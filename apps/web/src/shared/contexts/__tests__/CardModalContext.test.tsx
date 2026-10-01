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
