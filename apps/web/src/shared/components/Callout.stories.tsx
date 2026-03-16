import type {Meta, StoryObj} from '@storybook/react-vite';
import {Callout} from './Callout';

const meta: Meta<typeof Callout> = {
  title: 'Components/Callout',
  component: Callout,
  parameters: {layout: 'centered', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Callout>;

export const Default: Story = {
  args: {
    children:
      'Cards that share the same character name can Shift onto each other for reduced ink cost.',
  },
};
