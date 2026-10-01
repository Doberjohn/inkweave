import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import type {Archetype} from '../types';
import {ArchetypeBadge} from './ArchetypeBadge';

const meta: Meta<typeof ArchetypeBadge> = {
  title: 'Deck/ArchetypeBadge',
  component: ArchetypeBadge,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, padding: 16, width: 380}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Auto-detected with solid confidence: "Detected gameplan".
export const Detected: Story = {
  args: {archetype: 'midrange', confidence: 0.8},
};

// User declared the gameplan: provenance says so and confidence copy drops out.
export const Declared: Story = {
  args: {archetype: 'ramp', confidence: 1, declared: true},
};

// Classifier is unsure: the copy hedges to "Leaning" instead of faking precision.
export const LowConfidence: Story = {
  args: {archetype: 'combo', confidence: 0.35},
};

// All six archetypes side by side, mostly to proof the hint copy lengths.
export const AllArchetypes: Story = {
  args: {archetype: 'aggro', confidence: 0.8},
  render: () => (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
      {(['aggro', 'tempo', 'midrange', 'control', 'combo', 'ramp'] as Archetype[]).map((a) => (
        <ArchetypeBadge key={a} archetype={a} confidence={0.8} />
      ))}
    </div>
  ),
};
