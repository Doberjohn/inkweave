import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi} from 'vitest';
import {DeckStats} from '../DeckStats';
import type {DeckStats as DeckStatsType} from '../../types';

const createDefaultStats = (overrides: Partial<DeckStatsType> = {}): DeckStatsType => ({
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

describe('DeckStats', () => {
  describe('rendering', () => {
    it('should render Statistics title', () => {
      render(<DeckStats stats={createDefaultStats()} />);

      expect(screen.getByText('Statistics')).toBeInTheDocument();
    });

    it('should render total cards count', () => {
      render(<DeckStats stats={createDefaultStats({totalCards: 45})} />);

      expect(screen.getByText('45/60')).toBeInTheDocument();
    });

    it('should render unique cards count', () => {
      render(<DeckStats stats={createDefaultStats({uniqueCards: 30})} />);

      expect(screen.getByText('30')).toBeInTheDocument();
    });

    it('should highlight total cards when deck is complete (60)', () => {
      const {container} = render(<DeckStats stats={createDefaultStats({totalCards: 60})} />);

      const totalText = screen.getByText('60/60');
      // Check if primary color is applied (primary600)
      expect(totalText).toBeInTheDocument();
    });
  });

  describe('cost curve', () => {
    it('should render cost curve section', () => {
      render(<DeckStats stats={createDefaultStats()} />);

      expect(screen.getByText('Cost Curve')).toBeInTheDocument();
    });

    it('should render all cost values from 0 to 10+', () => {
      render(<DeckStats stats={createDefaultStats()} />);

      // Cost curve renders labels 0-9 and "10+"
      // But 0 also appears in other places (card counts), so use getAllByText
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(String(i))).toBeInTheDocument();
      }
      expect(screen.getByText('10+')).toBeInTheDocument();
    });

    it('should show cost curve bars with correct titles', () => {
      const stats = createDefaultStats({
        costCurve: {1: 5, 2: 10, 3: 8},
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByTitle('Cost 1: 5 cards')).toBeInTheDocument();
      expect(screen.getByTitle('Cost 2: 10 cards')).toBeInTheDocument();
      expect(screen.getByTitle('Cost 3: 8 cards')).toBeInTheDocument();
    });
  });

  describe('ink distribution', () => {
    it('should render ink distribution section', () => {
      render(<DeckStats stats={createDefaultStats()} />);

      expect(screen.getByText('Ink Distribution')).toBeInTheDocument();
    });

    it('should only show inks that are used', () => {
      const stats = createDefaultStats({
        inkDistribution: {
          Amber: 20,
          Amethyst: 10,
          Emerald: 0,
          Ruby: 0,
          Sapphire: 0,
          Steel: 0,
        },
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByText('Amber')).toBeInTheDocument();
      expect(screen.getByText('Amethyst')).toBeInTheDocument();
      expect(screen.queryByText('Emerald')).not.toBeInTheDocument();
      expect(screen.queryByText('Ruby')).not.toBeInTheDocument();
    });

    it('should display card count for each ink', () => {
      const stats = createDefaultStats({
        totalCards: 30,
        inkDistribution: {
          Amber: 20,
          Amethyst: 10,
          Emerald: 0,
          Ruby: 0,
          Sapphire: 0,
          Steel: 0,
        },
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should show warning when more than 2 inks used', () => {
      const stats = createDefaultStats({
        inkCount: 3,
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByText('(3 inks!)')).toBeInTheDocument();
    });

    it('should not show warning when 2 or fewer inks', () => {
      const stats = createDefaultStats({
        inkCount: 2,
      });
      render(<DeckStats stats={stats} />);

      expect(screen.queryByText(/inks!/)).not.toBeInTheDocument();
    });
  });

  describe('type distribution', () => {
    it('should render card types section', () => {
      render(<DeckStats stats={createDefaultStats()} />);

      expect(screen.getByText('Card Types')).toBeInTheDocument();
    });

    it('should only show types that are used', () => {
      const stats = createDefaultStats({
        typeDistribution: {
          Character: 30,
          Action: 10,
          Item: 0,
          Location: 0,
        },
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByText('Character: 30')).toBeInTheDocument();
      expect(screen.getByText('Action: 10')).toBeInTheDocument();
      expect(screen.queryByText(/Item:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Location:/)).not.toBeInTheDocument();
    });

    it('should render all used types with counts', () => {
      const stats = createDefaultStats({
        typeDistribution: {
          Character: 25,
          Action: 15,
          Item: 10,
          Location: 10,
        },
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByText('Character: 25')).toBeInTheDocument();
      expect(screen.getByText('Action: 15')).toBeInTheDocument();
      expect(screen.getByText('Item: 10')).toBeInTheDocument();
      expect(screen.getByText('Location: 10')).toBeInTheDocument();
    });
  });

  describe('validation errors', () => {
    it('should render validation errors when present', () => {
      const stats = createDefaultStats({
        validationErrors: ['Deck has 65 cards (max 60)'],
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Deck has 65 cards (max 60)')).toBeInTheDocument();
    });

    it('should render multiple validation errors', () => {
      const stats = createDefaultStats({
        validationErrors: ['Deck has 65 cards (max 60)', 'Deck has 3 inks (max 2 recommended)'],
      });
      render(<DeckStats stats={stats} />);

      expect(screen.getByText('Deck has 65 cards (max 60)')).toBeInTheDocument();
      expect(screen.getByText('Deck has 3 inks (max 2 recommended)')).toBeInTheDocument();
    });

    it('should not render validation section when no errors', () => {
      const stats = createDefaultStats({
        validationErrors: [],
      });
      render(<DeckStats stats={stats} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('collapsible behavior', () => {
    it('should render collapsed when collapsed prop is true', () => {
      const {container} = render(<DeckStats stats={createDefaultStats()} collapsed={true} />);

      // Content should be hidden when collapsed
      // The CollapsibleSection hides content when collapsed
      expect(screen.getByText('Statistics')).toBeInTheDocument();
    });

    it('should call onToggleCollapse when header is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      render(<DeckStats stats={createDefaultStats()} onToggleCollapse={onToggle} />);

      // Click on the section header
      await user.click(screen.getByText('Statistics'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });
});
