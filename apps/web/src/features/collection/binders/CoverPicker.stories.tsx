import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CoverPicker} from './CoverPicker';
import {STORY_AMBER} from './binderStoryData';

/**
 * Change cover, from a cover's ⋯: the eight designs, four across with their names, the binder's
 * own ringed and marked. A pick saves at once, and saves reach the server, so these stories never
 * pick; its unit tests hold the saving and failure states. A dialog on a computer, a sheet on a
 * phone.
 */
const meta: Meta<typeof CoverPicker> = {
  title: 'Collection/Binders/CoverPicker',
  component: CoverPicker,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    binder: STORY_AMBER,
    myCover: null,
    readerId: 'story-reader',
    isMobile: false,
    onSaved: fn(),
    onClose: fn(),
    onGone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Amber's cover, Sunburst. */
export const Binder: Story = {};

/** A binder with no cover picked: Starry night, the first. */
export const NonePicked: Story = {args: {binder: {...STORY_AMBER, cover: null}}};

/** My collection's cover. */
export const MyCollection: Story = {args: {binder: null, myCover: 'argyle'}};

/** A phone's sheet. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};
