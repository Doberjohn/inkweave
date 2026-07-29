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
  args: {onClear: fn(), onImport: fn(), onExport: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const WithCards: Story = {args: {cardCount: 56}};

// An empty deck has nothing to clear or export; only Import stays live.
export const EmptyDeck: Story = {args: {cardCount: 0}};
