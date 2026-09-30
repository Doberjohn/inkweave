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

/** A card with an alternate printing: the pills' space is held, invisibly, where the modal puts them. */
const cardWithPrintings = {
  ...card,
  variants: [{id: '14241', rarity: 'Iconic', number: 241}],
} as LorcanaCard;

export const DesktopWithPrintings: Story = {
  args: {isMobile: false, card: cardWithPrintings},
};

export const MobileWithPrintings: Story = {
  args: {isMobile: true, card: cardWithPrintings},
  globals: {viewport: {value: 'mobile1'}},
};
