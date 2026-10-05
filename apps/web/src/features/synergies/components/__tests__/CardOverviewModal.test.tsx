import {render, screen, waitFor} from '@testing-library/react';
import {test, expect, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {SynergyGroup as SynergyGroupData} from '../../types';
import {CardOverviewModal} from '../CardOverviewModal';
import {CardDataProvider} from '../../../../shared/contexts/CardDataContext';
import {trackEvent} from '../../../../shared/lib/analytics';
import {restStrip, swipeStrip} from '../../../../shared/test-utils';

vi.mock('../../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

function makeCard(id: string): LorcanaCard {
  return {
    id, name: `Card ${id}`, fullName: `Card ${id} - Test`, version: 'Test',
    ink: 'Amber', type: 'Character', cost: 3, inkwell: true, rarity: 'Common',
    set: 5, number: 1, strength: 2, willpower: 3, lore: 1, textSections: [],
  } as unknown as LorcanaCard;
}

function makeGroup(groupKey: string, label: string, count: number): SynergyGroupData {
  return {
    groupKey, category: 'playstyle', label, tagline: `${label} tagline`,
    description: `${label} description`,
    synergies: Array.from({length: count}, (_, i) => ({
      card: makeCard(`syn-${i}`), score: 5, explanation: `Synergy ${i}`,
    })),
  } as unknown as SynergyGroupData;
}

function renderModal(cardCount: number) {
  return render(
    <MemoryRouter>
      <CardDataProvider>
        <CardOverviewModal
          isOpen
          card={makeCard('source')}
          synergies={[makeGroup('singer-songs', 'Singer + Songs', cardCount)]}
          getPairSynergies={() => null}
          onClose={() => {}}
        />
      </CardDataProvider>
    </MemoryRouter>,
  );
}

test('Show More opens the full expanded group view', async () => {
  const user = userEvent.setup();
  renderModal(20);
  // One More click jumps straight to the full ExpandedGroupView with its back link.
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
});

test('Back to all synergies returns to the default view', async () => {
  const user = userEvent.setup();
  renderModal(20);
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
  await user.click(screen.getByText(/back to all synergies/i));
  expect(screen.queryByText(/back to all synergies/i)).toBeNull();
  expect(screen.getByRole('button', {name: /more/i})).toBeVisible();
});

test('changing the card resets the expanded view', async () => {
  const user = userEvent.setup();
  const group = makeGroup('singer-songs', 'Singer + Songs', 20);
  const tree = (card: LorcanaCard) => (
    <MemoryRouter>
      <CardDataProvider>
        <CardOverviewModal isOpen card={card} synergies={[group]} getPairSynergies={() => null} onClose={() => {}} />
      </CardDataProvider>
    </MemoryRouter>
  );
  const {rerender} = render(tree(makeCard('source')));
  await user.click(screen.getByRole('button', {name: /more/i}));
  expect(screen.getByText(/back to all synergies/i)).toBeVisible();
  rerender(tree(makeCard('other')));
  expect(screen.queryByText(/back to all synergies/i)).toBeNull();
  expect(screen.getByRole('button', {name: /more/i})).toBeVisible();
});

test('a foreign-scan card toggles its English text; the next card starts on its scan', async () => {
  const user = userEvent.setup();
  const japanese = (id: string) => ({...makeCard(id), scanLanguage: 'ja', textSections: ['Draw a card.']});
  const tree = (card: LorcanaCard) => (
    <MemoryRouter>
      <CardOverviewModal isOpen card={card} synergies={[]} getPairSynergies={() => null} onClose={() => {}} />
    </MemoryRouter>
  );
  const {rerender} = render(tree(japanese('jp1')));

  await user.click(screen.getByRole('button', {name: 'See translation'}));
  expect(screen.getByRole('region', {name: 'English translation of Card jp1 - Test'})).toHaveTextContent('Draw a card.');

  rerender(tree(japanese('jp2')));
  expect(screen.queryByTestId('card-translation')).toBeNull();
  expect(screen.getByRole('button', {name: 'See translation'})).toBeVisible();

  rerender(tree(makeCard('en')));
  expect(screen.queryByRole('button', {name: /see (translation|card)/i})).toBeNull();

  // Paging back to a card whose translation was open starts on its scan again.
  rerender(tree(japanese('jp1')));
  expect(screen.queryByTestId('card-translation')).toBeNull();
});

test.each([
  ['an English card, which unmounts the toggle', makeCard('en')],
  // #681: a card whose foreign scan is a variant keeps the toggle, hidden on its English Standard.
  ['a card whose only foreign scan is a variant, which hides it', withItalianEpic(makeCard('en'))],
])('paging from a focused translation toggle to %s moves focus to the ×', async (_label, next) => {
  Element.prototype.scrollTo = vi.fn();
  const user = userEvent.setup();
  const tree = (card: LorcanaCard) => (
    <MemoryRouter>
      <CardOverviewModal isOpen card={card} synergies={[]} getPairSynergies={() => null} onClose={() => {}} />
    </MemoryRouter>
  );
  const {rerender} = render(tree({...makeCard('jp'), scanLanguage: 'ja'}));
  // The dialog moves focus to its × 100ms after opening. Let that land first: whenever the
  // test runs past 100ms, it would otherwise take the focus back from the toggle.
  await waitFor(() => expect(screen.getByRole('button', {name: 'Close'})).toHaveFocus());
  await user.click(screen.getByRole('button', {name: 'See translation'}));
  expect(screen.getByRole('button', {name: 'See card'})).toHaveFocus();

  rerender(tree(next));
  expect(screen.getByRole('button', {name: 'Close'})).toHaveFocus();
});

test('the expanded group view hides the translation toggle, which has no card image to cover', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <CardDataProvider>
        <CardOverviewModal
          isOpen
          card={{...makeCard('jp'), scanLanguage: 'ja'}}
          synergies={[makeGroup('singer-songs', 'Singer + Songs', 20)]}
          getPairSynergies={() => null}
          onClose={() => {}}
        />
      </CardDataProvider>
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', {name: 'See translation'})).toBeVisible();
  await user.click(screen.getByRole('button', {name: /more/i}));
  // Hidden, not removed, so the header keeps its height (a hidden button has no accessible name).
  expect(screen.getByText('See translation')).not.toBeVisible();
});

function renderWithSiblings(opts: {onGoToSibling?: (d: 1 | -1) => void; siblingCardIds?: string[]} = {}) {
  return render(
    <MemoryRouter>
      <CardOverviewModal isOpen card={makeCard('b')} synergies={[]} getPairSynergies={() => null} onClose={() => {}}
        siblingCardIds={opts.siblingCardIds ?? ['a', 'b', 'c']} onGoToSibling={opts.onGoToSibling ?? (() => {})} />
    </MemoryRouter>,
  );
}

test('shows prev/next arrows and calls onGoToSibling', async () => {
  const user = userEvent.setup();
  const onGoToSibling = vi.fn();
  renderWithSiblings({onGoToSibling});
  await user.click(screen.getByRole('button', {name: /next card/i}));
  expect(onGoToSibling).toHaveBeenCalledWith(1);
  await user.click(screen.getByRole('button', {name: /previous card/i}));
  expect(onGoToSibling).toHaveBeenCalledWith(-1);
});

test('hides arrows when there is one or zero siblings', () => {
  renderWithSiblings({siblingCardIds: ['b']});
  expect(screen.queryByRole('button', {name: /next card/i})).toBeNull();
});

test('ArrowRight / ArrowLeft navigate siblings', async () => {
  const user = userEvent.setup();
  const onGoToSibling = vi.fn();
  renderWithSiblings({onGoToSibling});
  screen.getByRole('button', {name: /next card/i}).focus();
  await user.keyboard('{ArrowRight}');
  expect(onGoToSibling).toHaveBeenCalledWith(1);
  await user.keyboard('{ArrowLeft}');
  expect(onGoToSibling).toHaveBeenCalledWith(-1);
});

/** A card with an Enchanted printing (#625). */
function withEnchanted(card: LorcanaCard): LorcanaCard {
  return {
    ...card,
    imageUrl: `/card-images/${card.id}.avif`,
    variants: [
      {id: `${card.id}-e`, rarity: 'Enchanted', number: 223, imageUrl: '/card-images/2141.avif'},
    ],
  };
}

function renderPrintingModal(
  card: LorcanaCard,
  opts: {onGoToSibling?: (d: 1 | -1) => void; isMobile?: boolean} = {},
) {
  const tree = (c: LorcanaCard) => (
    <MemoryRouter>
      <CardOverviewModal
        isOpen
        card={c}
        synergies={[]}
        getPairSynergies={() => null}
        onClose={() => {}}
        isMobile={opts.isMobile}
        siblingCardIds={['a', 'b', 'c']}
        onGoToSibling={opts.onGoToSibling ?? (() => {})}
      />
    </MemoryRouter>
  );
  const utils = render(tree(card));
  return {...utils, rerenderCard: (c: LorcanaCard) => utils.rerender(tree(c))};
}

test('a card with an alternate printing shows the one picked, and records it', async () => {
  Element.prototype.scrollTo = vi.fn();
  vi.mocked(trackEvent).mockClear();
  const user = userEvent.setup();
  renderPrintingModal(withEnchanted(makeCard('b')));

  await user.click(screen.getByRole('radio', {name: 'Enchanted'}));

  expect(screen.getByRole('img', {name: 'Card b - Test, Enchanted printing'})).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledTimes(1);
  expect(trackEvent).toHaveBeenCalledWith('card_printing_view', {
    cardId: 'b',
    rarity: 'Enchanted',
    surface: 'modal',
  });
});

test('a swiped printing is recorded once it comes to rest, not as the swipe crosses it', () => {
  Element.prototype.scrollTo = vi.fn();
  vi.mocked(trackEvent).mockClear();
  renderPrintingModal(withEnchanted(makeCard('b')));
  const strip = screen.getByRole('group', {name: 'Card b - Test printings'});

  swipeStrip(strip, 1);
  expect(trackEvent).not.toHaveBeenCalled();

  restStrip(strip);
  expect(trackEvent).toHaveBeenCalledTimes(1);
});

test('arrow keys inside the printing switcher change the printing, not the card', async () => {
  Element.prototype.scrollTo = vi.fn();
  const user = userEvent.setup();
  const onGoToSibling = vi.fn();
  renderPrintingModal(withEnchanted(makeCard('b')), {onGoToSibling});
  screen.getByRole('radio', {name: 'Standard'}).focus();

  await user.keyboard('{ArrowRight}');

  expect(screen.getByRole('radio', {name: 'Enchanted'})).toHaveAttribute('aria-checked', 'true');
  expect(onGoToSibling).not.toHaveBeenCalled();
});

test('every card opens on its Standard printing', async () => {
  Element.prototype.scrollTo = vi.fn();
  const user = userEvent.setup();
  const {rerenderCard} = renderPrintingModal(withEnchanted(makeCard('b')));
  await user.click(screen.getByRole('radio', {name: 'Enchanted'}));

  rerenderCard(withEnchanted(makeCard('c')));

  expect(screen.getByRole('radio', {name: 'Standard'})).toHaveAttribute('aria-checked', 'true');
});

test('an English variant printing turns the translation off and hides its toggle', async () => {
  Element.prototype.scrollTo = vi.fn();
  const user = userEvent.setup();
  renderPrintingModal({
    ...withEnchanted(makeCard('jp')),
    scanLanguage: 'ja',
    textSections: ['Draw a card.'],
  });
  await user.click(screen.getByRole('button', {name: 'See translation'}));

  await user.click(screen.getByRole('radio', {name: 'Enchanted'}));

  expect(screen.queryByTestId('card-translation')).toBeNull();
  expect(screen.getByText('See translation')).not.toBeVisible();
});

/** An English card whose Epic is known only from an Italian scan, like Baymax's (#681). */
function withItalianEpic(card: LorcanaCard): LorcanaCard {
  return {
    ...card,
    textSections: ['Draw a card.'],
    imageUrl: `/card-images/${card.id}.avif`,
    variants: [
      {
        id: `${card.id}-epic`,
        rarity: 'Epic',
        number: 213,
        imageUrl: '/card-images/14213.avif',
        scanLanguage: 'it',
      },
    ],
  };
}

test('an English card with an English variant offers no translation', () => {
  Element.prototype.scrollTo = vi.fn();
  renderPrintingModal(withEnchanted(makeCard('b')));

  expect(screen.queryByText('See translation')).toBeNull();
});

// Desktop's toggle sits in the header, mobile's under the card (MobileArtControls).
test.each([false, true])(
  'a foreign-scan variant offers its translation on that printing only (mobile: %s)',
  async (isMobile) => {
    Element.prototype.scrollTo = vi.fn();
    const user = userEvent.setup();
    renderPrintingModal(withItalianEpic(makeCard('b')), {isMobile});
    // The Standard scan is English: the toggle holds its place, hidden.
    expect(screen.getByText('See translation')).not.toBeVisible();

    await user.click(screen.getByRole('radio', {name: 'Epic'}));
    await user.click(screen.getByRole('button', {name: 'See translation'}));
    // The card's own scan is English, so the text is its official wording, not a translation.
    const panel = screen.getByRole('region', {name: 'English text of Card b - Test'});
    expect(panel).toHaveTextContent('Draw a card.');
    expect(panel).toHaveTextContent("This printing is in Italian. The text is the English card's.");

    await user.click(screen.getByRole('radio', {name: 'Standard'}));
    expect(screen.queryByTestId('card-translation')).toBeNull();
    expect(screen.getByText('See translation')).not.toBeVisible();
  },
);

test('a card opened on its foreign-scan printing offers the translation at once', () => {
  Element.prototype.scrollTo = vi.fn();
  render(
    <MemoryRouter>
      <CardOverviewModal
        isOpen
        card={withItalianEpic(makeCard('b'))}
        initialPrintingId="b-epic"
        synergies={[]}
        getPairSynergies={() => null}
        onClose={() => {}}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('button', {name: 'See translation'})).toBeVisible();
});
