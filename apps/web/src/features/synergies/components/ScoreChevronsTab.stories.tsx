import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {ScoreChevronsTab} from './ScoreChevronsTab';
import {COLORS, INK_COLORS, RADIUS} from '../../../shared/constants';

const meta = {
  title: 'Synergies/ScoreChevronsTab',
  component: ScoreChevronsTab,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // One column of the phone comparison's two-tab bar.
      <div
        style={{
          width: 176,
          display: 'grid',
          padding: 16,
          background: COLORS.surface,
          borderRadius: RADIUS.card,
        }}>
        <Story />
      </div>
    ),
  ],
  args: {
    label: 'Engine',
    score: '6.0',
    showScale: true,
    isActive: true,
    tint: COLORS.primary,
    onClick: fn(),
  },
} satisfies Meta<typeof ScoreChevronsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The engine's score, its panel in view. */
export const EngineActive: Story = {};

/** The engine's tab while the community panel is in view. */
export const EngineInactive: Story = {
  args: {isActive: false},
};

/** The community's score, in the community column's purple. */
export const CommunityActive: Story = {
  args: {label: 'Community', score: '7.2', tint: INK_COLORS.Amethyst.text},
};

/** Too few votes for a community score: a dash, with no "/10". */
export const CommunityNoScore: Story = {
  args: {
    label: 'Community',
    score: '—',
    showScale: false,
    isActive: false,
    tint: INK_COLORS.Amethyst.text,
  },
};
