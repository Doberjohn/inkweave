import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BinderSlotSkeleton, BinderSpread} from './BinderSpread';
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
    onPrev: fn(),
    onNext: fn(),
    canPrev: false,
    canNext: true,
    renderSlot: (index: number, tabIndex: number) => {
      const card = BINDER_CARDS[index];
      if (!card) return null;
      return (
        <CardTile
          card={card}
          onSelect={fn()}
          variant="minimal"
          borderRadius={0}
          useSmallImage
          tabIndex={tabIndex}
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
    canPrev: true,
    canNext: false,
    renderSlot: (index: number, tabIndex: number) => {
      const card = BINDER_CARDS.slice(24)[index];
      if (!card) return null;
      return (
        <CardTile
          card={card}
          onSelect={fn()}
          variant="minimal"
          borderRadius={0}
          useSmallImage
          tabIndex={tabIndex}
        />
      );
    },
  },
};

/**
 * The last spread, its right page empty: drawn as the binder's inside back cover rather
 * than as empty parchment, so the binder reads as ending there. Two cards remain.
 */
export const BackCover: Story = {
  args: {
    ...PartlyFilled.args,
    cardCount: BINDER_CARDS.slice(24).length,
  },
};

/**
 * Loading. IDENTICAL chrome to every other story — parchment, spine, arrows and
 * footnote — with shimmer in the pockets, which is what makes the arrival of
 * real cards a change of contents rather than a change of layout. Measured after
 * the change: page geometry is byte-identical from 0 images loaded to 24.
 */
export const Loading: Story = {
  args: {
    canPrev: false,
    canNext: false,
    renderSlot: () => <BinderSlotSkeleton />,
  },
};

/** Mid-book: both arrows live. */
export const MidBook: Story = {
  args: {canPrev: true, canNext: true},
};

/**
 * Where Browse docks its panels (owner, 2026-10-08): no arrows, and no padding of its own.
 * The spread fills the width it is given and starts at the top, so the page decides its edges.
 */
export const WithoutArrows: Story = {
  args: {arrows: false},
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

/**
 * Phone width (owner, 2026-10-07): ONE page per view, arrows in a row beneath.
 * View it in the Mobile viewport; at desktop width it simply shows one page.
 * The slot under any index is the same pocket it is in a spread.
 */
export const SinglePage: Story = {
  args: {single: true, canPrev: true, canNext: true},
  globals: {viewport: {value: 'mobile1'}},
};
