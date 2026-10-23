import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {HomePageSkeleton} from './HomePageSkeleton';

const meta = {
  title: 'Pages/HomePageSkeleton',
  component: HomePageSkeleton,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  // The Footer's links (#914: the skeleton draws HomePage's frame, Footer included).
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof HomePageSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {isMobile: false},
};

/** What a phone's first frame shows while the home page's code loads (#914). */
export const Mobile: Story = {
  args: {isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};
