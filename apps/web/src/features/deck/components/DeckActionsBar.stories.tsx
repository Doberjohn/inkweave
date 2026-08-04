import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS} from '../../../shared/constants';
import {DeckActionsBar} from './DeckActionsBar';

const meta: Meta<typeof DeckActionsBar> = {
  title: 'Deck/DeckActionsBar',
  component: DeckActionsBar,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, width: 420, padding: 12}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onClear: fn(), onImport: fn(), onSave: fn(), onExport: fn(), saveState: 'idle', isDirty: true},
};
export default meta;
type Story = StoryObj<typeof meta>;

// The payoff state: a Core-legal deck lights the filled Duels button.
export const LegalDeck: Story = {args: {cardCount: 60, isLegal: true}};

// Mid-build. Clear is live, but Duels stays disabled until the deck is legal —
// the common case, since a deck is illegal for most of its life.
export const WithCards: Story = {args: {cardCount: 56, isLegal: false}};

// An empty deck has nothing to clear or export; only Import and Save stay live.
export const EmptyDeck: Story = {args: {cardCount: 0, isLegal: false}};

// Nothing to save: the cloud copy already matches, so Save dims rather than
// vanishing. The bar keeping its shape is the point — Clear beside it already
// teaches that a dim button means "no work to do here".
export const NothingToSave: Story = {args: {cardCount: 60, isLegal: true, isDirty: false}};

// Mid-write: Save goes inert and says why, so the pause is never mistaken for a
// dead button.
export const Saving: Story = {args: {cardCount: 56, isLegal: false, saveState: 'saving'}};

// The only surface a failed save has, now that the confirm dialog is gone. The
// full reason rides the tooltip and aria-label; the label alone must still tell
// the user the action did not happen.
export const SaveFailed: Story = {args: {cardCount: 56, isLegal: false, saveState: 'error'}};
