import type {Meta, StoryObj} from '@storybook/react-vite';
import {RevealHero} from './RevealHero';
import {FRANCHISES} from './franchise';

const meta: Meta<typeof RevealHero> = {
  title: 'Features/Reveals/RevealHero',
  component: RevealHero,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// franchiseCount comes from the season's config, as the page passes it.
const SEASON = {
  countdown: {days: 21, milestone: 'pre-release' as const},
  releaseDate: 'October 23, 2026',
  totalRevealed: 86,
  franchiseCount: FRANCHISES.length,
};

export const Default: Story = {
  args: SEASON,
};

/** From pre-release day on, the countdown runs to the store release instead of resting at 0. */
export const StoreRelease: Story = {
  args: {...SEASON, countdown: {days: 4, milestone: 'store-release'}},
};

/** The stat label pluralises with the count ("New franchise" vs "New franchises"). */
export const SeveralFranchises: Story = {
  args: {...SEASON, franchiseCount: 3},
};

export const Mobile: Story = {
  args: {...SEASON, compact: true},
};

/** While the card list loads (#913): a placeholder in the count's place, never a false 0. */
export const Loading: Story = {
  args: {...SEASON, totalRevealed: null},
};
