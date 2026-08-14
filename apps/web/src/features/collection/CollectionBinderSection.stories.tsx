import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CollectionBinderSection} from './CollectionBinderSection';
import {BINDER_CARDS} from '../cards/components/binderStoryCards';
import type {CollectionEntries} from './collectionParser';
import {COLORS} from '../../shared/constants';

/**
 * Collection mode's content: the set picker above the binder.
 *
 * The fixture cards are Set 9, so the picker starts on Set 1 with nothing in it.
 * Each story sets the set explicitly through the component's own control rather
 * than by prop, because which set you are on is deliberately LOCAL state — it is
 * where you are standing, not something worth putting in a shareable URL.
 */
const entries: CollectionEntries = Object.fromEntries(
  BINDER_CARDS.map((card) => {
    const n = Number(card.id);
    return [card.id, {normal: n % 3 === 0 ? 2 : n % 2 === 0 ? 1 : 0, foil: n % 5 === 0 ? 1 : 0}];
  }),
);

const meta: Meta<typeof CollectionBinderSection> = {
  title: 'Collection/CollectionBinderSection',
  component: CollectionBinderSection,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{height: 800, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    cards: BINDER_CARDS,
    matchedIds: new Set(BINDER_CARDS.map((c) => c.id)),
    entries,
    isLoading: false,
    error: null,
    stepperVariant: 'zeros',
    onCardSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Opens on Set 1, which these Set 9 fixtures do not populate — the honest
 * first-render state, and the reason the set picker is the first control.
 */
export const Default: Story = {};

/** Chunks in flight. A message, never an empty binder. */
export const Loading: Story = {
  args: {isLoading: true},
};

/**
 * The fetch failed. Rendered as a message rather than falling through, because
 * a binder of blank slots is indistinguishable from "you own none of this set" —
 * a failed request would read as a fact about the collection.
 */
export const LoadFailed: Story = {
  args: {error: 'Could not load the collection (set 4: HTTP 502).'},
};
