import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {SavedDecksModal} from '../SavedDecksModal';
import {createCard} from '../../../../shared/test-utils/factories';
import type {Deck} from '../../types';

// Mock window.confirm
vi.stubGlobal(
  'confirm',
  vi.fn(() => true),
);

const createDeck = (overrides: Partial<Deck> = {}): Deck => ({
  id: 'deck-1',
  name: 'Test Deck',
  cards: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createDefaultProps = () => ({
  decks: [] as Deck[],
  isOpen: true,
  onClose: vi.fn(),
  onLoad: vi.fn(),
  onDelete: vi.fn(),
});

describe('SavedDecksModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      const props = createDefaultProps();
      props.isOpen = false;
      const {container} = render(<SavedDecksModal {...props} />);

      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should render Saved Decks title', () => {
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('Saved Decks')).toBeInTheDocument();
    });

    it('should render close button', () => {
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('×')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no decks', () => {
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('No saved decks')).toBeInTheDocument();
      expect(screen.getByText('Save your current deck to see it here')).toBeInTheDocument();
    });
  });

  describe('deck list', () => {
    it('should render deck names', () => {
      const props = createDefaultProps();
      props.decks = [
        createDeck({id: '1', name: 'Ruby Aggro'}),
        createDeck({id: '2', name: 'Amber Control'}),
      ];
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('Ruby Aggro')).toBeInTheDocument();
      expect(screen.getByText('Amber Control')).toBeInTheDocument();
    });

    it('should render deck card counts', () => {
      const props = createDefaultProps();
      props.decks = [
        createDeck({
          id: '1',
          name: 'Full Deck',
          cards: [
            {card: createCard(), quantity: 4},
            {card: createCard({id: '2'}), quantity: 4},
          ],
        }),
      ];
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('8/60')).toBeInTheDocument();
    });

    it('should highlight complete decks (60 cards)', () => {
      const props = createDefaultProps();
      // Create a deck with 60 cards (15 unique cards x 4 copies)
      const cards = Array.from({length: 15}, (_, i) => ({
        card: createCard({id: `card-${i}`}),
        quantity: 4,
      }));
      props.decks = [createDeck({cards})];
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('60/60')).toBeInTheDocument();
    });

    it('should render ink badges', () => {
      const props = createDefaultProps();
      props.decks = [
        createDeck({
          cards: [
            {card: createCard({ink: 'Ruby'}), quantity: 2},
            {card: createCard({id: '2', ink: 'Sapphire'}), quantity: 2},
          ],
        }),
      ];
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('Ruby')).toBeInTheDocument();
      expect(screen.getByText('Sapphire')).toBeInTheDocument();
    });

    it('should format dates correctly', () => {
      const props = createDefaultProps();
      // Use a specific date for testing
      const date = new Date('2024-03-15T12:00:00Z');
      props.decks = [createDeck({updatedAt: date.getTime()})];
      render(<SavedDecksModal {...props} />);

      // The date format depends on locale, so we check that some date is rendered
      // by looking for the year which should be consistent
      expect(screen.getByText(/2024/)).toBeInTheDocument();
    });

    it('should render Load button for each deck', () => {
      const props = createDefaultProps();
      props.decks = [createDeck({id: '1'}), createDeck({id: '2'})];
      render(<SavedDecksModal {...props} />);

      const loadButtons = screen.getAllByText('Load');
      expect(loadButtons).toHaveLength(2);
    });

    it('should render Delete button for each deck', () => {
      const props = createDefaultProps();
      props.decks = [createDeck({id: '1'}), createDeck({id: '2'})];
      render(<SavedDecksModal {...props} />);

      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons).toHaveLength(2);
    });
  });

  describe('interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      await user.click(screen.getByText('×'));

      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      const {container} = render(<SavedDecksModal {...props} />);

      // Click on the backdrop (the outer div)
      const backdrop = container.firstChild as HTMLElement;
      await user.click(backdrop);

      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside modal content', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      // Click on the modal content
      await user.click(screen.getByRole('dialog'));

      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('should call onLoad when Load button is clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      props.decks = [createDeck({id: 'deck-123', name: 'My Deck'})];
      render(<SavedDecksModal {...props} />);

      await user.click(screen.getByText('Load'));

      expect(props.onLoad).toHaveBeenCalledWith('deck-123');
    });

    it('should show confirm dialog when Delete is clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      props.decks = [createDeck({id: 'deck-123', name: 'My Deck'})];
      render(<SavedDecksModal {...props} />);

      await user.click(screen.getByText('Delete'));

      expect(confirm).toHaveBeenCalledWith('Delete "My Deck"?');
    });

    it('should call onDelete when delete is confirmed', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      props.decks = [createDeck({id: 'deck-123', name: 'My Deck'})];
      vi.mocked(confirm).mockReturnValueOnce(true);
      render(<SavedDecksModal {...props} />);

      await user.click(screen.getByText('Delete'));

      expect(props.onDelete).toHaveBeenCalledWith('deck-123');
    });

    it('should not call onDelete when delete is cancelled', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      props.decks = [createDeck({id: 'deck-123', name: 'My Deck'})];
      vi.mocked(confirm).mockReturnValueOnce(false);
      render(<SavedDecksModal {...props} />);

      await user.click(screen.getByText('Delete'));

      expect(props.onDelete).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have proper dialog role and aria attributes', () => {
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'saved-decks-title');
    });

    it('should have proper heading with id for aria-labelledby', () => {
      const props = createDefaultProps();
      render(<SavedDecksModal {...props} />);

      const heading = screen.getByRole('heading', {name: 'Saved Decks'});
      expect(heading).toHaveAttribute('id', 'saved-decks-title');
    });
  });

  describe('multiple decks', () => {
    it('should handle multiple decks with different inks', () => {
      const props = createDefaultProps();
      props.decks = [
        createDeck({
          id: '1',
          name: 'Ruby Deck',
          cards: [{card: createCard({ink: 'Ruby'}), quantity: 4}],
        }),
        createDeck({
          id: '2',
          name: 'Amber Deck',
          cards: [{card: createCard({id: '2', ink: 'Amber'}), quantity: 4}],
        }),
        createDeck({
          id: '3',
          name: 'Dual Deck',
          cards: [
            {card: createCard({id: '3', ink: 'Emerald'}), quantity: 2},
            {card: createCard({id: '4', ink: 'Steel'}), quantity: 2},
          ],
        }),
      ];
      render(<SavedDecksModal {...props} />);

      expect(screen.getByText('Ruby Deck')).toBeInTheDocument();
      expect(screen.getByText('Amber Deck')).toBeInTheDocument();
      expect(screen.getByText('Dual Deck')).toBeInTheDocument();
      expect(screen.getByText('Emerald')).toBeInTheDocument();
      expect(screen.getByText('Steel')).toBeInTheDocument();
    });
  });
});
