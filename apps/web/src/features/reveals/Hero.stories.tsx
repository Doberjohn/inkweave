import type {Meta, StoryObj} from '@storybook/react-vite';
import {Hero} from './Hero';

const meta: Meta<typeof Hero> = {
  title: 'Features/Reveals/Hero',
  component: Hero,
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const PreRelease: Story = {
  args: {phase: 'pre-release', days: 17},
};

export const PreReleaseLive: Story = {
  args: {phase: 'pre-release-live', days: 5},
};

export const OneDay: Story = {
  args: {phase: 'pre-release', days: 1},
};

export const Released: Story = {
  args: {phase: 'released', days: 0},
};
