import {render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {DeckPanel} from '../DeckPanel';
import {CardPreviewProvider} from '../../../cards/components/CardPreviewContext';
import {createCard} from '../../../../shared/test-utils/factories';
import type {Deck, DeckStats} from '../../types';
import type {DeckSuggestion, DeckSynergyAnalysis} from '../../hooks';

// Wrapper component for tests that need CardPreviewProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
};

// Mock window.confirm
vi.stubGlobal(
  'confirm',
  vi.fn(() => true),
);

// Mock window.alert
vi.stubGlobal('alert', vi.fn());

const createEmptyDeck = (overrides: Partial<Deck> = {}): Deck => ({
  id: 'test-deck-1',
  name: 'Test Deck',
  cards: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createEmptyStats = (overrides: Partial<DeckStats> = {}): DeckStats => ({
  totalCards: 0,
  uniqueCards: 0,
  inkDistribution: {
    Amber: 0,
    Amethyst: 0,
    Emerald: 0,
    Ruby: 0,
    Sapphire: 0,
    Steel: 0,
  },
  costCurve: {},
  typeDistribution: {
    Character: 0,
    Action: 0,
    Item: 0,
    Location: 0,
  },
  inkCount: 0,
  isValid: false,
  validationErrors: [],
  ...overrides,
});

const createEmptySynergyAnalysis = (): DeckSynergyAnalysis => ({
  cardSynergies: [],
  keyCards: [],
  weakLinks: [],
  overallScore: 0,
  averageScore: 0,
  connectionCount: 0,
});

const createDefaultProps = () => ({
  deck: createEmptyDeck(),
  deckStats: createEmptyStats(),
  suggestions: [] as DeckSuggestion[],
  synergyAnalysis: createEmptySynergyAnalysis(),
  onAddCard: vi.fn(),
  onRemoveCard: vi.fn(),
  onRemoveAllCopies: vi.fn(),
  onSetQuantity: vi.fn(),
  onClearDeck: vi.fn(),
  onRenameDeck: vi.fn(),
  onNewDeck: vi.fn(),
  onSaveDeck: vi.fn(),
  onLoadDeck: vi.fn(),
  onDeleteSavedDeck: vi.fn(),
  getSavedDecks: vi.fn(() => []),
  onExportDeck: vi.fn(() => '{}'),
  onImportDeck: vi.fn(() => true),
});

describe('DeckPanel', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('rendering', () => {
    it('should render deck name', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} deck={createEmptyDeck({name: 'My Deck'})} />);

      expect(screen.getByText('My Deck')).toBeInTheDocument();
    });

    it('should render card count badge', () => {
      const props = createDefaultProps();
      const {container} = render(
        <DeckPanel {...props} deckStats={createEmptyStats({totalCards: 45})} />,
      );

      // Find the badge in the header area
      const badges = container.querySelectorAll('span');
      const badge = Array.from(badges).find((b) => b.textContent === '45/60');
      expect(badge).toBeTruthy();
    });

    it('should render empty state when no cards', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      expect(screen.getByText('No cards in deck')).toBeInTheDocument();
      expect(screen.getByText('Click the + button on cards to add them')).toBeInTheDocument();
    });

    it('should render cards when deck has cards', () => {
      const props = createDefaultProps();
      const deck = createEmptyDeck({
        cards: [
          {card: createCard({id: 'card-1', name: 'Test Card 1'}), quantity: 2},
          {card: createCard({id: 'card-2', name: 'Test Card 2'}), quantity: 1},
        ],
      });
      const stats = createEmptyStats({totalCards: 3, uniqueCards: 2});

      renderWithProvider(<DeckPanel {...props} deck={deck} deckStats={stats} />);

      expect(screen.getByText('Test Card 1')).toBeInTheDocument();
      expect(screen.getByText('Test Card 2')).toBeInTheDocument();
    });

    it('should show ink warning when more than 2 inks', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} deckStats={createEmptyStats({inkCount: 3})} />);

      expect(screen.getByRole('alert')).toHaveTextContent('3 ink colors (2 recommended)');
    });

    it('should not show ink warning when 2 or fewer inks', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} deckStats={createEmptyStats({inkCount: 2})} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should render all action buttons', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      expect(screen.getByRole('button', {name: /new/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /load/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /export/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /import/i})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /clear/i})).toBeInTheDocument();
    });

    it('should call onNewDeck when New button is clicked', async () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      await userEvent.click(screen.getByRole('button', {name: /new/i}));

      expect(props.onNewDeck).toHaveBeenCalled();
    });

    it('should call onSaveDeck when Save button is clicked', async () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      await userEvent.click(screen.getByRole('button', {name: /save/i}));

      expect(props.onSaveDeck).toHaveBeenCalled();
    });

    it('should open load modal when Load button is clicked', async () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      await userEvent.click(screen.getByRole('button', {name: /load/i}));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should call onClearDeck when Clear button is clicked and confirmed', async () => {
      const props = createDefaultProps();
      const deck = createEmptyDeck({
        cards: [{card: createCard(), quantity: 1}],
      });

      renderWithProvider(<DeckPanel {...props} deck={deck} />);

      await userEvent.click(screen.getByRole('button', {name: /clear/i}));

      expect(confirm).toHaveBeenCalledWith('Clear all cards from deck?');
      expect(props.onClearDeck).toHaveBeenCalled();
    });

    it('should not show confirm dialog when clearing empty deck', async () => {
      const props = createDefaultProps();

      render(<DeckPanel {...props} />);

      await userEvent.click(screen.getByRole('button', {name: /clear/i}));

      expect(confirm).not.toHaveBeenCalled();
      expect(props.onClearDeck).toHaveBeenCalled();
    });
  });

  describe('deck name editing', () => {
    it('should enter edit mode when clicking deck name', async () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} deck={createEmptyDeck({name: 'Original Name'})} />);

      await userEvent.click(screen.getByText('Original Name'));

      expect(screen.getByRole('textbox')).toHaveValue('Original Name');
    });

    it('should call onRenameDeck when pressing Enter', async () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} deck={createEmptyDeck({name: 'Original Name'})} />);

      await userEvent.click(screen.getByText('Original Name'));
      await userEvent.clear(screen.getByRole('textbox'));
      await userEvent.type(screen.getByRole('textbox'), 'New Name{Enter}');

      expect(props.onRenameDeck).toHaveBeenCalledWith('New Name');
    });

    it('should cancel editing when pressing Escape', async () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} deck={createEmptyDeck({name: 'Original Name'})} />);

      await userEvent.click(screen.getByText('Original Name'));
      await userEvent.type(screen.getByRole('textbox'), 'Changed{Escape}');

      expect(props.onRenameDeck).not.toHaveBeenCalled();
      expect(screen.getByText('Original Name')).toBeInTheDocument();
    });
  });

  describe('export functionality', () => {
    it('should have an export button', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      // Verify the Export button exists
      const exportButtons = screen.getAllByTitle(/export/i);
      expect(exportButtons.length).toBeGreaterThan(0);
    });
  });

  describe('import functionality', () => {
    it('should show alert for non-JSON files', () => {
      const props = createDefaultProps();
      render(<DeckPanel {...props} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'test.txt', {type: 'text/plain'});

      fireEvent.change(fileInput, {target: {files: [file]}});

      expect(alert).toHaveBeenCalledWith('Please select a JSON file.');
    });
  });

  describe('card sorting', () => {
    it('should sort cards by cost then name', () => {
      const props = createDefaultProps();
      const deck = createEmptyDeck({
        cards: [
          {card: createCard({id: '1', name: 'Zebra', cost: 3}), quantity: 1},
          {card: createCard({id: '2', name: 'Apple', cost: 1}), quantity: 1},
          {card: createCard({id: '3', name: 'Banana', cost: 3}), quantity: 1},
          {card: createCard({id: '4', name: 'Cherry', cost: 2}), quantity: 1},
        ],
      });

      renderWithProvider(
        <DeckPanel {...props} deck={deck} deckStats={createEmptyStats({totalCards: 4})} />,
      );

      const cardNames = screen.getAllByText(/Apple|Banana|Cherry|Zebra/);
      expect(cardNames.map((el) => el.textContent)).toEqual(['Apple', 'Cherry', 'Banana', 'Zebra']);
    });
  });

  describe('mobile mode', () => {
    it('should adjust layout for mobile', () => {
      const props = createDefaultProps();
      const {container} = render(<DeckPanel {...props} isMobile={true} />);

      const panel = container.firstChild as HTMLElement;
      expect(panel.style.width).toBe('100%');
    });
  });
});
