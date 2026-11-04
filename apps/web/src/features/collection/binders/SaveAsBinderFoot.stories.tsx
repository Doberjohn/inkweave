import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {WHOLE_COLLECTION} from '../binderCards';
import {SaveAsBinderFoot} from './SaveAsBinderFoot';

/**
 * Save as a binder, at the foot of the filters: the docked panel's (pinned to its bottom edge),
 * the filter dialog's and the Binder sheet's. A gold-outlined button, and under it what it would
 * keep. The surfaces themselves are storied with a foot: BrowseSidePanel and FilterDialog.
 */
const meta: Meta<typeof SaveAsBinderFoot> = {
  title: 'Collection/Binders/SaveAsBinderFoot',
  component: SaveAsBinderFoot,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 280, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  args: {
    offer: {scope: WHOLE_COLLECTION, rules: 'ink=Amber', line: 'Amber ink', figures: {complete: 293, master: 120, cards: 625}},
    onPress: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Amber ink over every set. */
export const Default: Story = {};

/** A long line, which wraps under the button. */
export const LongLine: Story = {
  args: {
    offer: {
      scope: '12',
      rules: 'ink=Amber&rarity=Epic&q=elsa',
      line: 'Amber ink · Epic · Name has "elsa" · The Wilds Unknown',
      figures: {complete: 3, master: 1, cards: 7},
    },
  },
};
