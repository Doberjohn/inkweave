import type {Meta, StoryObj} from '@storybook/react-vite';
import {LinkButton} from './LinkButton';

const meta: Meta<typeof LinkButton> = {
  title: 'Shared/LinkButton',
  component: LinkButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The accent action link ("Show the math", "Undo").
export const Gold: Story = {args: {children: 'Why 72? Show the math'}};

// The quiet utility link ("Clear all" — previously four hand-rolled recipes).
export const Muted: Story = {args: {tone: 'muted', children: 'Clear all'}};

export const SmallMutedUnderline: Story = {
  args: {tone: 'muted', size: 'sm', underlineOnHover: true, children: 'Clear'},
};

export const Disabled: Story = {args: {disabled: true, children: 'Undo'}};
