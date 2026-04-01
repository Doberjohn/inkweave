import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CarriesPicker} from './CarriesPicker';

const mockCardA: LorcanaCard = {
  id: 'carries-a',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  cost: 5,
  ink: 'Sapphire',
  inkwell: true,
  type: 'Character',
  setCode: '5',
  setNumber: 58,
};

const mockCardB: LorcanaCard = {
  id: 'carries-b',
  name: 'Anna',
  version: 'Brave Princess',
  fullName: 'Anna - Brave Princess',
  cost: 3,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  setCode: '5',
  setNumber: 12,
};

const meta = {
  title: 'Voting/CarriesPicker',
  component: CarriesPicker,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 500}}>
        <Story />
      </div>
    ),
  ],
  args: {
    onChange: fn(),
    cardA: mockCardA,
    cardB: mockCardB,
  },
} satisfies Meta<typeof CarriesPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: null,
  },
};

export const Selected: Story = {
  args: {
    value: 'both',
  },
};

export const Mobile: Story = {
  args: {
    value: null,
    isMobile: true,
  },
};
