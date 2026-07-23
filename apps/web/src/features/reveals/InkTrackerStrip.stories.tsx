import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink} from 'inkweave-synergy-engine';
import {InkTrackerStrip} from './InkTrackerStrip';

const meta: Meta<typeof InkTrackerStrip> = {
  title: 'Features/Reveals/InkTrackerStrip',
  component: InkTrackerStrip,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const INKS: {ink: Ink; count: number}[] = [
  {ink: 'Amber', count: 20},
  {ink: 'Amethyst', count: 16},
  {ink: 'Emerald', count: 14},
  {ink: 'Ruby', count: 15},
  {ink: 'Sapphire', count: 14},
  {ink: 'Steel', count: 8},
];

function Interactive({compact}: {compact?: boolean}) {
  const [selected, setSelected] = useState<Ink>('Amethyst');
  return (
    <div style={{maxWidth: compact ? 390 : 1180, margin: '0 auto'}}>
      <InkTrackerStrip inks={INKS} selected={selected} onSelect={setSelected} compact={compact} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Interactive />,
};

export const Mobile: Story = {
  render: () => <Interactive compact />,
};
