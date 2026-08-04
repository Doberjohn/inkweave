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
  args: {onClear: fn(), onImport: fn(), onSave: fn(), onExport: fn(), isDirty: false},
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

// The state the bar is in for most of a build: Save reads "Save changes", so the
// unsaved cue survives a screen reader and a grayscale monitor alike.
export const UnsavedChanges: Story = {args: {cardCount: 56, isLegal: false, isDirty: true}};
