import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {PagesPicker} from './PagesPicker';

/**
 * Change page size, from My collection's ⋯: its three sizes, its own ringed and marked. A pick
 * saves at once, and saves reach the server, so these stories never pick; its unit tests hold the
 * saving and failure states. A dialog on a computer, a sheet on a phone.
 */
const meta: Meta<typeof PagesPicker> = {
  title: 'Collection/Binders/PagesPicker',
  component: PagesPicker,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    pages: 4,
    readerId: 'story-reader',
    isMobile: false,
    onSaved: fn(),
    onClose: fn(),
    onGone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** My collection at the default, 4 × 4. */
export const Default: Story = {};

/** My collection at 3 × 3. */
export const ThreeByThree: Story = {args: {pages: 3}};

/** A phone's sheet. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};
