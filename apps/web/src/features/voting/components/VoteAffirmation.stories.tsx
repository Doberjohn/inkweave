import type {Meta, StoryObj} from '@storybook/react-vite';
import {VoteAffirmation} from './VoteAffirmation';

const ENGINE_GOLD = '#d4af37';
const COMMUNITY_AMETHYST = '#b691ff';

const meta = {
  title: 'Voting/VoteAffirmation',
  component: VoteAffirmation,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 320, padding: 24, background: '#1a1a2e', borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VoteAffirmation>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EngineGold: Story = {
  args: {
    accentColor: ENGINE_GOLD,
    title: 'Thanks for your quick vote',
    detail: "You marked the engine's score as Fair.",
  },
};

export const CommunityAmethyst: Story = {
  args: {
    accentColor: COMMUNITY_AMETHYST,
    title: "You've already rated this pair in detail",
    detail: 'Your full vote is reflected in the community signal.',
  },
};

export const TitleOnly: Story = {
  args: {
    accentColor: ENGINE_GOLD,
    title: 'Vote recorded',
  },
};
