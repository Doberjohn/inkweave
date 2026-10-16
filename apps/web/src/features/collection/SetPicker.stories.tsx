import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {SetPicker, type SetPickerProps} from './SetPicker';
import {SIDE_PANEL_STYLE} from '../cards/components/BrowseSidePanel';
import {STORY_SETS, STORY_STATS} from './collectionStoryData';

const PROGRESS = new Map<string, {complete: number; cards: number}>([
  ['all', STORY_STATS.totals],
  ...STORY_STATS.sets.map((set) => [set.code, set.tally] as const),
]);

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
