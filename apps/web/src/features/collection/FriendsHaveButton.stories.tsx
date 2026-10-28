import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {SPACING} from '../../shared/constants';
import {FriendsHaveButton, FriendsHaveFailed} from './FriendsHaveButton';

/**
 * The card window's count of the friends who have the card (#1055): a chip beside the set's logo
 * on a computer, a line under the copies on a phone. It opens Friends who have it.
 */
const meta: Meta<typeof FriendsHaveButton> = {
  title: 'Collection/FriendsHaveButton',
  component: FriendsHaveButton,
  decorators: [
    (Story) => (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: SPACING.xl}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {isMobile: false, label: '11 friends have it', gold: false, onPress: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

/** Every copy on offer is a foil: brushed gold, as the copies stripe marks a foil. */
export const DesktopFoilOnly: Story = {args: {label: '3 friends have the foil', gold: true}};

export const Mobile: Story = {
  args: {isMobile: true, label: '12 friends have it'},
  decorators: [
    (Story) => (
      <div style={{display: 'flex', flexDirection: 'column', width: 320}}>
        <Story />
      </div>
    ),
  ],
  globals: {viewport: {value: 'mobile1'}},
};

export const MobileFoilOnly: Story = {...Mobile, args: {isMobile: true, label: '1 friend has the foil', gold: true}};

/** The read of friends' copies failed, on a card you lack. */
export const Failed: Story = {render: () => <FriendsHaveFailed isMobile={false} onRetry={fn()} />};
