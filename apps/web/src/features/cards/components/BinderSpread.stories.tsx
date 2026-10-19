import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {BinderSlotSkeleton, BinderSpread} from './BinderSpread';
import {CardTile} from './CardTile';
import {BINDER_CARDS} from './binderStoryCards';
import {COLORS} from '../../../shared/constants';

/** Each pocket's card from `cards`, by index, in the binder's Tab order, and an empty pocket past them. */
const slotsFor = (cards: readonly LorcanaCard[]) => (index: number, tabIndex: number) => {
  const card = cards[index];
  if (!card) return null;
  return (
    <CardTile card={card} onSelect={fn()} variant="minimal" borderRadius={0} useSmallImage tabIndex={tabIndex} />
  );
};

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
    renderSlot: slotsFor(BINDER_CARDS),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A full spread: both pages of twelve, the ringed spine, the pager. */
export const Default: Story = {};

/**
 * The first spread (owner, 2026-10-18): the inside front cover on the left, the same plain
 * board as the back cover, and the binder's first twelve cards on the right.
 */
export const FrontCover: Story = {
  args: {start: -12, cardCount: BINDER_CARDS.length},
};

/**
 * The trailing spread of the 26-card binder: its right page holds the last two, and its
 * other pockets stay empty, still taking their cells. Collapsing them would reflow the
 * last spread into a different shape from every other one.
 */
export const PartlyFilled: Story = {
  args: {start: 12, canPrev: true, canNext: false, cardCount: BINDER_CARDS.length},
};

/**
 * The last spread of a fourteen-card binder: twelve sat beside the front cover, the last two
 * are on this left page, and the right page, past them, is the inside back cover rather than
 * empty parchment, so the binder reads as ending there.
 */
export const BackCover: Story = {
  args: {...PartlyFilled.args, cardCount: 14, renderSlot: slotsFor(BINDER_CARDS.slice(0, 14))},
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
