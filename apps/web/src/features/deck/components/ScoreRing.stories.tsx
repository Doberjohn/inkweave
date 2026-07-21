import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, INK_COLORS} from '../../../shared/constants';
import {ScoreRing} from './ScoreRing';

const meta: Meta<typeof ScoreRing> = {
  title: 'Deck/ScoreRing',
  component: ScoreRing,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The overall Deck Quality Score ring — big, tier-colored (amber = "Fair").
export const OverallFair: Story = {args: {score: 51, color: INK_COLORS.Amber.border, size: 104, label: 'Fair'}};

// A strong overall score reads green.
export const OverallExcellent: Story = {args: {score: 88, color: COLORS.success, size: 104, label: 'Excellent'}};

// Per-dimension rings (Analysis tab), colored by the analyzer's status.
export const DimensionGood: Story = {args: {score: 88, color: COLORS.success, size: 64, label: 'Curve'}};
export const DimensionWeak: Story = {args: {score: 42, color: COLORS.error, size: 64, label: 'Removal'}};

// Guards: a 0 score is an empty arc; over-100 clamps to a full ring.
export const Zero: Story = {args: {score: 0, color: COLORS.error, size: 64, label: 'None'}};
export const ClampedFull: Story = {args: {score: 120, color: COLORS.success, size: 64, label: 'Max'}};
