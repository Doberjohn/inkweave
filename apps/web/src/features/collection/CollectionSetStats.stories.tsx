import type {Meta, StoryObj} from '@storybook/react-vite';
import {CollectionSetStats} from './CollectionSetStats';
import type {CollectionEntries} from './collectionParser';
import {BINDER_CARDS} from '../cards/components/binderStoryCards';
import {COLORS, SPACING} from '../../shared/constants';

/**
 * DESIGN SPIKE — the set-stats panel. Unresolved; see the component's header.
 *
 * The fixture cards carry no rarity, so these stories exercise the LAYOUT (logo
 * box, headline pair, breakdown rows, rail collapse) rather than real tallies.
 * The numbers that drove every decision so far came from the owner's real
 * 2,516-card collection in the running app, not from here — this panel is
 * exactly the kind of thing a fixture flatters.
 */
const meta: Meta<typeof CollectionSetStats> = {
  title: 'Collection/CollectionSetStats',
  component: CollectionSetStats,
  decorators: [
    (Story) => (
      <div style={{height: 700, padding: SPACING.lg, background: COLORS.background, display: 'flex'}}>
        <Story />
      </div>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    cards: BINDER_CARDS,
    entries: Object.fromEntries(
      BINDER_CARDS.map((c, i) => [c.id, {normal: i % 3 === 0 ? 0 : 1, foil: i % 4 === 0 ? 1 : 0}]),
    ) as CollectionEntries,
    setCode: '1',
    mode: 'fixed',
    containerWidth: 1600,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A set with real logo art. Sets 1, 2, 12 and 13 have one; the rest do not. */
export const WithLogo: Story = {};

/** No logo on disk — the set name carries the header instead. */
export const NameFallback: Story = {
  args: {setCode: '9'},
};

/** Collapsed to the rail, the shape a narrow window gets. */
export const Rail: Story = {
  args: {mode: 'rail'},
};

/** `auto` below its threshold resolves to the rail. */
export const AutoNarrow: Story = {
  args: {mode: 'auto', containerWidth: 1200},
};
