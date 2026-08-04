import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {DeckSummaryCard} from './DeckSummaryCard';
import type {Deck} from '../types';

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
  // It renders a <Link>, so it needs a router above it.
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{maxWidth: 640}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {deck: baseDeck, cardCount: 60},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The everyday row: a named, legal, two-ink deck. */
export const Default: Story = {};

/** A deck saved before it was named still has to be readable and clickable. */
export const Untitled: Story = {args: {deck: {...baseDeck, name: ''}}};

/** A long name truncates rather than pushing the inks and the count off the row. */
export const LongName: Story = {
  args: {deck: {...baseDeck, name: 'Sapphire Steel Ramp into Big Late-Game Locations and Friends'}},
};

/** A single-ink deck, and the singular card label. */
export const SingleInkOneCard: Story = {
  args: {deck: {...baseDeck, name: 'Ruby Rush', inks: ['Ruby']}, cardCount: 1},
};

/** An empty draft has no inks derived yet — the chips row simply disappears. */
export const EmptyDraft: Story = {
  args: {deck: {...baseDeck, name: 'New deck', inks: []}, cardCount: 0},
};
