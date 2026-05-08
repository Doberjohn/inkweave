import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {CommunityColumn} from './CommunityColumn';
import {CardDataProvider} from '../../../shared/contexts/CardDataContext';
import {CardModalProvider} from '../../../shared/contexts/CardModalContext';

const cardA: LorcanaCard = {
  id: '1004',
  name: 'Elsa',
  fullName: 'Elsa - The Fifth Spirit',
  version: 'The Fifth Spirit',
  ink: 'Amethyst',
  type: 'Character',
  cost: 5,
  inkwell: true,
  rarity: 'Super Rare',
  set: 5,
  number: 48,
  strength: 2,
  willpower: 5,
  lore: 0,
  textSections: ['Rush', 'Evasive'],
} as unknown as LorcanaCard;

const cardB: LorcanaCard = {
  id: '1979',
  name: 'Elsa',
  fullName: 'Elsa - Spirit of Winter',
  version: 'Spirit of Winter',
  ink: 'Amethyst',
  type: 'Character',
  cost: 8,
  inkwell: false,
  rarity: 'Legendary',
  set: 9,
  number: 43,
  strength: 4,
  willpower: 6,
  lore: 0,
  textSections: ['Shift 6'],
} as unknown as LorcanaCard;

const samplePair: DetailedPairSynergy = {
  cardA,
  cardB,
  aggregateScore: 9,
  connections: [
    {
      ruleId: 'shift-targets',
      ruleName: 'Shift Targets',
      category: 'direct',
      score: 9,
      explanation: 'Free Shift. Play A early, then shift B in for 0 ink.',
    },
  ],
};

const meta = {
  title: 'Synergies/CommunityColumn',
  component: CommunityColumn,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // Real provider stack — CommunityColumn calls useNavigate + useCardModal. usePairScore
      // gracefully degrades to null when Supabase env vars are unset (Storybook), which renders
      // the empty-state body — exactly what we want to snapshot for the "no community votes yet"
      // visual.
      <MemoryRouter>
        <CardDataProvider>
          <CardModalProvider>
            <div style={{width: 420}}>
              <Story />
            </div>
          </CardModalProvider>
        </CardDataProvider>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof CommunityColumn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FullEmptyState: Story = {
  args: {pair: samplePair, engineScore: 9},
};
