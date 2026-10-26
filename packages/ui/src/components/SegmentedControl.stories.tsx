import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {COLORS, FONTS, SPACING} from '../tokens/theme';
import {SegmentedControl} from './SegmentedControl';

const meta: Meta = {
  title: 'Shared/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  parameters: {layout: 'padded'},
  decorators: [
    (Story) => (
      <div style={{color: COLORS.text, fontFamily: FONTS.body}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj;

type Band = 'all' | 'high' | 'mid' | 'low' | 'unscored';
const BANDS: ReadonlyArray<{value: Band; label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'high', label: '7+'},
  {value: 'mid', label: '5–6'},
  {value: 'low', label: '≤4'},
  {value: 'unscored', label: 'No score'},
];

function SegmentedDemo() {
  const [band, setBand] = useState<Band>('all');
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md}}>
      <SegmentedControl ariaLabel="Score band" options={BANDS} value={band} onChange={setBand} />
      <span style={{color: COLORS.textMuted}}>Selected: {band}</span>
    </div>
  );
}

/** A score band filter: one option pressed, a press on another moves it. */
export const Default: Story = {render: () => <SegmentedDemo />};

const TYPES = ['Character', 'Action', 'Item', 'Location', 'Song'].map((label) => ({
  value: label,
  label,
}));

function FillDemo({width}: {width: number}) {
  const [type, setType] = useState('Character');
  return (
    <div style={{width}}>
      <SegmentedControl
        ariaLabel={`Type, ${width}px`}
        options={TYPES}
        value={type}
        onChange={setType}
        fill
      />
    </div>
  );
}

/**
 * `fill`, in a 320px column and a 240px one: the options share the width, and where one line
 * can't hold them all a whole pair wraps, two and two, the odd count's last one filling the last
 * line.
 */
export const Fill: Story = {
  render: () => (
    <div style={{display: 'grid', gap: SPACING.xl}}>
      <FillDemo width={320} />
      <FillDemo width={240} />
    </div>
  ),
};

/** `held`: every option dims and takes no press or hover, and a focused one keeps its focus. */
export const Held: Story = {
  render: () => (
    <SegmentedControl ariaLabel="Score band" options={BANDS} value="mid" onChange={() => {}} held />
  ),
};
