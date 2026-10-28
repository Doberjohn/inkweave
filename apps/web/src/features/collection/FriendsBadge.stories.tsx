import type {ReactNode} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS, SPACING} from '../../shared/constants';
import {FriendsBadge} from './FriendsBadge';

/**
 * A binder pocket's friends badge: at its top right, how many sharing friends hold the
 * card in a finish you lack. It opens Friends who have it. Drawn for a 130px pocket and zoomed
 * with a smaller one, as the copies stripe is. Each story draws it on a plain pocket of the
 * width a pocket has there; judge it over real art in the running app's binder.
 */
const meta: Meta<typeof FriendsBadge> = {
  title: 'Collection/FriendsBadge',
  component: FriendsBadge,
  tags: ['autodocs'],
  args: {count: 11, label: '11 friends have it', gold: false, onPress: fn()},
  decorators: [(Story, {parameters}) => <Pocket width={parameters.pocket ?? DESKTOP_POCKET}>
      <Story />
    </Pocket>],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A pocket's width on a 1440px screen's spread. */
const DESKTOP_POCKET = 80;
/** A pocket's width on a phone's lone page, as measured at 393px. */
const PHONE_POCKET = 90;

/** A plain pocket, the card's shape, where the badge lies in its layer as `CollectionBinder` gives it. */
function Pocket({width, children}: {width: number; children: ReactNode}) {
  return (
    <div style={{padding: SPACING.xl}}>
      <div style={{position: 'relative', width, aspectRatio: '5 / 7', background: COLORS.surfaceRaised}}>
        <div style={{position: 'absolute', inset: 0}}>{children}</div>
      </div>
    </div>
  );
}

/** Two digits on a 1440px screen's pocket. */
export const Desktop: Story = {};

/** Every copy on offer is a foil: brushed gold, as the copies stripe marks a foil. */
export const DesktopFoilOnly: Story = {args: {count: 6, label: '6 friends have the foil', gold: true}};

export const DesktopOneDigit: Story = {args: {count: 2, label: '2 friends have it'}};

export const Phone: Story = {
  args: {count: 12, label: '12 friends have it'},
  parameters: {pocket: PHONE_POCKET},
  globals: {viewport: {value: 'mobile1'}},
};

export const PhoneFoilOnly: Story = {...Phone, args: {count: 1, label: '1 friend has the foil', gold: true}};

/** The size it is drawn at: a 130px pocket or wider. */
export const FullSize: Story = {parameters: {pocket: 130}};
