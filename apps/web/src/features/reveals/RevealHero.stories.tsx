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
const SEASON = {countdownDays: 21, releaseDate: 'October 23, 2026', totalRevealed: 86, franchiseCount: FRANCHISES.length};

export const Default: Story = {
  args: SEASON,
};

/** The stat label pluralises with the count ("New franchise" vs "New franchises"). */
export const SeveralFranchises: Story = {
  args: {...SEASON, franchiseCount: 3},
};

export const Mobile: Story = {
  args: {...SEASON, compact: true},
};
