import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink} from 'inkweave-synergy-engine';
import {BinderSheet} from './BinderSheet';
import {SheetNumbers} from './CollectionSetPanel';
import {OWNED_PARAM, parseBinderShow, type BinderShow} from './binderCards';
import {tallyCollection, type Axis} from './collectionStats';
import {STORY_ENTRIES, STORY_POOL, STORY_SETS} from './collectionStoryData';
import {filterCards, type CardFilterOptions} from '../cards/loader';
import {CtaButton} from '../../shared/components';
import type {BrowseSortOrder} from '../../shared/constants';
import type {FilterDraft} from '../../shared/hooks/useFilterParams';

interface LiveSheetProps {
  /** Whether the sheet starts open. */
  open: boolean;
  /** What the binder shows when the sheet opens. */
  show: BinderShow;
  /** The inks the binder is filtered to when the sheet opens. */
  inks: Ink[];
}

/** The set the stories' numbers count. */
const SET = '13';

/** The filters applied, as Browse combines them for the cards it counts. */
function optionsOf({inks, types, costs, opts}: FilterDraft): CardFilterOptions {
  return {
    ...opts,
    ...(inks.length > 0 ? {ink: inks} : {}),
    ...(types.length > 0 ? {type: types} : {}),
    ...(costs.length > 0 ? {costs} : {}),
  };
}

/**
 * The Binder sheet over a phone's binder, live: the row's Filters opens it, and its Apply sets what
 * the binder shows, its sort and its filters at once, as Browse's one URL write does. The numbers
 * under Progress count the cards the filters let through, and their headlines choose what the
 * breakdowns count.
 */
function LiveSheet({open, show: startShow, inks: startInks}: LiveSheetProps) {
  const [isOpen, setOpen] = useState(open);
  const [show, setShow] = useState(startShow);
  const [sortOrder, setSortOrder] = useState<BrowseSortOrder>('newest');
  const [applied, setApplied] = useState<FilterDraft>({inks: startInks, types: [], costs: [], opts: {}});
  const [axis, setAxis] = useState<Axis>('complete');
  const options = optionsOf(applied);
  const filtered = Object.keys(options).length > 0;
  const counted = filtered ? filterCards(STORY_POOL, options) : STORY_POOL;
  return (
    <>
      <CtaButton onClick={() => setOpen(true)}>Filters</CtaButton>
      <BinderSheet
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        onApply={(draft, also) => {
          const params = new URLSearchParams();
          also.edit?.(params);
          setShow(parseBinderShow(params.get(OWNED_PARAM)));
          if (also.sortOrder) setSortOrder(also.sortOrder);
          setApplied(draft);
        }}
        show={show}
        sortOrder={sortOrder}
        progress={
          <SheetNumbers
            setCode={SET}
            sets={STORY_SETS}
            setsLoading={false}
            onSetChange={() => {}}
            show={show}
            onShowChange={() => {}}
            axis={axis}
            onAxisChange={setAxis}
            stats={tallyCollection(counted, STORY_ENTRIES, STORY_SETS)}
            filtered={filtered}
          />
        }
        inkFilters={applied.inks}
        typeFilters={applied.types}
        costFilters={applied.costs}
        filters={applied.opts}
        uniqueKeywords={['Evasive', 'Rush', 'Singer', 'Shift', 'Ward']}
        uniqueClassifications={['Floodborn', 'Dreamborn', 'Storyborn']}
        uniqueRarities={['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Enchanted']}
        sets={[]}
        showSetFilter={false}
        showArtPresets
      />
    </>
  );
}

/**
 * A phone's Binder sheet (owner, 2026-10-25, #969): the filter sheet, titled Binder, with what the
 * binder shows and its sort above the filters and the set's numbers, Progress, after them. All of
 * it waits for Apply; closing the sheet any other way drops it.
 */
const meta: Meta<typeof LiveSheet> = {
  title: 'Collection/BinderSheet',
  component: LiveSheet,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {open: true, show: 'all', inks: []},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the row's Filters opens it. */
export const Closed: Story = {args: {open: false}, globals: {viewport: {value: 'mobile1'}}};

/** Open over a binder filtered to two inks: Clear all shows, and the numbers count those inks. */
export const OpenWithFilters: Story = {args: {inks: ['Amber', 'Steel']}, globals: {viewport: {value: 'mobile1'}}};

/** Open over a binder showing Owned, which Clear all puts back to All with no filter on. */
export const OwnedOn: Story = {args: {show: 'owned'}, globals: {viewport: {value: 'mobile1'}}};
