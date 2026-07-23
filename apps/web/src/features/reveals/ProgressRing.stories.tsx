import type {Meta, StoryObj} from '@storybook/react-vite';
import {ProgressRing} from './ProgressRing';
import {ALL_INKS} from '../../shared/constants';

const meta: Meta<typeof ProgressRing> = {
  title: 'Features/Reveals/ProgressRing',
  component: ProgressRing,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {ink: 'Amethyst', count: 16},
};

export const Complete: Story = {
  args: {ink: 'Emerald', count: 34},
};

export const Mobile: Story = {
  args: {ink: 'Amber', count: 20, size: 64},
};

// Representative live Set 13 counts across all six inks.
const COUNTS: Record<string, number> = {
  Amber: 20,
  Amethyst: 15,
  Emerald: 14,
  Ruby: 15,
  Sapphire: 14,
  Steel: 8,
};

export const AllInks: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 18, flexWrap: 'wrap', padding: 16}}>
      {ALL_INKS.map((ink) => (
        <ProgressRing key={ink} ink={ink} count={COUNTS[ink]} />
      ))}
    </div>
  ),
};
