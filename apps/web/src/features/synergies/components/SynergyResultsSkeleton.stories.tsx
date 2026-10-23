import type {Meta, StoryObj} from '@storybook/react-vite';
import {SynergyResultsSkeleton} from './SynergyResultsSkeleton';
import {SynergyResultsLoading} from './SynergyResults';

const meta: Meta<typeof SynergyResultsSkeleton> = {
  title: 'Features/SynergyResultsSkeleton',
  component: SynergyResultsSkeleton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The card page's synergy column while the card's synergies load: the header, toolbar and two groups of card tiles, in place of a premature \"No synergies found\".",
      },
    },
  },
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
 * The card page's results column while the card itself loads (#914), in the loaded column's
 * frame, beside where the card panel's placeholder sits.
 */
export const CardLoadingColumn: Story = {
  name: 'Card loading column',
  render: () => <SynergyResultsLoading isMobile={false} />,
};

/** On a phone the column also holds the card's block, in CardDetail's boxes, above the results. */
export const CardLoadingColumnMobile: Story = {
  name: 'Card loading column, phone',
  render: () => <SynergyResultsLoading isMobile />,
  globals: {viewport: {value: 'mobile1'}},
};

/**
 * Entered by the card's whole address, the card's block takes the lines of the name the address
 * spells (`cardNameHint`): here two, with a bar in each.
 */
export const CardLoadingColumnMobileLongName: Story = {
  name: 'Card loading column, phone, two-line name',
  render: () => <SynergyResultsLoading isMobile nameHint="Russell - Senior Wilderness Explorer" />,
  globals: {viewport: {value: 'mobile1'}},
};
