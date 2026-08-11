import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BinderSpread} from './BinderSpread';
import {CardTile} from './CardTile';
import {BINDER_CARDS} from './binderStoryCards';
import {COLORS} from '../../../shared/constants';

/**
 * The shared binder chrome. Both binders render through this: Browse compacts
 * results into it, the collection binder holds fixed slots in it.
 *
 * THE DECORATOR IS FIXTURE, NOT DECORATION. Every page inside is `height: 100%`
 * and card width is derived from row height, so a decorator with an indefinite
 * height collapses the whole spread to nothing. 760px stands in for the space
 * the page gives it below the header and toolbar.
 */
const meta: Meta<typeof BinderSpread> = {
  title: 'Cards/BinderSpread',
  component: BinderSpread,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{height: 760, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    start: 0,
    label: 'Spread 1 of 43 · cards 1–24 of 1024',
    onPrev: fn(),
    onNext: fn(),
    canPrev: false,
    canNext: true,
    renderSlot: (index: number) => {
      const card = BINDER_CARDS[index];
      if (!card) return null;
      return (
        <CardTile
          card={card}
          isSelected={false}
          onSelect={fn()}
          variant="minimal"
          borderRadius={0}
          useSmallImage
        />
      );
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A full spread: both pages of twelve, the ringed spine, the pager. */
export const Default: Story = {};

/**
 * The trailing spread. Empty pockets still occupy their cells — collapsing them
 * would reflow the last spread into a different shape from every other one.
 */
export const PartlyFilled: Story = {
  args: {
    start: 0,
    label: 'Spread 2 of 2 · cards 25–26 of 26',
    canPrev: true,
    canNext: false,
    renderSlot: (index: number) => {
      const card = BINDER_CARDS.slice(24)[index];
      if (!card) return null;
      return (
        <CardTile
          card={card}
          isSelected={false}
          onSelect={fn()}
          variant="minimal"
          borderRadius={0}
          useSmallImage
        />
      );
    },
  },
};

/** Mid-book: both pager directions live. */
export const MidBook: Story = {
  args: {label: 'Spread 12 of 43 · cards 265–288 of 1024', canPrev: true, canNext: true},
};

/**
 * With a footnote, which only the collection binder uses — it needs a legend
 * because two of its card states mean different kinds of absence.
 */
export const WithFootnote: Story = {
  args: {
    label: 'Spread 1 of 9 · cards 1–24',
    footnote: (
      <>
        Showing <strong>normal</strong> copies. Greyed cards are ones you do not own; faded cards
        are filtered out but keep their place.
      </>
    ),
  },
};

/**
 * Short viewport. Cards derive from the height budget, so the spread shrinks to
 * fit rather than scrolling — the property the whole layout rests on.
 */
export const ShortViewport: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{height: 520, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
