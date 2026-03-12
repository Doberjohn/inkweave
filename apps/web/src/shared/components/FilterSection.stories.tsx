import type {Meta, StoryObj} from '@storybook/react-vite';
import {FilterSection} from './FilterSection';

const meta: Meta<typeof FilterSection> = {
  title: 'Shared/FilterSection',
  component: FilterSection,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 300}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Ink Color',
    children: (
      <div style={{padding: 8, background: '#1a1a2e', borderRadius: 4}}>Filter content</div>
    ),
  },
};

export const Compact: Story = {
  args: {
    label: 'Keywords',
    compact: true,
    children: (
      <div style={{padding: 8, background: '#1a1a2e', borderRadius: 4}}>Filter content</div>
    ),
  },
};
