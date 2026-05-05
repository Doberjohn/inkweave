import type {Meta, StoryObj} from '@storybook/react-vite';
import {AbilityTag} from './AbilityTag';

const meta: Meta<typeof AbilityTag> = {
  title: 'Components/AbilityTag',
  component: AbilityTag,
  parameters: {layout: 'centered', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AbilityTag>;

export const Row: Story = {
  args: {variant: 'row', children: 'Ramp'},
};

export const Stacked: Story = {
  args: {variant: 'stacked', children: 'Ramp'},
};

export const LongLabelRow: Story = {
  args: {variant: 'row', children: 'Shift Targets'},
};

export const LongLabelStacked: Story = {
  args: {variant: 'stacked', children: 'Named Companions'},
};

export const SubRoleRow: Story = {
  args: {variant: 'row', children: 'At-payoff'},
};

export const Page: Story = {
  args: {variant: 'page', children: 'Locations'},
};
