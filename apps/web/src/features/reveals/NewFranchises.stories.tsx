import type {Meta, StoryObj} from '@storybook/react-vite';
import {NewFranchises} from './NewFranchises';

const meta: Meta<typeof NewFranchises> = {
  title: 'Features/Reveals/NewFranchises',
  component: NewFranchises,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{maxWidth: 1180, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  args: {compact: true},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 390, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
