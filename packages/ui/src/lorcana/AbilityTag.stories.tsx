import type {Meta, StoryObj} from '@storybook/react-vite';
import {AbilityTag} from './AbilityTag';

const meta: Meta<typeof AbilityTag> = {
  title: 'Components/AbilityTag',
  component: AbilityTag,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AbilityTag>;

export const Stacked: Story = {
  args: {variant: 'stacked', children: 'Ramp'},
};

export const LongLabelStacked: Story = {
  args: {variant: 'stacked', children: 'Named Companions'},
};

export const Page: Story = {
  args: {variant: 'page', children: 'Locations'},
};
