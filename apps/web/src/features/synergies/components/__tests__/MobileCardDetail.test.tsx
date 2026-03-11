import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MobileCardDetail} from '../MobileCardDetail';
import type {LorcanaCard} from '../../../cards';
import type {SynergyGroup} from '../../types';

// Mock SynergyGroup to avoid deep render
vi.mock('../SynergyGroup', () => ({
  SynergyGroup: ({group}: {group: SynergyGroup}) => (
    <div data-testid="synergy-group">{group.label}</div>
  ),
}));

vi.mock('../../../shared/components', () => ({
  CardImage: ({alt}: {alt: string}) => <img alt={alt} />,
  CardLightbox: () => null,
  CardTextBlock: ({card}: {card: LorcanaCard}) => <span>{card.text}</span>,
}));

const mockCard: LorcanaCard = {
  id: 'elsa-snow-queen',
  fullName: 'Elsa — Snow Queen',
  name: 'Elsa',
  version: 'Snow Queen',
  type: 'Character',
  ink: 'Sapphire',
  cost: 5,
  strength: 3,
  willpower: 5,
  lore: 5,
  inkwell: true,
  keywords: ['Evasive', 'Singer 4'],
  text: "Freeze — Exert: Chosen opposing character can't ready next turn.",
  imageUrl: 'https://example.com/elsa.png',
  set: {code: '1', name: 'The First Chapter', number: 1},
  rarity: 'Super Rare',
  classifications: ['Queen', 'Sorcerer'],
  number: 42,
} as LorcanaCard;

const mockSynergies: SynergyGroup[] = [
  {
    groupKey: 'exert-synergies',
    category: 'playstyle',
    label: 'Exert Synergies',
    description: 'Cards that work together through exert mechanics',
    synergies: Array.from({length: 8}, (_, i) => ({
      card: {...mockCard, id: `exert-${i}`},
      score: 7,
      explanation: 'Exert synergy',
    })),
  },
  {
    groupKey: 'singer-songs',
    category: 'direct',
    label: 'Singer + Songs',
    description: 'Singer keyword plays Songs at reduced cost',
    synergies: Array.from({length: 4}, (_, i) => ({
      card: {...mockCard, id: `singer-${i}`},
      score: 5,
      explanation: 'Singer synergy',
    })),
  },
];

describe('MobileCardDetail', () => {
  const defaultProps = {
    card: mockCard,
    synergies: mockSynergies,
    totalSynergyCount: 12,
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the card name as h1', () => {
    render(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Elsa');
  });

  it('should render card version', () => {
    render(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText('Snow Queen')).toBeInTheDocument();
  });

  it('should render ability text', () => {
    render(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText(/Freeze.*Exert.*opposing character/)).toBeInTheDocument();
  });

  it('should render synergy section divider with heading', () => {
    render(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('Synergies');
  });

  it('should render group filter chips', () => {
    render(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByRole('button', {name: 'All'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Exert Synergies'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Singer + Songs'})).toBeTruthy();
  });

  it('should render inline synergy groups', () => {
    render(<MobileCardDetail {...defaultProps} />);
    const groups = screen.getAllByTestId('synergy-group');
    expect(groups).toHaveLength(2);
  });

  it('should filter groups when chip is clicked', () => {
    render(<MobileCardDetail {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', {name: 'Exert Synergies'}));
    const groups = screen.getAllByTestId('synergy-group');
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveTextContent('Exert Synergies');
  });

  it('should show "no synergies" message when count is 0', () => {
    render(<MobileCardDetail {...defaultProps} synergies={[]} totalSynergyCount={0} />);
    expect(screen.getByText(/no synergies found/i)).toBeInTheDocument();
  });

  it('should call onBack when header button is clicked', () => {
    const onBack = vi.fn();
    render(<MobileCardDetail {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', {name: /back to home/i}));
    expect(onBack).toHaveBeenCalled();
  });

  it('should render header with INKWEAVE text', () => {
    render(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByRole('button', {name: /back to home/i})).toHaveTextContent(/INKWEAVE/);
  });
});
