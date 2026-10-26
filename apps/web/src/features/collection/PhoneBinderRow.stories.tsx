import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {PhoneBinderRow} from './PhoneBinderRow';
import {CollectionModeSwitch} from './CollectionModeSwitch';
import {SetPicker, type RowFigures} from './SetPicker';
import {percentOf} from './collectionStats';
import {STORY_SETS, STORY_STATS} from './collectionStoryData';
import {COLORS} from '../../shared/constants';

/** Each set's progress, by code, and the whole collection's, as the set list reads it. */
const PROGRESS = new Map([['all', STORY_STATS.totals], ...STORY_STATS.sets.map((set) => [set.code, set.tally] as const)]);

/** A scope's two headline percentages, a set's or All sets', as the row's button draws them and says them. */
function figuresOf(setCode: string): RowFigures {
  const {complete, master, cards} = PROGRESS.get(setCode)!;
  const [done, all] = [percentOf(complete, cards), percentOf(master, cards)];
  return {shown: `${done}% · ${all}%`, words: `${done}% complete, ${all}% master`};
}

interface LiveRowProps {
  setCode: string;
  count: number;
  /** While the numbers load the button's figures are a shimmer. */
  loading?: boolean;
}

/** The row as a phone draws it over the binder, live: pick a set and the button follows. */
function LiveRow({setCode, count, loading = false}: LiveRowProps) {
  const [picked, setPicked] = useState(setCode);
  return (
    <PhoneBinderRow
      setPicker={
        <SetPicker
          size="row"
          setCode={picked}
          sets={STORY_SETS}
          setsLoading={false}
          onSetChange={setPicked}
          progress={PROGRESS}
          figures={loading ? undefined : figuresOf(picked)}
        />
      }
      count={count}
      onOpen={fn()}
      modeSwitch={<CollectionModeSwitch active onToggle={fn()} />}
    />
  );
}

/**
 * A phone's one row over the binder in collection mode (owner, 2026-10-25, #969): the set
 * button, Binder options and Collection, at an iPhone 15's 393px. Press the set button for the
 * set list.
 */
const meta: Meta<typeof LiveRow> = {
  title: 'Collection/PhoneBinderRow',
  component: LiveRow,
  decorators: [
    (Story) => (
      <div style={{width: 393, height: 520, background: COLORS.background}}>
        <Story />
      </div>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {setCode: '13', count: 0},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing on: Binder options has no badge. */
export const NoFilters: Story = {};

/** Two on, say an ink and Missing: the badge counts them. */
export const WithCount: Story = {args: {count: 2}};

/** A long name is cut short before the chevron; the button's name holds it whole. */
export const LongSetName: Story = {args: {setCode: '10'}};

/** While the numbers load, a shimmer holds the figures' line. */
export const NumbersLoading: Story = {args: {loading: true}};

/** At 320px the set button leaves its logo out, so its words keep their room. */
export const Narrowest: Story = {
  args: {setCode: '10', count: 1},
  decorators: [
    (Story) => (
      <div style={{width: 320}}>
        <Story />
      </div>
    ),
  ],
  globals: {viewport: {value: 'mobile1'}},
};
