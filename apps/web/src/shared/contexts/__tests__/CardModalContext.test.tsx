import {useContext, useSyncExternalStore} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {CardModalProvider, useCardModal} from '../CardModalContext';
import {CardWindowSlotContext, useCardWindowSlot} from '../cardWindowSlot';
import {CardDataProvider} from '../CardDataContext';

/** The window's open flag, as a page reads it (`CollectionBinderSection`). */
function useWindowOpen(): boolean {
  const {open} = useContext(CardWindowSlotContext)!;
  return useSyncExternalStore(open.subscribe, open.get);
}

function Probe() {
  const {
    selectedCardId,
    siblingCardIds,
    initialPrintingId,
    resolveCard,
    openCardModal,
    openComparison,
    closeCardModal,
    goToSibling,
  } = useCardModal();
  const {shownPrintingId} = useCardWindowSlot();
  const windowOpen = useWindowOpen();
  return (
    <div>
      <span data-testid="selected">{selectedCardId ?? 'none'}</span>
      <span data-testid="open">{String(windowOpen)}</span>
      <span data-testid="siblings">{siblingCardIds.join(',')}</span>
      <span data-testid="printing">{initialPrintingId ?? 'none'}</span>
      <span data-testid="shown">{shownPrintingId ?? 'none'}</span>
      <span data-testid="resolver">{resolveCard ? 'set' : 'none'}</span>
      <button onClick={() => openCardModal('b', ['a', 'b', 'c'])}>open-b</button>
      <button onClick={() => openCardModal('b', ['a', 'b', 'c'], {resolveCard: () => undefined})}>open-collection</button>
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
      <button onClick={() => openComparison('b', 'c')}>compare</button>
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

test("closing lets go of a collection open's resolver, and the pool it holds", async () => {
  const user = userEvent.setup();
  renderProbe();
  await user.click(screen.getByText('open-collection'));
  expect(screen.getByTestId('resolver')).toHaveTextContent('set');

  await user.click(screen.getByText('close'));
  expect(screen.getByTestId('resolver')).toHaveTextContent('none');
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

test('the printing on show starts as each card arrives on, and none once closed (#826)', async () => {
  // What fills the window's slot reads it, so a card's first render already names its printing.
  const user = userEvent.setup();
  renderProbe();
  await user.click(screen.getByText('open-b-each'));
  expect(screen.getByTestId('shown')).toHaveTextContent('b-enchanted');

  await user.click(screen.getByText('next')); // c has none: its Standard printing
  expect(screen.getByTestId('shown')).toHaveTextContent('none');

  await user.click(screen.getByText('next')); // wraps to a
  expect(screen.getByTestId('shown')).toHaveTextContent('a-enchanted');

  await user.click(screen.getByText('close'));
  expect(screen.getByTestId('shown')).toHaveTextContent('none');
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

test('the window counts as open from its open to its close, through the arrows (#941)', async () => {
  // A page holds back what changed in the window until it closes; the window's own views (an
  // expanded group, a comparison) never reach the provider, so they keep it open too.
  const user = userEvent.setup();
  renderProbe();
  expect(screen.getByTestId('open')).toHaveTextContent('false');

  await user.click(screen.getByText('open-b'));
  expect(screen.getByTestId('open')).toHaveTextContent('true');
  await user.click(screen.getByText('next'));
  expect(screen.getByTestId('open')).toHaveTextContent('true');
  await user.click(screen.getByText('close'));
  expect(screen.getByTestId('open')).toHaveTextContent('false');

  // A compare link opens straight on a pair.
  await user.click(screen.getByText('compare'));
  expect(screen.getByTestId('open')).toHaveTextContent('true');
  await user.click(screen.getByText('close'));
  expect(screen.getByTestId('open')).toHaveTextContent('false');
});
