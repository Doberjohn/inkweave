import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {MobileComparisonView} from './MobileComparisonView';
import {CardDataProvider} from '../../../shared/contexts/CardDataContext';
import {CardModalProvider} from '../../../shared/contexts/CardModalContext';

const cardA: LorcanaCard = {
  id: '1234',
  name: 'Sugar Rush Speedway',
  fullName: 'Sugar Rush Speedway - Finish Line',
  version: 'Finish Line',
  ink: 'Amber',
  type: 'Location',
  cost: 2,
  inkwell: false,
  rarity: 'Legendary',
  set: 6,
  number: 35,
  willpower: 7,
  lore: 3,
  imageUrl: '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg',
  textSections: [],
} as unknown as LorcanaCard;

const cardB: LorcanaCard = {
  id: '973',
  name: 'Fix-It Felix, Jr.',
  fullName: 'Fix-It Felix, Jr. - Delighted Sightseer',
  version: 'Delighted Sightseer',
  ink: 'Amber',
  type: 'Character',
  cost: 2,
  inkwell: true,
  rarity: 'Uncommon',
  set: 5,
  number: 17,
  strength: 3,
  willpower: 3,
  lore: 1,
  imageUrl: '/card-images/en/set5/17_ddeed71f4dda35d719ac840da0c7ca6acda52796.jpg',
  textSections: [],
} as unknown as LorcanaCard;

const samplePair: DetailedPairSynergy = {
  cardA,
  cardB,
  aggregateScore: 5,
  connections: [
    {
      ruleId: 'location-at-payoff',
      ruleName: 'Locations',
      category: 'playstyle',
      score: 5,
      explanation: '{B} has location check synergy with {A}.',
    },
  ],
};

const meta = {
  title: 'Synergies/MobileComparisonView',
  component: MobileComparisonView,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // MobileComparisonView calls usePairScore (CardDataProvider OK) and the inner CommunityColumn
      // calls useNavigate + useCardModal. Wrapping in real providers — usePairScore degrades to
      // null without Supabase env, which renders the empty-state in the community tab.
      <MemoryRouter>
        <CardDataProvider>
          <CardModalProvider>
            <div style={{
              width: 360,
              height: 720,
              background: '#1a1a2e',
              border: '1px solid #333355',
              borderRadius: 18,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <Story />
            </div>
          </CardModalProvider>
        </CardDataProvider>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof MobileComparisonView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {pair: samplePair, engineScore: 5},
};
