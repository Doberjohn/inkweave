import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, SPACING} from '../../shared/constants';
import {WebAnalyticsView} from './WebAnalyticsView';
import type {TrendPoint, VercelAnalytics} from './vercelAnalyticsTypes';

const meta: Meta<typeof WebAnalyticsView> = {
  title: 'Features/AdminAnalytics/WebAnalyticsView',
  component: WebAnalyticsView,
  parameters: {backgrounds: {default: 'dark'}, layout: 'fullscreen'},
  tags: ['autodocs'],
  // Mimic the AdminAnalyticsPage frame (dark bg, page padding, centered max-width, body font)
  // so the story reads like the real route rather than flush to the viewport edges.
  decorators: [
    (Story) => (
      <div
        style={{
          background: COLORS.background,
          color: COLORS.text,
          fontFamily: FONTS.body,
          padding: SPACING.lg,
          maxWidth: 1080,
          margin: '0 auto',
        }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Deterministic sawtooth trend so the bars look alive without random data. */
function trend(base: number): TrendPoint[] {
  return Array.from({length: 30}, (_, i) => ({
    date: `2026-06-${String((i % 30) + 1).padStart(2, '0')}`,
    count: base + ((i * 7) % 11),
  }));
}

const populated: VercelAnalytics = {
  generatedAt: '2026-07-03T12:00:00.000Z',
  hasVercelData: true,
  reportingWindow: {since: '2026-06-03', until: '2026-07-03'},
  events: [
    {
      name: 'reveal_card_click',
      label: 'Reveal card clicks',
      total: 4820,
      visitors: 1310,
      trend: trend(30),
      breakdowns: [
        {
          prop: 'source',
          label: 'By source',
          rows: [
            {value: 'mosaic', count: 3120, visitors: 980},
            {value: 'franchise_modal', count: 1700, visitors: 610},
          ],
        },
        {
          prop: 'franchise',
          label: 'By franchise',
          rows: [
            {value: 'Frozen', count: 1400, visitors: 520},
            {value: 'The Little Mermaid', count: 1100, visitors: 430},
            {value: 'Mulan', count: 820, visitors: 300},
            {value: 'Peter Pan', count: 700, visitors: 260},
            {value: 'Others', count: 800, visitors: 300},
          ],
        },
        {
          prop: 'ink',
          label: 'By ink',
          rows: [
            {value: 'Amber', count: 990, visitors: 420},
            {value: 'Emerald', count: 880, visitors: 390},
            {value: 'Ruby', count: 760, visitors: 340},
            {value: 'Sapphire', count: 720, visitors: 300},
            {value: 'Amethyst', count: 700, visitors: 290},
            {value: 'Steel', count: 770, visitors: 310},
          ],
        },
        {
          prop: 'type',
          label: 'By card type',
          rows: [
            {value: 'Character', count: 3600, visitors: 1120},
            {value: 'Action', count: 700, visitors: 300},
            {value: 'Item', count: 320, visitors: 150},
            {value: 'Location', count: 200, visitors: 90},
          ],
        },
        {
          prop: 'rarity',
          label: 'By rarity',
          rows: [
            {value: 'Common', count: 1200, visitors: 500},
            {value: 'Uncommon', count: 980, visitors: 420},
            {value: 'Rare', count: 900, visitors: 380},
            {value: 'Super Rare', count: 820, visitors: 340},
            {value: 'Legendary', count: 620, visitors: 260},
            {value: 'Enchanted', count: 300, visitors: 140},
          ],
        },
        {
          prop: 'deviceType',
          label: 'By device',
          rows: [
            {value: 'desktop', count: 3100, visitors: 900},
            {value: 'mobile', count: 1500, visitors: 520},
            {value: 'tablet', count: 220, visitors: 90},
          ],
        },
      ],
    },
    {
      name: 'vote_submitted',
      label: 'Votes submitted',
      total: 1240,
      visitors: 410,
      trend: trend(8),
      breakdowns: [
        {
          prop: 'voteType',
          label: 'By vote type',
          rows: [
            {value: 'quick', count: 720, visitors: 260},
            {value: 'score', count: 360, visitors: 140},
            {value: 'in_depth', count: 160, visitors: 70},
          ],
        },
        {
          prop: 'engineScore',
          label: 'By engine score',
          rows: [
            {value: '3', count: 60, visitors: 40},
            {value: '4', count: 120, visitors: 70},
            {value: '5', count: 260, visitors: 120},
            {value: '6', count: 240, visitors: 110},
            {value: '7', count: 300, visitors: 130},
            {value: '8', count: 180, visitors: 90},
            {value: '9', count: 80, visitors: 50},
          ],
        },
        {
          prop: 'userScore',
          label: 'By user score',
          rows: [
            {value: '4', count: 90, visitors: 60},
            {value: '5', count: 150, visitors: 90},
            {value: '6', count: 210, visitors: 110},
            {value: '7', count: 300, visitors: 140},
            {value: '8', count: 260, visitors: 120},
            {value: '9', count: 150, visitors: 80},
            {value: '10', count: 80, visitors: 50},
          ],
        },
        {
          prop: 'deviceType',
          label: 'By device',
          rows: [
            {value: 'desktop', count: 820, visitors: 300},
            {value: 'mobile', count: 380, visitors: 150},
            {value: 'tablet', count: 40, visitors: 20},
          ],
        },
      ],
    },
    {
      name: 'search_submitted',
      label: 'Searches',
      total: 2010,
      visitors: 640,
      trend: trend(14),
      breakdowns: [
        {
          prop: 'source',
          label: 'By source',
          rows: [
            {value: 'home', count: 1200, visitors: 410},
            {value: 'gallery', count: 540, visitors: 190},
            {value: 'mobile_sheet', count: 270, visitors: 110},
          ],
        },
        {
          prop: 'query',
          label: 'Top queries',
          rows: [
            {value: 'elsa', count: 210, visitors: 120},
            {value: 'shift', count: 180, visitors: 90},
            {value: 'seven dwarfs', count: 150, visitors: 80},
            {value: 'Others', count: 1470, visitors: 520},
          ],
        },
      ],
    },
    {
      name: 'vote_skipped',
      label: 'Votes skipped',
      total: 330,
      visitors: 120,
      trend: trend(2),
      breakdowns: [
        {
          prop: 'engineScore',
          label: 'By engine score',
          rows: [
            {value: '2', count: 90, visitors: 50},
            {value: '3', count: 120, visitors: 60},
            {value: '4', count: 70, visitors: 40},
            {value: '5', count: 30, visitors: 20},
            {value: '6', count: 20, visitors: 12},
          ],
        },
      ],
    },
  ],
};

export const Populated: Story = {args: {analytics: populated}};

export const Loading: Story = {args: {analytics: null}};

export const NoToken: Story = {
  args: {
    analytics: {
      generatedAt: '2026-07-03T12:00:00.000Z',
      hasVercelData: false,
      reportingWindow: null,
      events: [],
    },
  },
};
