import type {Meta, StoryObj} from '@storybook/react-vite';
import {ALL_INKS, SPACING} from '../../../shared/constants';
import {InkChip} from './InkChip';

const meta: Meta<typeof InkChip> = {
  title: 'Deck/InkChip',
  component: InkChip,
  tags: ['autodocs'],
  args: {ink: 'Amber'},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Amber: Story = {};

/**
 * All six together, which is the check that matters: the palette is tuned for tint
 * rather than for contrast BETWEEN inks, so the label does the identifying work.
 * Amber against Amethyst is not a distinction every reader can make on colour.
 */
export const EveryInk: Story = {
  render: () => (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: SPACING.sm}}>
      {ALL_INKS.map((ink) => (
        <InkChip key={ink} ink={ink} />
      ))}
    </div>
  ),
};
