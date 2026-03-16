import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {BackLink} from './BackLink';

const meta: Meta<typeof BackLink> = {
  title: 'Components/BackLink',
  component: BackLink,
  parameters: {layout: 'centered', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BackLink>;

export const Default: Story = {
  args: {onClick: fn(), label: 'Back to all synergies'},
};
