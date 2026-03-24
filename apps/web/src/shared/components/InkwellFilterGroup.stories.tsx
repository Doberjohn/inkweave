import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {InkwellValue} from './InkwellIcon';
import {InkwellFilterGroup} from './InkwellFilterGroup';

const meta: Meta<typeof InkwellFilterGroup> = {
  title: 'Components/InkwellFilterGroup',
  component: InkwellFilterGroup,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const NoneSelected: Story = {
  args: {activeValue: undefined, onToggle: () => {}},
};

export const InkableSelected: Story = {
  args: {activeValue: 'inkable', onToggle: () => {}},
};

export const UninkableSelected: Story = {
  args: {activeValue: 'uninkable', onToggle: () => {}},
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<InkwellValue | undefined>(undefined);
    return <InkwellFilterGroup activeValue={value} onToggle={setValue} />;
  },
};
