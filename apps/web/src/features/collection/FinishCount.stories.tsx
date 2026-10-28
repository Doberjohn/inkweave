import type {Meta, StoryObj} from '@storybook/react-vite';
import {SPACING} from '../../shared/constants';
import {FinishCount} from './FinishCount';

/** One finish's copies, read only, on the copies stripe's grounds: a friend's row in Friends who have it (#1055). */
const meta: Meta<typeof FinishCount> = {
  title: 'Collection/FinishCount',
  component: FinishCount,
  decorators: [
    (Story) => (
      <div style={{display: 'flex', gap: SPACING.sm, padding: SPACING.xl}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {finish: 'normal', count: 4},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const Foil: Story = {args: {finish: 'foil', count: 1}};
/** None: a dash. */
export const NoCopies: Story = {args: {finish: 'foil', count: 0}};
