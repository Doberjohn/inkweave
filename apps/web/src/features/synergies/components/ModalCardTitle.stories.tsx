import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS} from '../../../shared/constants';
import {ModalCardTitle} from './ModalCardTitle';

/** A real Core card (set 11, whose logo is the widest of the Core sets'). */
const thomas: LorcanaCard = {
  id: '2464',
  name: 'Thomas',
  version: 'Wide-Eyed Recruit',
  fullName: 'Thomas - Wide-Eyed Recruit',
  cost: 1,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  classifications: ['Storyborn', 'Ally'],
  keywords: [],
  strength: 0,
  willpower: 4,
  lore: 1,
  setCode: '11',
  setNumber: 1,
};

const meta = {
  title: 'Synergies/ModalCardTitle',
  component: ModalCardTitle,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 640, padding: 24, background: COLORS.surface, display: 'flex'}}>
        <Story />
      </div>
    ),
  ],
  args: {card: thomas, isMobile: false},
} satisfies Meta<typeof ModalCardTitle>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The card modal's header title on desktop: the name, then its number in a small tag and its set's logo. */
export const Desktop: Story = {};

/** Hyperia City, the reveal season's set, with a near-square logo. */
export const RevealSet: Story = {
  args: {
    card: {
      ...thomas,
      id: '14001',
      name: 'Fru Fru',
      version: 'VIP Guest',
      fullName: 'Fru Fru - VIP Guest',
      strength: 1,
      willpower: 3,
      setCode: '14',
    },
  },
};

/** Phones show the name alone: the logo would put twice as many names on two lines. */
export const Mobile: Story = {
  args: {isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};

/** A set without a logo shows the name alone. */
export const NoLogo: Story = {
  args: {card: {...thomas, setCode: '99'}},
};
