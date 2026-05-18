import type {Meta, StoryObj} from '@storybook/react-vite';
import {HomePageSkeleton} from './HomePageSkeleton';

const meta = {
  title: 'Pages/HomePageSkeleton',
  component: HomePageSkeleton,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
} satisfies Meta<typeof HomePageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {isMobile: false},
};

export const Mobile: Story = {
  args: {isMobile: true},
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};
