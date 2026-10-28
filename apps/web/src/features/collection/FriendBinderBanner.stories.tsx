import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {SPACING} from '../../shared/constants';
import {FriendBinderBanner, FriendNotSharing} from './FriendBinderBanner';

/**
 * A friend's binder's banner (#1045), above Browse's toolbar in its title's place: whose binder,
 * Read only, and the way back to your own binder, or to Browse for a reader with no collection.
 */
const meta: Meta<typeof FriendBinderBanner> = {
  title: 'Collection/FriendBinderBanner',
  component: FriendBinderBanner,
  decorators: [
    (Story) => (
      <div style={{padding: `${SPACING.xxl}px ${SPACING.xl}px`}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {
    isMobile: false,
    name: 'Ruby Hero 042',
    handle: 'ruby_hero_042',
    shown: true,
    youNeed: 33,
    back: 'yours',
    onBack: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

/** A reader with no collection of their own goes back to Browse. */
export const DesktopNoCollection: Story = {args: {youNeed: null, back: 'browse'}};

/** On a phone: two lines beside the chip, the second saying how many of their cards you need. */
export const Phone: Story = {
  args: {isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};

export const PhoneNoCollection: Story = {
  args: {isMobile: true, youNeed: null, back: 'browse'},
  globals: {viewport: {value: 'mobile1'}},
};

/** While the friend's binder loads: the handle until the name is known, and no Read only yet. */
export const Loading: Story = {args: {name: null, shown: false}};

/** A friend who doesn't share with the reader: the banner, and the line in the binder's place. */
export const NotSharing: Story = {
  args: {shown: false},
  render: (args) => (
    <>
      <FriendBinderBanner {...args} />
      <FriendNotSharing name={args.name} handle={args.handle} />
    </>
  ),
};
