import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {rarityLines, toggledIn, type FilterPicks} from '../lib/filterModel';
import {hasRaritySymbol} from '../lib/rarity';
import {COLORS, RADIUS, SPACING} from '../tokens/theme';
import {TEST_FILTER_VOCABULARY} from '../test-utils/filterVocabulary';
import {ArtPresets, ChipToggleGroup, DualInkToggle} from './FilterChips';
import {RaritySymbol} from './RaritySymbol';

const meta: Meta<typeof ChipToggleGroup> = {
  title: 'Shared/FilterChips',
  component: ChipToggleGroup,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 400, background: COLORS.surface, padding: SPACING.xl, borderRadius: RADIUS.lg}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The card types as Browse's panel and the binder's Type line show them, two picked. */
export const Types: Story = {
  args: {
    values: TEST_FILTER_VOCABULARY.allButtons.types,
    selected: ['Character', 'Song'],
    onToggle: fn(),
    ariaLabel: 'Card type filters',
    isMobile: false,
  },
};

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic', 'Special'];

const symbolOf = (rarity: string) =>
  hasRaritySymbol(rarity) ? <RaritySymbol rarity={rarity.toLowerCase()} size={24} /> : undefined;

/** The rarities as symbols, the printings on a line of their own, then the art presets under them. */
export const RaritiesWithArtPresets: Story = {
  render: () => {
    const [picked, setPicked] = useState<string[]>(['Legendary']);
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
        <ChipToggleGroup
          values={RARITIES}
          selected={picked}
          onToggle={(rarity) => setPicked(toggledIn(picked, rarity))}
          ariaLabel="Rarity filters"
          isMobile={false}
          iconFor={symbolOf}
          labelFor={TEST_FILTER_VOCABULARY.rarityLabel}
          groupOf={rarityLines(RARITIES)}
          justifyContent="space-around"
        />
        <ArtPresets
          presets={TEST_FILTER_VOCABULARY.artPresets(RARITIES)}
          picked={picked}
          onPick={setPicked}
          isMobile={false}
          style={{justifyContent: 'center'}}
        />
      </div>
    );
  },
};

/** Dual-ink cards, which a selection of one ink or a pair offers. */
export const DualInk: Story = {
  render: () => {
    const [filters, setFilters] = useState<FilterPicks>({inkMatch: 'dual'});
    return <DualInkToggle filters={filters} onFiltersChange={setFilters} isMobile={false} />;
  },
};
