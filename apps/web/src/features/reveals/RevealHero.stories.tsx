import type {Meta, StoryObj} from '@storybook/react-vite';
import {RevealHero} from './RevealHero';

const meta: Meta<typeof RevealHero> = {
  title: 'Features/Reveals/RevealHero',
  component: RevealHero,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {countdownDays: 21, releaseDate: 'July 24, 2026', totalRevealed: 86, franchiseCount: 3},
};

export const Mobile: Story = {
  args: {countdownDays: 21, releaseDate: 'July 24, 2026', totalRevealed: 86, franchiseCount: 3, compact: true},
};
