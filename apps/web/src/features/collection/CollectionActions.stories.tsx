import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {CollectionActions} from './CollectionActions';

const meta: Meta<typeof CollectionActions> = {
  title: 'Collection/CollectionActions',
  component: CollectionActions,
  decorators: [
    (Story) => (
      // The toolbar's far end: the menu opens under the gear, lined up with its right edge.
      <div style={{display: 'flex', justifyContent: 'flex-end', padding: 16, minHeight: 160}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onImport: fn(), checking: false},
};

export default meta;
type Story = StoryObj<typeof meta>;

const openMenu: Story['play'] = async ({canvasElement}) => {
  await userEvent.click(within(canvasElement).getByRole('button', {name: 'Collection actions'}));
};

/** The gear after Collection (owner, 2026-10-20): the toolbar's ghost outline, closed. */
export const Closed: Story = {};

/** Open: the gear filled, as a toolbar toggle is while its area is open, and its one action. */
export const Open: Story = {play: openMenu};

/** While the account is checked and this browser holds no collection: the import waits, as Account's does. */
export const Checking: Story = {args: {checking: true}, play: openMenu};
