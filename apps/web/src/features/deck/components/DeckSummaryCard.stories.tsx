import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {DeckSummaryCard} from './DeckSummaryCard';
import type {Deck} from '../types';

/**
 * The narrow end of the real `/decks` grid, where the name plate clamps first. A card
 * rendered full-width in Storybook says nothing about the case it demonstrates, so
 * every story here is measured at the width that hurts.
 */
const GRID_COLUMN_WIDTH = 260;

/** A real Core card image, so the frame's art window is exercised rather than empty. */
const ART = '/card-images/2797.157ae00437d8f67e.avif';

/**
 * The card reads `name`, `inks` and `id` for the href. `cards` stays empty because
 * nothing on the frame counts them — the art arrives as the separate `artUrl` prop,
 * resolved by the caller from the card database.
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
      // The card is a react-router <Link>, which throws without a router above it.
      <MemoryRouter>
        <div style={{width: GRID_COLUMN_WIDTH}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {deck: baseDeck, artUrl: ART, authorName: 'Doberjohn'},
};
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The everyday card. Its frame is chosen by ink pair alone — `amber-steel.webp` here —
 * and the art, name and author are layered into the bitmap's measured windows.
 */
export const TwoInks: Story = {};

/**
 * Mono-ink. The path rule joins a one-element array to a bare name, so this resolves
 * to `amber.webp` with no branch. A frameless card here means the mono assets went
 * missing, which `deckFrame.assets.test` also guards.
 */
export const OneInk: Story = {
  args: {deck: {...baseDeck, name: 'Ruby Rush', inks: ['Ruby']}},
};

/**
 * No inks, which only an empty draft has. There is no frame to pick, so the card
 * falls back to a plain panel AT THE SAME ASPECT — a grid mixing a portrait card with
 * a short tile reads as broken, and the empty state is not the place to spend that.
 */
export const NoInks: Story = {
  args: {deck: {...baseDeck, name: 'New deck', inks: []}, artUrl: undefined, authorName: undefined},
};

/**
 * Art still loading, or a deck with no characters in it yet. The window holds its
 * surface rather than showing the frame's blank white plate through the hole.
 */
export const NoArt: Story = {args: {artUrl: undefined}};

/**
 * Whitespace, not an empty string. The fallback is guarded by `.trim()`, and a bare
 * `''` fixture would still pass if that trim were dropped, shipping a spacebar name
 * as a title that renders as nothing at all.
 */
export const UnnamedDeck: Story = {args: {deck: {...baseDeck, name: '   '}}};

/**
 * The longest real deck name in the wild, 71 characters. The plate is a fixed 9.28%
 * of the card and the bitmap owns that geometry, so it must truncate on ONE line —
 * a second line would spill onto the classification strip below it.
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
 * A display name at the column's 60-character cap. It must ellipsise inside its 70%
 * box without ever reaching the ink symbols pinned at the strip's left edge.
 */
export const LongAuthorName: Story = {
  args: {authorName: 'A Very Long Deck Building Name That Reaches Sixty Characters!'},
};

/** Your own list passes no author, because every deck there is yours. */
export const NoAuthor: Story = {args: {authorName: undefined}};

/**
 * Amber is the contrast worst case: every frame that failed the WCAG body-text bar
 * on its raw band is an Amber one. This is the story the 40% plate scrim exists for.
 */
export const AmberContrastWorstCase: Story = {
  args: {deck: {...baseDeck, name: 'Amber Sapphire Tempo', inks: ['Amber', 'Sapphire']}},
};
