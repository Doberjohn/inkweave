import type {Meta, StoryObj} from '@storybook/react-vite';
import {SpotlightHero, type SpotlightHeroData} from './SpotlightHero';
import {FRANCHISES} from './franchise';
import {franchiseSpotlight} from './setSpotlights';
import {INK_COLORS} from '../../shared/constants';

const SAMPLE_HERO = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';
const SAMPLE_SUPPORT = '/card-images/en/set5/17_ddeed71f4dda35d719ac840da0c7ca6acda52796.jpg';

// An inline, season-independent fixture. SET_SPOTLIGHTS is per-season content and
// is empty early in a season, so a story must never index into it.
const spotlight: SpotlightHeroData = {
  accent: INK_COLORS.Emerald.border,
  isNew: true,
  count: '8 cards',
  title: 'A New Mechanic',
  summary: 'A hero card tilted over an accent wash, the description beside it, and a fan of supporting cards.',
  href: '/playstyles/floodborn',
  heroImage: SAMPLE_HERO,
  heroAlt: 'Sample hero card',
  // The fan keys its cards by src, so each entry needs a distinct image.
  support: [
    {src: SAMPLE_SUPPORT, alt: 'Sample support card 1'},
    {src: SAMPLE_HERO, alt: 'Sample support card 2'},
  ],
};

const meta: Meta<typeof SpotlightHero> = {
  title: 'Features/Reveals/SpotlightHero',
  component: SpotlightHero,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
  args: {data: spotlight},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 880, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A debut franchise as the band renders it: an action tile that opens its cards modal. */
export const DebutFranchise: Story = {
  args: {data: franchiseSpotlight(FRANCHISES[0]), onActivate: () => {}},
};

export const Mobile: Story = {
  args: {compact: true},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 390, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
