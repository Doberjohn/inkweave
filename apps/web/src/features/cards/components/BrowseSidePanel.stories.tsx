import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BrowseSidePanel, DockedPanelsRow, DockedSetPanel} from './BrowseSidePanel';
import {BrowseToolbar} from './BrowseToolbar';
import {BINDER_SORT_OPTIONS, type BinderShow} from '../../collection/binderCards';
import {CollectionBinderSection} from '../../collection/CollectionBinderSection';
import {CollectionModeSwitch} from '../../collection/CollectionModeSwitch';
import {CollectionSetBody} from '../../collection/CollectionSetPanel';
import {STORY_ENTRIES, STORY_POOL, STORY_SETS, STORY_STATS} from '../../collection/collectionStoryData';
import {COLORS, type BrowseSortOrder} from '../../../shared/constants';

/**
 * Browse's docked side panels (desktop): the filters on the left, applied as you click,
 * and in collection mode the set panel on the right, under the Collection button.
 */
/** What the panels pass for set switching and the binder view, in the stories that are not live. */
const panelControls = {setCode: '13', sets: STORY_SETS, setsLoading: false, onSetChange: fn(), show: 'all' as const, onShowChange: fn()};

const meta: Meta<typeof BrowseSidePanel> = {
  title: 'Cards/BrowseSidePanel',
  component: BrowseSidePanel,
  tags: ['autodocs'],
  decorators: [
    (Story, {name}) => (
      <MemoryRouter>
        {/* The composed page brings its own frame; a lone panel gets one its height can fill. */}
        {name === 'Collection Mode Page' ? (
          <Story />
        ) : (
          <div style={{height: 760, padding: 16, background: COLORS.background, display: 'flex'}}>
            <Story />
          </div>
        )}
      </MemoryRouter>
    ),
  ],
  args: {
    filterProps: {
      inkFilters: [],
      typeFilters: [],
      costFilters: [],
      filters: {},
      uniqueKeywords: ['Evasive', 'Rush', 'Singer', 'Shift', 'Ward'],
      uniqueClassifications: ['Floodborn', 'Dreamborn', 'Storyborn'],
      uniqueRarities: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'],
      sets: [
        {code: '9', name: 'Fabled', number: 9},
        {code: '10', name: 'Whispers in the Well', number: 10},
      ],
      // Browse offers the art presets in both modes.
      showArtPresets: true,
      onToggleInk: fn(),
      onToggleType: fn(),
      onToggleCost: fn(),
      onFiltersChange: fn(),
    },
    activeFilterCount: 0,
    onClearFilters: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The filters panel, nothing active. */
export const Filters: Story = {};

/** With filters active: the selections show, and "Clear all" appears. */
export const WithActiveFilters: Story = {
  args: {
    filterProps: {
      ...meta.args!.filterProps!,
      inkFilters: ['Amber'],
      costFilters: [3, 4],
      filters: {inkwell: 'inkable'},
    },
    activeFilterCount: 3,
  },
};

/** Collection mode's collection panel, in the filters panel's surface and width. */
export const SetPanel: Story = {
  render: () => (
    <DockedSetPanel>
      <CollectionSetBody {...panelControls} stats={STORY_STATS} />
    </DockedSetPanel>
  ),
};

/** Whether the fixture holds a card: what the binder view asks. */
const owns = (cardId: string) => {
  const held = STORY_ENTRIES[cardId];
  return held !== undefined && held.normal + held.foil > 0;
};

/**
 * The composed page, live as on the page: the sort orders the binder's pockets, a set row
 * opens that set, and All / Owned / Missing narrow the binder as `browseView` does.
 */
function CollectionModeDemo(args: React.ComponentProps<typeof BrowseSidePanel>) {
  const [sortOrder, setSortOrder] = useState<BrowseSortOrder>('newest');
  const [setCode, setSetCode] = useState('9');
  const [show, setShow] = useState<BinderShow>('all');
  const controls = {setCode, sets: STORY_SETS, setsLoading: false, onSetChange: setSetCode, show, onShowChange: setShow};
  const shown = STORY_POOL.filter((card) => show === 'all' || owns(card.id) === (show === 'owned'));
  return (
    <div style={{height: '100vh', display: 'flex', flexDirection: 'column', background: COLORS.background}}>
      <BrowseToolbar
        onFiltersClick={fn()}
        activeFilterCount={0}
        inkFilters={[]}
        typeFilters={[]}
        costFilters={[]}
        filters={{}}
        onToggleInk={fn()}
        onToggleType={fn()}
        onToggleCost={fn()}
        onClearCosts={fn()}
        onFiltersChange={fn()}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        sortOptions={BINDER_SORT_OPTIONS}
        isMobile={false}
        searchQuery=""
        onSearchChange={fn()}
        docked={{panelOpen: true}}
        modeSwitch={<CollectionModeSwitch active onToggle={fn()} />}
      />
      <DockedPanelsRow
        // Collection mode's filters keep no Set section: the collection panel picks the set.
        left={<BrowseSidePanel {...args} filterProps={{...args.filterProps, showSetFilter: false}} />}
        right={
          <DockedSetPanel>
            <CollectionSetBody {...controls} stats={STORY_STATS} />
          </DockedSetPanel>
        }>
        <CollectionBinderSection
          {...controls}
          cards={STORY_POOL}
          matchedIds={new Set(shown.map((c) => c.id))}
          // No filters here, so the panel counts the whole pool, whatever the binder view.
          counted={STORY_POOL}
          filtered={false}
          sortOrder={sortOrder}
          entries={STORY_ENTRIES}
          isLoading={false}
          error={null}
          onRetry={fn()}
          onCardSelect={fn()}
        />
      </DockedPanelsRow>
    </div>
  );
}

/**
 * Collection mode on a desktop, composed from the page's own parts: the docked toolbar,
 * the filters panel on the left, the binder, and the set panel on the right. It fills the
 * window, which stands in for the page below its header and title: resize to compare widths.
 */
export const CollectionModePage: Story = {
  render: (args) => <CollectionModeDemo {...args} />,
};
