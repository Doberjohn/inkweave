import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {MemoryRouter} from 'react-router-dom';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {CardOverviewModal} from './CardOverviewModal';
import {CardDataProvider} from '../../../shared/contexts/CardDataContext';
import {CardModalProvider} from '../../../shared/contexts/CardModalContext';

const cardA: LorcanaCard = {
  id: '1041',
  name: 'Anna',
  fullName: 'Anna - Diplomatic Queen',
  version: 'Diplomatic Queen',
  ink: 'Amber',
  type: 'Character',
  cost: 4,
  inkwell: true,
  rarity: 'Legendary',
  set: 5,
  number: 1,
  strength: 2,
  willpower: 4,
  lore: 2,
  textSections: ['Shift 4'],
} as unknown as LorcanaCard;

const annaSister: LorcanaCard = {
  id: '2',
  name: 'Anna',
  fullName: 'Anna - Soothing Sister',
  version: 'Soothing Sister',
  ink: 'Amber',
  type: 'Character',
  cost: 1,
  inkwell: true,
  rarity: 'Common',
  set: 5,
  number: 2,
  strength: 1,
  willpower: 2,
  lore: 1,
  textSections: [],
} as unknown as LorcanaCard;

const annaMystical: LorcanaCard = {
  id: '3',
  name: 'Anna',
  fullName: 'Anna - Mystical Majesty',
  version: 'Mystical Majesty',
  ink: 'Amber',
  type: 'Character',
  cost: 6,
  inkwell: false,
  rarity: 'Rare',
  set: 6,
  number: 3,
  strength: 3,
  willpower: 5,
  lore: 2,
  textSections: ['Shift 5'],
} as unknown as LorcanaCard;

const mowgli: LorcanaCard = {
  id: '4',
  name: 'Mowgli',
  fullName: 'Mowgli - Man Cub',
  version: 'Man Cub',
  ink: 'Emerald',
  type: 'Character',
  cost: 2,
  inkwell: true,
  rarity: 'Common',
  set: 5,
  number: 4,
  strength: 1,
  willpower: 2,
  lore: 1,
  textSections: [],
} as unknown as LorcanaCard;

const synergies: SynergyGroupData[] = [
  {
    groupKey: 'shift-targets',
    category: 'direct',
    label: 'Shift Targets',
    tagline: 'Characters with Shift and their valid targets',
    description: 'Cards that share a name and can Shift onto each other.',
    synergies: [
      {card: annaSister, score: 9, explanation: 'Free Shift. Play A early, then Shift B in for 0 ink.'},
      {card: annaMystical, score: 7, explanation: 'On curve, but neither card is inkable. Less flexible off-curve.'},
    ],
  },
  {
    groupKey: 'discard',
    category: 'playstyle',
    label: 'Discard',
    tagline: 'Force opponents to discard cards while you keep yours.',
    description: 'Hand-disruption playstyle pairing enablers with hand-size payoffs.',
    synergies: [
      {card: mowgli, score: 5, explanation: "Both disrupt the opponent's hand."},
    ],
  },
];

const noopGetPair = (): DetailedPairSynergy | null => null;

const samplePair: DetailedPairSynergy = {
  cardA,
  cardB: annaSister,
  aggregateScore: 9,
  connections: [
    {
      ruleId: 'shift-targets',
      ruleName: 'Shift Targets',
      category: 'direct',
      score: 9,
      explanation: 'Free Shift. Play A early, then Shift B in for 0 ink.',
    },
  ],
};

const meta = {
  title: 'Synergies/CardOverviewModal',
  component: CardOverviewModal,
  parameters: {layout: 'fullscreen'},
  args: {
    isOpen: true,
    card: cardA,
    synergies,
    onClose: fn(),
    getPairSynergies: noopGetPair,
    onEnterComparison: fn(),
    onExitComparison: fn(),
  },
} satisfies Meta<typeof CardOverviewModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  // Default mode renders only presentational children (no Router / CardModalContext deps).
};

export const WithSiblingNavigation: Story = {
  args: {
    siblingCardIds: ['a', cardA.id, 'c'],
    onGoToSibling: fn(),
  },
};

export const Mobile: Story = {
  args: {isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};

export const ComparisonMode: Story = {
  args: {initialComparison: samplePair},
  decorators: [
    // Comparison mode renders <CommunityColumn> which uses useNavigate + useCardModal +
    // usePairScore. Wrap with the real provider chain — usePairScore returns null without
    // Supabase env vars (Storybook), so the community side renders its empty-state visual.
    (Story) => (
      <MemoryRouter>
        <CardDataProvider>
          <CardModalProvider>
            <Story />
          </CardModalProvider>
        </CardDataProvider>
      </MemoryRouter>
    ),
  ],
};

export const LargeGroupShowAll: Story = {
  args: {
    synergies: [
      {
        groupKey: 'singer-songs',
        category: 'playstyle',
        label: 'Singer + Songs',
        tagline: 'A large group to exercise Show More.',
        description: 'Click More to reach the full expanded view.',
        synergies: Array.from({length: 24}, (_, i) => ({
          card: {...annaSister, id: `song-${i}`, fullName: `Song ${i} - Test`, name: `Song ${i}`},
          score: 5,
          explanation: `Synergy ${i}`,
        })),
      },
    ],
  },
  decorators: [
    // Renders a large group whose More tile a human can click (manual, no play function)
    // to reach the full ExpandedGroupView, which uses useCardDataContext() for its filter
    // toolbar — no CardModalProvider needed here (that's only for useCardModal consumers like
    // CommunityColumn in ComparisonMode).
    (Story) => (
      <MemoryRouter>
        <CardDataProvider>
          <Story />
        </CardDataProvider>
      </MemoryRouter>
    ),
  ],
};
