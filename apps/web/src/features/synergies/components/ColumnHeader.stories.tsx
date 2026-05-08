import type {Meta, StoryObj} from '@storybook/react-vite';
import {ColumnHeader} from './ColumnHeader';

const ENGINE_GOLD = '#d4af37';
const COMMUNITY_AMETHYST = '#b691ff';

const meta = {
  title: 'Synergies/ColumnHeader',
  component: ColumnHeader,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 360, padding: 18, background: '#1a1a2e', borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ColumnHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

const dot = (color: string) => (
  <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
    <span
      aria-hidden="true"
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}aa`,
      }}
    />
    1 rule contributing
  </span>
);

export const Engine: Story = {
  args: {
    title: 'Engine',
    accentColor: ENGINE_GOLD,
    score: '9',
    scoreColor: ENGINE_GOLD,
    scoreFontSize: 48,
    showScale: true,
    scoreTooltip: 'Perfect — 9.5 and up\nStrong — 7 to 9.4\nModerate — 4 to 6.9\nWeak — under 4',
    meta: dot(ENGINE_GOLD),
  },
};

export const Community: Story = {
  args: {
    title: 'Community',
    accentColor: COMMUNITY_AMETHYST,
    score: '7.4',
    scoreColor: COMMUNITY_AMETHYST,
    scoreFontSize: 42,
    showScale: true,
    meta: <span>52 votes</span>,
  },
};

export const CommunityEmpty: Story = {
  args: {
    title: 'Community',
    accentColor: COMMUNITY_AMETHYST,
    score: '—',
    scoreColor: COMMUNITY_AMETHYST,
    scoreFontSize: 42,
    showScale: false,
    meta: <span>0 / 5 votes</span>,
  },
};
