import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {SetPicker, type SetPickerProps} from './SetPicker';
import {SIDE_PANEL_STYLE} from '../cards/components/BrowseSidePanel';
import {
  STORY_PROMO_SET,
  STORY_PROMO_STATS,
  STORY_SETS,
  STORY_SETS_WITH_PROMOS,
  STORY_STATS,
} from './collectionStoryData';

/** What an iPhone 15's 393px leave the row's set button, beside Binder options and Collection (#969). */
const ROW_WIDTH = 210;

/** Each set's progress, by code, the whole collection's and every promo set's. */
const progressOf = (stats: typeof STORY_STATS) =>
  new Map<string, {complete: number; cards: number}>([
    ['all', stats.totals],
    ['promos', stats.promoTotals],
    ...stats.sets.map((set) => [set.code, set.tally] as const),
  ]);

/**
 * The binder's set picker, in the side panel's surface it lives on. Live: pick a set or All
 * sets and the button follows. Keyboard: the arrows open it and move through it, Escape
 * closes it.
 */
function LivePicker(args: SetPickerProps) {
  const [setCode, setSetCode] = useState(args.setCode);
  // A new `setCode` from the Controls panel replaces the one picked here.
  const [argSetCode, setArgSetCode] = useState(args.setCode);
  if (args.setCode !== argSetCode) {
    setArgSetCode(args.setCode);
    setSetCode(args.setCode);
  }
  const onSetChange = (set: string) => {
    setSetCode(set);
    args.onSetChange(set);
  };
  return <SetPicker {...args} setCode={setCode} onSetChange={onSetChange} />;
}

const meta: Meta<typeof LivePicker> = {
  title: 'Collection/SetPicker',
  component: LivePicker,
  decorators: [
    (Story) => (
      <div style={{...SIDE_PANEL_STYLE, height: 560}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {
    setCode: '13',
    sets: STORY_SETS_WITH_PROMOS,
    setsLoading: false,
    onSetChange: fn(),
    progress: progressOf(STORY_PROMO_STATS),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const openPicker: Story['play'] = async ({canvasElement}) => {
  await userEvent.click(within(canvasElement).getByRole('button', {name: /^Binder set/}));
};

/** A two-line name under the set's number and logo. */
export const Closed: Story = {};

/** The whole collection picked: the lore symbol, the number of sets, its name. */
export const WholeCollection: Story = {args: {setCode: 'all'}};

/**
 * Open (owner, 2026-10-20): Standard / Promo, then All sets and the standard sets
 * with their progress, the open one ringed in gold and focused.
 */
export const Open: Story = {play: openPicker};

/** Open on the whole collection: the standard sets' tab, All sets first, ringed and focused. */
export const OpenOnWholeCollection: Story = {args: {setCode: 'all'}, play: openPicker};

/** A one-line name keeps the button's height, so nothing below it moves between sets. */
export const OneLineName: Story = {args: {setCode: '9'}};

/** While the set list loads: the picker waits, and the rows will have no percentages yet. */
export const Loading: Story = {args: {sets: ['13'], setsLoading: true, progress: null}};

/**
 * The desktop toolbar's button, beside Collection (owner, 2026-10-20): the set's number and
 * no picture, in the 111px left beside Collection and the gear.
 */
export const Compact: Story = {
  args: {size: 'toolbar'},
  decorators: [
    (Story) => (
      <div style={{width: 111}}>
        <Story />
      </div>
    ),
  ],
};

/** The toolbar's button on the whole collection: "All sets". */
export const CompactWholeCollection: Story = {...Compact, args: {size: 'toolbar', setCode: 'all'}};

/** The toolbar's button on a promo set: the set's code, whole on hover. */
export const CompactPromoSet: Story = {...Compact, args: {size: 'toolbar', setCode: STORY_PROMO_SET}};

/** The toolbar's button on every promo set (owner, 2026-10-20): "Promos". */
export const CompactAllPromoSets: Story = {...Compact, args: {size: 'toolbar', setCode: 'promos'}};

/**
 * The phone binder row's button (owner, 2026-10-25, #969): the set's logo, its name over its two
 * percentages, 40px tall, at the width an iPhone 15's row leaves it beside Binder options and
 * Collection. Its list is the panel's.
 */
export const Row: Story = {
  args: {size: 'row', figures: {shown: '36% · 12%', words: '36% complete, 12% master'}},
  decorators: [
    (Story) => (
      <div style={{width: ROW_WIDTH}}>
        <Story />
      </div>
    ),
  ],
};

/** The row's button while the numbers load: a shimmer holds the figures' line. */
export const RowLoading: Story = {...Row, args: {size: 'row'}};

/**
 * Every promo set picked (owner, 2026-10-20): the promo symbol, the number of promo sets, and
 * "All promo sets". Open, the menu is on the promo sets' tab, its All sets ringed.
 */
export const AllPromoSets: Story = {args: {setCode: 'promos'}, play: openPicker};

/**
 * A promo set picked (owner, 2026-10-17, #805): the promo symbol for its logo, "Promo set"
 * and its code over its name. Open, the menu is on the promo sets' tab.
 */
export const PromoSet: Story = {args: {setCode: STORY_PROMO_SET}, play: openPicker};

/** A binder with no promo set: no tabs to choose between, All sets over the sets. */
export const NoPromoSets: Story = {args: {sets: STORY_SETS, progress: progressOf(STORY_STATS)}, play: openPicker};

/**
 * Curator's Collection picked (owner, 2026-10-18): one promo set for all its editions, by CC,
 * the letters their codes share (CC1, CC2), and its name.
 */
export const CuratorsCollection: Story = {
  args: {setCode: 'CC', sets: [...STORY_SETS, 'CC', 'P1'], progress: null},
};
