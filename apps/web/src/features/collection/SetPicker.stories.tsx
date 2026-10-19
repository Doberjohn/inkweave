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

/** Each set's progress, by code, and the whole collection's. */
const progressOf = (stats: typeof STORY_STATS) =>
  new Map<string, {complete: number; cards: number}>([
    ['all', stats.totals],
    ...stats.sets.map((set) => [set.code, set.tally] as const),
  ]);

const PROGRESS = progressOf(STORY_STATS);

/**
 * The binder's set picker, in the side panel's surface it lives on. Live: pick a set and
 * the button follows. Keyboard: the arrows open it and move through it, Escape closes it.
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
  args: {setCode: '13', sets: STORY_SETS, setsLoading: false, onSetChange: fn(), progress: PROGRESS},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A two-line name under the set's number and logo. */
export const Closed: Story = {};

/** The whole collection picked: the fanned-cards mark, the number of sets, its name. */
export const WholeCollection: Story = {args: {setCode: 'all'}};

/** Open: the whole collection pinned first, then every set with its progress, the open one ringed in gold and focused. */
export const Open: Story = {
  play: async ({canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: /^Binder set/}));
  },
};

/** A one-line name keeps the button's height, so nothing below it moves between sets. */
export const OneLineName: Story = {args: {setCode: '9'}};

/** While the set list loads: the picker waits, and the rows will have no percentages yet. */
export const Loading: Story = {args: {sets: ['13'], setsLoading: true, progress: null}};

/**
 * A promo set picked (owner, 2026-10-17, #805): the promo symbol for its logo, "Promo set"
 * and its code over its name. Open, the promo sets follow the sets under their heading.
 */
export const PromoSet: Story = {
  args: {setCode: STORY_PROMO_SET, sets: STORY_SETS_WITH_PROMOS, progress: progressOf(STORY_PROMO_STATS)},
  play: async ({canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: /^Binder set/}));
  },
};

/**
 * Curator's Collection picked (owner, 2026-10-18): one promo set for all its editions, by CC,
 * the letters their codes share (CC1, CC2), and its name.
 */
export const CuratorsCollection: Story = {
  args: {setCode: 'CC', sets: [...STORY_SETS, 'CC', 'P1'], progress: null},
};
