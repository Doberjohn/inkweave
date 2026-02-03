import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi} from 'vitest';
import {DeckSynergyAnalysis} from '../DeckSynergyAnalysis';
import {CardPreviewProvider} from '../../../cards/components/CardPreviewContext';
import {createCard} from '../../../../shared/test-utils/factories';
import type {DeckSynergyAnalysis as DeckSynergyAnalysisType, DeckCardSynergy} from '../../hooks';

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
};

const createCardSynergy = (overrides: Partial<DeckCardSynergy> = {}): DeckCardSynergy => ({
  card: createCard(),
  quantity: 1,
  synergyCount: 3,
  totalStrength: 6,
  synergizingWith: [],
  ...overrides,
});

const createAnalysis = (
  overrides: Partial<DeckSynergyAnalysisType> = {},
): DeckSynergyAnalysisType => ({
  cardSynergies: [],
  keyCards: [],
  weakLinks: [],
  overallScore: 0,
  averageScore: 0,
  connectionCount: 0,
  ...overrides,
});

describe('DeckSynergyAnalysis', () => {
  describe('rendering', () => {
    it('should render nothing when cardSynergies is empty', () => {
      const {container} = renderWithProvider(
        <DeckSynergyAnalysis analysis={createAnalysis({cardSynergies: []})} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render Synergy Analysis title when there are cards', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Synergy Analysis')).toBeInTheDocument();
    });

    it('should display overall score', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        overallScore: 42,
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
    });

    it('should display connection count', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        connectionCount: 15,
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('Connections')).toBeInTheDocument();
    });

    it('should display average score', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        averageScore: 3,
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Avg/Card')).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('should render all tab buttons', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        keyCards: [createCardSynergy()],
        weakLinks: [createCardSynergy()],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      // Use getByRole to specifically target tab buttons with aria-pressed
      expect(screen.getByRole('button', {name: /Key Cards \(1\)/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /Weak Links \(1\)/})).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('should show key cards count in tab', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        keyCards: [createCardSynergy(), createCardSynergy({card: createCard({id: '2'})})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Key Cards (2)')).toBeInTheDocument();
    });

    it('should show weak links count in tab', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        weakLinks: [
          createCardSynergy({card: createCard({id: '1'})}),
          createCardSynergy({card: createCard({id: '2'})}),
          createCardSynergy({card: createCard({id: '3'})}),
        ],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Weak Links (3)')).toBeInTheDocument();
    });

    it('should switch to Key Cards tab when clicked', async () => {
      const user = userEvent.setup();
      const keyCard = createCardSynergy({
        card: createCard({name: 'Key Card Hero'}),
        synergyCount: 10,
      });
      const analysis = createAnalysis({
        cardSynergies: [keyCard],
        keyCards: [keyCard],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('Key Cards (1)'));

      expect(screen.getByText('Key Card Hero')).toBeInTheDocument();
    });

    it('should switch to Weak Links tab when clicked', async () => {
      const user = userEvent.setup();
      const weakCard = createCardSynergy({
        card: createCard({name: 'Weak Card'}),
        synergyCount: 0,
      });
      const analysis = createAnalysis({
        cardSynergies: [weakCard],
        weakLinks: [weakCard],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('Weak Links (1)'));

      expect(screen.getByText('Weak Card')).toBeInTheDocument();
    });

    it('should switch to All tab when clicked', async () => {
      const user = userEvent.setup();
      const card = createCardSynergy({card: createCard({name: 'All Cards Hero'})});
      const analysis = createAnalysis({
        cardSynergies: [card],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));

      expect(screen.getByText('All Cards Hero')).toBeInTheDocument();
    });

    it('should have aria-pressed on active tab', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      const overviewTab = screen.getByText('Overview');
      expect(overviewTab).toHaveAttribute('aria-pressed', 'true');

      await user.click(screen.getByText('All'));

      expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'true');
      expect(overviewTab).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('overview tab', () => {
    it('should show key synergy cards section', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        keyCards: [createCardSynergy({card: createCard({name: 'Synergy Hub'})})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Key Synergy Cards')).toBeInTheDocument();
      expect(screen.getByText(/Synergy Hub/)).toBeInTheDocument();
    });

    it('should show weak links section', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        weakLinks: [createCardSynergy({card: createCard({name: 'Lonely Card'}), synergyCount: 0})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Weak Links (Consider Replacing)')).toBeInTheDocument();
      expect(screen.getByText(/Lonely Card/)).toBeInTheDocument();
    });

    it('should show success message when no weak links', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        weakLinks: [],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('All cards have good synergy connections!')).toBeInTheDocument();
    });

    it('should show synergy count in key card chips', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        keyCards: [createCardSynergy({card: createCard({name: 'Hero'}), synergyCount: 8})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      expect(screen.getByText('Hero (8)')).toBeInTheDocument();
    });
  });

  describe('card list views', () => {
    it('should show empty state for key cards', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        keyCards: [],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('Key Cards (0)'));

      expect(screen.getByText('No standout synergy cards yet')).toBeInTheDocument();
    });

    it('should show empty state for weak links with encouragement', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        weakLinks: [],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('Weak Links (0)'));

      expect(screen.getByText('No weak links - great deck cohesion!')).toBeInTheDocument();
    });

    it('should show card with quantity when quantity > 1', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy({card: createCard({name: 'Elsa'}), quantity: 4})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));

      expect(screen.getByText(/x4/)).toBeInTheDocument();
    });

    it('should display synergy count and score', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy({synergyCount: 5, totalStrength: 12})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));

      expect(screen.getByText('5 synergies (score: 12)')).toBeInTheDocument();
    });

    it('should use singular "synergy" for count of 1', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy({synergyCount: 1, totalStrength: 2})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));

      expect(screen.getByText('1 synergy (score: 2)')).toBeInTheDocument();
    });
  });

  describe('expandable synergy details', () => {
    it('should expand card row to show synergy details', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [
          createCardSynergy({
            card: createCard({name: 'Test Card'}),
            synergizingWith: [
              {
                card: createCard({id: 'partner', name: 'Partner Card'}),
                strength: 'strong',
                explanation: 'Great combo together',
              },
            ],
          }),
        ],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));
      await user.click(screen.getByText('Test Card'));

      expect(screen.getByText('Synergizes with:')).toBeInTheDocument();
      expect(screen.getByText('Partner Card')).toBeInTheDocument();
      expect(screen.getByText('- Great combo together')).toBeInTheDocument();
      expect(screen.getByText('strong')).toBeInTheDocument();
    });

    it('should collapse expanded details on second click', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [
          createCardSynergy({
            card: createCard({name: 'Test Card'}),
            synergizingWith: [
              {
                card: createCard({name: 'Partner'}),
                strength: 'moderate',
                explanation: 'Works well',
              },
            ],
          }),
        ],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));
      await user.click(screen.getByText('Test Card'));
      expect(screen.getByText('Synergizes with:')).toBeInTheDocument();

      await user.click(screen.getByText('Test Card'));
      expect(screen.queryByText('Synergizes with:')).not.toBeInTheDocument();
    });

    it('should not be expandable when no synergies', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [
          createCardSynergy({
            card: createCard({name: 'Lonely Card'}),
            synergizingWith: [],
          }),
        ],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} />);

      await user.click(screen.getByText('All'));

      // The expand indicator should not be present
      expect(screen.queryByText('▶')).not.toBeInTheDocument();
    });
  });

  describe('remove card functionality', () => {
    it('should show Cut button for weak cards when onRemoveCard is provided', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        weakLinks: [createCardSynergy({card: createCard({name: 'Cut Me'})})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} onRemoveCard={vi.fn()} />);

      await user.click(screen.getByText('Weak Links (1)'));

      expect(screen.getByText('Cut')).toBeInTheDocument();
    });

    it('should call onRemoveCard when Cut is clicked', async () => {
      const user = userEvent.setup();
      const onRemoveCard = vi.fn();
      const cardToRemove = createCard({id: 'remove-me', name: 'Cut This'});
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy({card: cardToRemove})],
        weakLinks: [createCardSynergy({card: cardToRemove})],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} onRemoveCard={onRemoveCard} />);

      await user.click(screen.getByText('Weak Links (1)'));
      await user.click(screen.getByText('Cut'));

      expect(onRemoveCard).toHaveBeenCalledWith('remove-me');
    });

    it('should not show Cut button for key cards', async () => {
      const user = userEvent.setup();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
        keyCards: [createCardSynergy()],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} onRemoveCard={vi.fn()} />);

      await user.click(screen.getByText('Key Cards (1)'));

      expect(screen.queryByText('Cut')).not.toBeInTheDocument();
    });
  });

  describe('collapsible behavior', () => {
    it('should support collapsed state', () => {
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
      });
      renderWithProvider(<DeckSynergyAnalysis analysis={analysis} collapsed={true} />);

      expect(screen.getByText('Synergy Analysis')).toBeInTheDocument();
    });

    it('should call onToggleCollapse when header is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      const analysis = createAnalysis({
        cardSynergies: [createCardSynergy()],
      });
      renderWithProvider(
        <DeckSynergyAnalysis analysis={analysis} onToggleCollapse={onToggle} />,
      );

      await user.click(screen.getByText('Synergy Analysis'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
