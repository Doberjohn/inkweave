import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FilterDialog} from './FilterDialog';
import {COLORS, FONT_SIZES} from '../tokens/theme';

/** Stands in for the filters a caller puts inside: the app's CardFilterDialog puts FilterContent. */
const body = (
  <p style={{margin: 0, color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`}}>
    The caller&apos;s filters go here.
  </p>
);

const meta = {
  title: 'Components/FilterDialog',
  component: FilterDialog,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    onApply: fn(),
    onClearAll: fn(),
    activeCount: 2,
    variant: 'modal',
    children: body,
  },
} satisfies Meta<typeof FilterDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Modal: Story = {};

export const Drawer: Story = {
  args: {variant: 'drawer'},
};
