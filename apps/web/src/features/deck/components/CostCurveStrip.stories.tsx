import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import {CostCurveStrip} from './CostCurveStrip';

const meta: Meta<typeof CostCurveStrip> = {
  title: 'Deck/CostCurveStrip',
  component: CostCurveStrip,
  decorators: [
    (Story) => (
      // Height matters: the bars size by percentage, so without a definite height
      // here the chain goes indefinite and every bar collapses onto its minHeight,
      // rendering a flat chart that hides the very proportions these stories exist
      // to show. 240 mirrors DeckPanel's STATS_ROW_HEIGHT cost-curve cell.
      <div style={{background: COLORS.surface, width: 460, height: 240, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// A textbook midrange curve peaking at 2-3: Amber loads the early curve, Emerald
// weights the top-end — the kind of ink read a monochrome bar hides.
export const Midrange: Story = {
  args: {
    costCurve: {1: 6, 2: 12, 3: 13, 4: 9, 5: 8, 6: 6, 7: 6},
    costCurveByInk: {
      1: {Amber: 4, Emerald: 2},
      2: {Amber: 7, Emerald: 5},
      3: {Amber: 6, Emerald: 7},
      4: {Amber: 5, Emerald: 4},
      5: {Amber: 3, Emerald: 5},
      6: {Amber: 2, Emerald: 4},
      7: {Amber: 2, Emerald: 4},
    },
  },
};

// Aggro: front-loaded and thin at the top, splashing Amber into a Ruby base.
export const Aggro: Story = {
  args: {
    costCurve: {1: 10, 2: 16, 3: 14, 4: 10, 5: 6, 6: 2, 7: 2},
    costCurveByInk: {
      1: {Ruby: 8, Amber: 2},
      2: {Ruby: 11, Amber: 5},
      3: {Ruby: 9, Amber: 5},
      4: {Ruby: 6, Amber: 4},
      5: {Ruby: 4, Amber: 2},
      6: {Ruby: 1, Amber: 1},
      7: {Ruby: 1, Amber: 1},
    },
  },
};

// Ramp: an inverted curve climbing into the 6-drop and "7+" payoffs.
export const Ramp: Story = {
  args: {
    costCurve: {2: 6, 3: 8, 4: 6, 5: 8, 6: 10, 7: 14},
    costCurveByInk: {
      2: {Sapphire: 4, Amethyst: 2},
      3: {Sapphire: 5, Amethyst: 3},
      4: {Sapphire: 3, Amethyst: 3},
      5: {Sapphire: 4, Amethyst: 4},
      6: {Sapphire: 6, Amethyst: 4},
      7: {Sapphire: 8, Amethyst: 6},
    },
  },
};

// A deck running 0-cost cards gets a leading "0" column; the axis stays clean otherwise.
export const WithZeroCost: Story = {
  args: {
    costCurve: {0: 2, 1: 6, 2: 12, 3: 12, 4: 8, 5: 6, 6: 6, 7: 8},
    costCurveByInk: {
      0: {Steel: 2},
      1: {Amber: 4, Steel: 2},
      2: {Amber: 8, Steel: 4},
      3: {Amber: 7, Steel: 5},
      4: {Amber: 5, Steel: 3},
      5: {Amber: 4, Steel: 2},
      6: {Amber: 4, Steel: 2},
      7: {Amber: 5, Steel: 3},
    },
  },
};

// An empty deck: the strip renders nothing (self-hides) so a fresh build stays clean.
export const Empty: Story = {args: {costCurve: {}, costCurveByInk: {}}};

// A single off-ink copy among many: the ink split's hardest read, and what the
// per-band hover tooltip is for, since a 1-of is exactly the card whose presence
// a glance at the bar will miss. Note MIN_BAND_PX does NOT bind here: at this
// chart height a lone copy is naturally ~8.5px. The floor only engages on a
// shorter chart or a busier deck (a real 60-card deck puts a 1-of at ~6.7px),
// where it is a ~1px correction rather than a rescue. It is a layout-independent
// guarantee, not a visible effect.
export const LopsidedBucket: Story = {
  args: {
    costCurve: {1: 4, 2: 9, 3: 20, 4: 6, 5: 2, 6: 2, 7: 2},
    costCurveByInk: {
      1: {Amber: 4},
      2: {Amber: 8, Emerald: 1},
      3: {Amber: 19, Emerald: 1},
      4: {Amber: 5, Emerald: 1},
      5: {Amber: 1, Emerald: 1},
      6: {Amber: 2},
      7: {Amber: 1, Emerald: 1},
    },
  },
};
