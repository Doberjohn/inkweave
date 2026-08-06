import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {DeckSummaryCard} from './DeckSummaryCard';
import type {Deck} from '../types';

/**
 * The narrow end of the real `/decks` grid, where names clamp first. A tile
 * rendered full-width in Storybook says nothing about the case it is meant to
 * demonstrate, so every story here is measured at the width that hurts.
 */
const GRID_COLUMN_WIDTH = 300;

/**
 * The tile reads exactly three fields: `name`, `inks`, and `id` for the href.
 * `cards` stays empty on purpose, because the copy count arrives as the separate
 * `cardCount` prop and a fixture list here would only invite the two to disagree.
 */
const baseDeck: Deck = {
  id: 'd1e2c3k4-0000-4000-8000-000000000001',
  name: 'Amber Steel Aggro',
  cards: [],
  inks: ['Amber', 'Steel'],
  isPublic: true,
  createdAt: Date.UTC(2026, 6, 1),
  updatedAt: Date.UTC(2026, 7, 1),
  schemaVersion: 1,
};

const meta: Meta<typeof DeckSummaryCard> = {
  title: 'Deck/DeckSummaryCard',
  component: DeckSummaryCard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // The tile is a react-router <Link>, which throws without a router above it.
      <MemoryRouter>
        <div style={{width: GRID_COLUMN_WIDTH}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {deck: baseDeck, cardCount: 60},
};
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The everyday tile. Both gradient stops differ, so the deck's ink pair reads as
 * colour before a single symbol is decoded, which is the entire reason the flat
 * row became a tile.
 */
export const TwoInks: Story = {};

/**
 * Mono-ink. `deckTint` repeats the one ink into both stops rather than branching,
 * so this has to render as a flat panel. A visible diagonal here means a stop
 * drifted, and a stop that renders as nothing means `inks[1]` leaked `undefined`
 * into the gradient string.
 */
export const OneInk: Story = {
  args: {deck: {...baseDeck, name: 'Ruby Rush', inks: ['Ruby']}, cardCount: 42},
};

/**
 * A fresh draft, which has not earned a colour identity: plain surface, no
 * gradient, no ink symbols to sit on it. A tint appearing here would be an empty
 * deck claiming inks it does not have.
 */
export const NoInks: Story = {
  args: {deck: {...baseDeck, name: 'New deck', inks: []}, cardCount: 0},
};

/**
 * Whitespace, not an empty string. The fallback is guarded by `.trim()`, and a
 * bare `''` fixture would still pass if that trim were dropped, shipping a
 * spacebar name as a title that renders as nothing at all.
 */
export const UnnamedDeck: Story = {args: {deck: {...baseDeck, name: '   '}}};

/**
 * The longest real deck name in the wild, 71 characters. It must clamp to two
 * lines and ellipsize while the inks and the count hold their row: the tile is a
 * grid item, so a name that refuses to clamp widens the whole track, not just
 * itself. Nothing caps deck-name length, so this is the floor, not the ceiling.
 */
export const LongName: Story = {
  args: {
    deck: {
      ...baseDeck,
      name: 'Set 13 BS! Justin Told Me Terror That Flaps In the Night Is a Good Card',
    },
  },
};

/**
 * One copy, one label. The count pluralizes inline, and "1 cards" is exactly the
 * kind of thing that ships, because nobody builds a one-card deck by hand.
 */
export const SingleCard: Story = {args: {cardCount: 1}};

/**
 * The community list, where whose deck this is matters. The author groups with the
 * name rather than joining the ink/count row: the tile is `space-between` over two
 * children, so a third would land in the middle instead of under the title.
 */
export const WithAuthor: Story = {args: {authorName: 'Doberjohn'}};

/**
 * A display name at the column's 60-character cap, on the longest real deck name.
 * Both must ellipsize independently — the author on one line, the title on two —
 * without either widening the grid track they share.
 */
export const LongNameAndLongAuthor: Story = {
  args: {
    deck: {
      ...baseDeck,
      name: 'Set 13 BS! Justin Told Me Terror That Flaps In the Night Is a Good Card',
    },
    authorName: 'A Very Long Deck Building Name That Reaches Sixty Characters!',
  },
};

/**
 * Your own list passes no author, because every deck there is yours and repeating
 * that per tile is noise. The title block must collapse cleanly to one child.
 */
export const NoAuthor: Story = {args: {authorName: undefined}};
