import type {Meta, StoryObj} from '@storybook/react-vite';
import {DeltaPanel} from './DeltaPanel';

const meta = {
  title: 'Synergies/DeltaPanel',
  component: DeltaPanel,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // 320px wraps it in the mobile-comparison-panel-width container so the score-track + dots
      // lay out at production size. DeltaPanel is purely presentational so no providers needed.
      <div style={{width: 320, background: '#1a1a2e', padding: 16, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeltaPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CommunityHigher: Story = {
  args: {engineScore: 5, communityScore: 6.4, votes: 17},
};

export const CommunityLower: Story = {
  args: {engineScore: 8, communityScore: 5.8, votes: 22},
};

export const EvenWithEngine: Story = {
  args: {engineScore: 7, communityScore: 7, votes: 11},
};

export const SmallDelta: Story = {
  args: {engineScore: 6.2, communityScore: 6.5, votes: 9},
};

export const SingleVote: Story = {
  args: {engineScore: 4, communityScore: 5, votes: 1},
};

/**
 * Right-edge case (community 9.0 + engine 8.0) — verifies the COMMUNITY label doesn't spill
 * outside the panel's right border. Labels at position ≥80% right-anchor to the marker.
 */
export const CommunityNearMax: Story = {
  args: {engineScore: 8, communityScore: 9, votes: 5},
};

/** Left-edge case (community 1.0 + engine 2.0) — mirrors the right-edge case for symmetry. */
export const CommunityNearMin: Story = {
  args: {engineScore: 2, communityScore: 1, votes: 5},
};
