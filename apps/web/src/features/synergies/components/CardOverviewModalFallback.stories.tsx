import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardOverviewModalFallback} from './CardOverviewModalFallback';

const card: LorcanaCard = {
  id: '1939',
  name: 'Woody',
  version: 'Jungle Guide',
  fullName: 'Woody - Jungle Guide',
  cost: 5,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  classifications: ['Storyborn', 'Hero'],
  keywords: [],
  text: '',
  textSections: [],
  strength: 3,
  willpower: 5,
  lore: 2,
  setCode: '10',
  setNumber: 1,
} as unknown as LorcanaCard;

const meta: Meta<typeof CardOverviewModalFallback> = {
  title: 'Features/CardOverviewModalFallback',
  component: CardOverviewModalFallback,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Stands in for CardOverviewModal while its chunk downloads (issue 640): the same scrim, panel and loading layout, so the first tap on a card answers at once.',
      },
    },
  },
  args: {card, onClose: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {isMobile: false},
};

export const Mobile: Story = {
  args: {isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};

/**
 * Browse holds the row under the card for its copies stripe (`useHoldCopiesRow`): the placeholder
 * holds it too, invisibly, so the window takes over with nothing moving.
 */
export const DesktopWithCopiesRow: Story = {
  args: {isMobile: false, copiesRow: true},
};

export const MobileWithCopiesRow: Story = {
  args: {isMobile: true, copiesRow: true},
  globals: {viewport: {value: 'mobile1'}},
};

/**
 * A shared compare link while the card list loads (#913): the window's frame with no card yet,
 * which the comparison then takes over without a second entrance.
 */
export const ComparisonLoading: Story = {
  args: {isMobile: false, card: undefined},
};

export const ComparisonLoadingMobile: Story = {
  args: {isMobile: true, card: undefined},
  globals: {viewport: {value: 'mobile1'}},
};
