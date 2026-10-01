import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS} from '../../../shared/constants';
import {VerdictLine} from './VerdictLine';

const meta: Meta<typeof VerdictLine> = {
  title: 'Deck/VerdictLine',
  component: VerdictLine,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, width: 420, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onGameplanChange: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Strong: Story = {
  args: {archetype: 'aggro', archetypeConfidence: 0.9, score: 78, gameplan: undefined},
};

export const NeedsWork: Story = {
  args: {archetype: 'control', archetypeConfidence: 0.5, score: 22, gameplan: undefined},
};

// A declared gameplan: the archetype badge shows it as chosen, not detected.
export const DeclaredGameplan: Story = {
  args: {archetype: 'ramp', archetypeConfidence: 1, score: 64, gameplan: 'ramp'},
};
