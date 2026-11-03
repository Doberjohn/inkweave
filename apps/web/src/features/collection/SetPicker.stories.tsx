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
import {STORY_OPEN_AMBER, STORY_OPEN_LONG, storyBinderChoices} from './binders/binderStoryData';

/** What an iPhone 15's 393px leave the row's set button, between Filters and Collection. */
const ROW_WIDTH = 164;

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
 * percentages, 34px tall, at the width an iPhone 15's row leaves it between Filters and
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

/** Opens the picker on a binder of your own, whose button is named for the binder. */
const openBinderPicker: Story['play'] = async ({canvasElement}) => {
  await userEvent.click(within(canvasElement).getByRole('button', {name: /^Binder: /}));
};

/** The toolbar's 111px. */
const toolbarWidth: Story['decorators'] = [
  (Story) => (
    <div style={{width: 111}}>
      <Story />
    </div>
  ),
];

/** The row's width on an iPhone 15. */
const rowWidth: Story['decorators'] = [
  (Story) => (
    <div style={{width: ROW_WIDTH}}>
      <Story />
    </div>
  ),
];

/**
 * Your binders (#1074, 3A): the menu's Binders tab before Standard and Promo, which then hold
 * their words alone. Open on My collection, the Binders tab is a press away.
 */
export const BindersTab: Story = {
  args: {setCode: 'all', binders: storyBinderChoices({onOpen: fn()})},
  play: async (context) => {
    await openPicker(context);
    await userEvent.click(within(context.canvasElement).getByRole('button', {name: 'Binders'}));
  },
};

/**
 * A binder of your own at its own Sets: the button's medal and "Your binder" over its name, and
 * the menu opens on Binders, the binder ringed.
 */
export const BinderOpen: Story = {
  args: {setCode: 'all', binders: storyBinderChoices({open: STORY_OPEN_AMBER, onOpen: fn()})},
  play: openBinderPicker,
};

/** A set picked inside a binder of your own: "Amber · Set 12" over the set's name. */
export const BinderInsideSet: Story = {
  args: {setCode: '12', binders: storyBinderChoices({open: STORY_OPEN_AMBER, atOwnScope: false, onOpen: fn()})},
};

/** The toolbar's button on a binder of your own: its medal and name, whole on hover. */
export const CompactBinder: Story = {
  args: {size: 'toolbar', setCode: 'all', binders: storyBinderChoices({open: STORY_OPEN_AMBER, onOpen: fn()})},
  decorators: toolbarWidth,
};

/** The toolbar's button with a set picked inside the binder: "Amber · Set 12", cut short. */
export const CompactBinderInsideSet: Story = {
  args: {size: 'toolbar', setCode: '12', binders: storyBinderChoices({open: STORY_OPEN_AMBER, atOwnScope: false, onOpen: fn()})},
  decorators: toolbarWidth,
};

/** The toolbar's button on a thirty-letter name, with no card of yours to cover it. */
export const CompactLongBinderName: Story = {
  args: {size: 'toolbar', setCode: 'all', binders: storyBinderChoices({open: STORY_OPEN_LONG, onOpen: fn()})},
  decorators: toolbarWidth,
};

/** The phone row's button on a binder of your own: its medal, and its name over the figures. */
export const RowBinder: Story = {
  args: {
    size: 'row',
    setCode: 'all',
    figures: {shown: '75% · 25%', words: '75% complete, 25% master'},
    binders: storyBinderChoices({open: STORY_OPEN_AMBER, onOpen: fn()}),
  },
  decorators: rowWidth,
};

/** The phone row's button on a thirty-letter name, cut short. */
export const RowLongBinderName: Story = {
  ...RowBinder,
  args: {...RowBinder.args, binders: storyBinderChoices({open: STORY_OPEN_LONG, onOpen: fn()})},
};
