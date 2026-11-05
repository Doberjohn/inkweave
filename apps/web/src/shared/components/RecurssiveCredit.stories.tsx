import type {Meta, StoryObj} from '@storybook/react-vite';
import {RecurssiveCredit} from './RecurssiveCredit';

const meta: Meta<typeof RecurssiveCredit> = {
  title: 'Components/RecurssiveCredit',
  component: RecurssiveCredit,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecurssiveCredit>;

export const Default: Story = {};
