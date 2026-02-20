import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {MobileCardDetail} from '../MobileCardDetail';
import type {LorcanaCard} from '../../../cards';
import type {GroupedSynergies} from '../../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {...actual, useNavigate: () => mockNavigate};
});

const mockCard: LorcanaCard = {
  id: 'elsa-snow-queen',
  fullName: 'Elsa \u2014 Snow Queen',
  name: 'Elsa',
  subtitle: 'Snow Queen',
  type: 'Character',
  ink: 'Sapphire',
  cost: 5,
  strength: 3,
  willpower: 5,
  lore: 5,
  inkwell: true,
  keywords: ['Evasive', 'Singer 4'],
  text: "Freeze \u2014 Exert: Chosen opposing character can't ready next turn.",
  imageUrl: 'https://example.com/elsa.png',
  set: {code: '1', name: 'The First Chapter', number: 1},
  rarity: 'Super Rare',
  classifications: ['Queen', 'Sorcerer'],
  number: 42,
};

const mockSynergies: GroupedSynergies[] = [
  {
    type: 'mechanic',
    label: 'Exert Synergies',
    synergies: Array.from({length: 8}, (_, i) => ({
      card: {...mockCard, id: `exert-${i}`},
      strength: 'strong' as const,
      explanation: 'Exert synergy',
    })),
  },
  {
    type: 'keyword',
    label: 'Singer + Songs',
    synergies: Array.from({length: 4}, (_, i) => ({
      card: {...mockCard, id: `singer-${i}`},
      strength: 'moderate' as const,
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

  function renderWithRouter(ui: React.ReactElement) {
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  }

  it('should render the card name', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText('Elsa \u2014 Snow Queen')).toBeInTheDocument();
  });

  it('should render keyword badges', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText('Evasive')).toBeInTheDocument();
    expect(screen.getByText('Singer 4')).toBeInTheDocument();
  });

  it('should render ability text', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText(/Freeze.*Exert.*opposing character/)).toBeInTheDocument();
  });

  it('should render synergy breakdown rows', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText('SYNERGY BREAKDOWN')).toBeInTheDocument();
    expect(screen.getByText('Exert Synergies')).toBeInTheDocument();
    expect(screen.getByText('Singer + Songs')).toBeInTheDocument();
  });

  it('should render strength badges with correct labels', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText('strong')).toBeInTheDocument();
    expect(screen.getByText('moderate')).toBeInTheDocument();
  });

  it('should render synergy count circles', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should render gold CTA button with total count', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByRole('button', {name: /view all 12 synergies/i})).toBeInTheDocument();
  });

  it('should navigate to synergies route when CTA is clicked', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', {name: /view all 12 synergies/i}));
    expect(mockNavigate).toHaveBeenCalledWith('/card/elsa-snow-queen/synergies');
  });

  it('should show "no synergies" message when count is 0', () => {
    renderWithRouter(
      <MobileCardDetail {...defaultProps} synergies={[]} totalSynergyCount={0} />,
    );
    expect(screen.getByText(/no synergies found/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /view all/i})).not.toBeInTheDocument();
  });

  it('should call onBack when header button is clicked', () => {
    const onBack = vi.fn();
    renderWithRouter(<MobileCardDetail {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', {name: /back to home/i}));
    expect(onBack).toHaveBeenCalled();
  });

  it('should render header with INKWEAVE text', () => {
    renderWithRouter(<MobileCardDetail {...defaultProps} />);
    expect(screen.getByRole('button', {name: /back to home/i})).toHaveTextContent(/INKWEAVE/);
  });
});
