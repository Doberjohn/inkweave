import type {Meta, StoryObj} from '@storybook/react-vite';
import {FeaturedCardsSkeleton} from './FeaturedCardsSkeleton';

const meta = {
  title: 'Cards/FeaturedCardsSkeleton',
  component: FeaturedCardsSkeleton,
  parameters: {
    layout: 'fullscreen',
    backgrounds: {default: 'inkweave-dark'},
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FeaturedCardsSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {isMobile: false},
};

export const Mobile: Story = {
  args: {isMobile: true},
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};
