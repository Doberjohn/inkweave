import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {SPACING, SURFACE_CARD} from '../../shared/constants';
import {SharingSwitch} from './SharingSwitch';
import type {CollectionSharing} from './useCollectionSharing';

/** The switch, live: press it and it flips, as a write that lands at once would. */
function LiveSwitch(sharing: CollectionSharing) {
  const [on, setOn] = useState(sharing.on);
  const [argOn, setArgOn] = useState(sharing.on);
  if (sharing.on !== argOn) {
    setArgOn(sharing.on);
    setOn(sharing.on);
  }
  const set = (next: boolean) => {
    setOn(next);
    sharing.set(next);
  };
  return <SharingSwitch sharing={{...sharing, on, set}} />;
}

/**
 * "Let my friends see my collection" (#1045), in the Collection section of /account, framed at
 * the page's content width.
 */
const meta: Meta<typeof LiveSwitch> = {
  title: 'Collection/SharingSwitch',
  component: LiveSwitch,
  decorators: [
    (Story) => (
      <section style={{...SURFACE_CARD, padding: SPACING.xl, maxWidth: 656}}>
        <Story />
      </section>
    ),
  ],
  tags: ['autodocs'],
  args: {status: 'ready', on: false, busy: false, writeFailed: false, set: fn(), retry: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Every player's switch until they turn it on. */
export const Off: Story = {};

export const On: Story = {args: {on: true}};

/** While the saved state loads, and while a change is written: it holds still. */
export const Loading: Story = {args: {status: 'loading'}};

export const FailedRead: Story = {args: {status: 'failed'}};

/** A change that didn't land: the switch went back, and says so. */
export const FailedWrite: Story = {args: {writeFailed: true}};
