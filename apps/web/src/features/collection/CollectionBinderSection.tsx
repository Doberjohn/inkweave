import {useRef, useState} from 'react';
import type {LorcanaCard} from '../deck/types';
import type {CollectionEntries, CollectionEntry, Finish} from './collectionParser';
import {CollectionBinder, binderCardsForSet} from './CollectionBinder';
import {BinderSpread, BinderSlotSkeleton} from '../cards/components/BinderSpread';
import type {StepperVariant} from './CollectionSlotSteppers';
import {CollectionSetStats, type StatsMode} from './CollectionSetStats';
import {useContainerWidth} from '../../shared/hooks/useContainerWidth';
import {COLORS, FONT_SIZES, SPACING} from '../../shared/constants';

/**
 * Collection mode's content: pick a set, read the binder, edit what you hold.
 *
 * THE SET PICKER AND THE "X of Y owned" COUNT ARE GONE (owner, 2026-08-14),
 * along with the toolbar row that held them: the stats are being redesigned and
 * will bring their own home. Until they land the binder is PINNED TO SET 1 —
 * there is no other entry point, so nobody can reach Sets 2-13 or the Quests.
 * That is a deliberate gap, not an oversight; restoring it is one `useState` and
 * whatever control the new design puts it in.
 *
 * THE FINISH TOGGLE IS GONE (owner, 2026-08-14). It made the binder answer
 * "which normals do I have?" and forced a mode change to ask the same question
 * about foils. Two per-slot steppers show both numbers at once, so the question
 * never needs asking.
 *
 * EDITS ARE LOCAL AND UNSAVED while `?steppers=` is picking a variant. The write
 * path is genuinely unsettled: `CollectionContext` still documents itself as
 * "written ONCE per import … no debounce (there is no stream of edits to
 * coalesce)", which stepper editing invalidates — every tap would otherwise
 * rewrite the whole ~14 KB entries map to localStorage AND upsert the entire
 * Supabase row. Comparing the two affordances does not need that solved; adding
 * it to make the spike feel finished would ship a write path nobody chose.
 */

const ZERO: CollectionEntry = {normal: 0, foil: 0};

/** Where the binder starts until the stats design brings a real picker. */
export const DEFAULT_SET = '1';

const NOOP = () => {};

/** Shared by the loading and loaded branches, so the box around them matches. */
const SECTION_STYLE = {padding: `0 ${SPACING.xxl}px ${SPACING.xxl}px`, height: '100%'};

interface CollectionBinderSectionProps {
  /** The merged pool — Core plus collection. Filtered to one set here. */
  cards: LorcanaCard[];
  /** Ids passing the page's filters, from the same call Browse's grid uses. */
  matchedIds: Set<string>;
  /** Owned copies per card id, split by finish. */
  entries: CollectionEntries;
  /** True while the non-Core chunks are in flight. */
  isLoading: boolean;
  /** Set when they failed to load. */
  error: string | null;
  /** Which resting affordance an unowned slot shows. From `?steppers=`. */
  stepperVariant: StepperVariant;
  /** How the set-stats panel behaves. From `?stats=`. Spike, see the panel. */
  statsMode: StatsMode;
  /** Which set the binder shows. From `?set=`, pending the real picker. */
  setCode: string;
  onCardSelect: (card: LorcanaCard) => void;
}

export function CollectionBinderSection({
  cards,
  matchedIds,
  entries,
  isLoading,
  error,
  stepperVariant,
  statsMode,
  setCode,
  onCardSelect,
}: CollectionBinderSectionProps) {
  /** Spike-only edits, layered over `entries`. Deliberately not persisted. */
  const [edits, setEdits] = useState<CollectionEntries>({});
  const rowRef = useRef<HTMLDivElement>(null);
  const rowWidth = useContainerWidth(rowRef);

  // Both states are rendered rather than falling through to an empty binder.
  // A binder of blank slots is indistinguishable from "you own none of this
  // set", so a failed fetch would read as a fact about the collection.
  if (error !== null) {
    return (
      <p style={{padding: SPACING.xxl, color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`}}>
        {error}
      </p>
    );
  }
  // The SAME chrome, with shimmer in the pockets. A message in place of the
  // binder was a whole-layout swap — the parchment, spine, arrows and footnote
  // all appeared at once when the chunks landed. Rendering the spread either way
  // makes the arrival a change of slot contents and nothing else.
  if (isLoading) {
    return (
      <div style={SECTION_STYLE}>
        <BinderSpread
          start={0}
          renderSlot={() => <BinderSlotSkeleton />}
          onPrev={NOOP}
          onNext={NOOP}
          canPrev={false}
          canNext={false}
        />
      </div>
    );
  }

  const setCards = binderCardsForSet(cards, setCode);
  const countsFor = (cardId: string): CollectionEntry => edits[cardId] ?? entries[cardId] ?? ZERO;

  function changeCount(cardId: string, finish: Finish, next: number) {
    setEdits((prev) => {
      const current = prev[cardId] ?? entries[cardId] ?? ZERO;
      return {...prev, [cardId]: {...current, [finish]: Math.max(0, next)}};
    });
  }

  return (
    <div style={SECTION_STYLE}>
      {/* The panel and the binder share the row, so the panel's width comes
          straight out of the cards — which is the trade `?stats=` exists to let
          the owner judge against real cards rather than a mockup. */}
      <div ref={rowRef} style={{display: 'flex', gap: SPACING.md, height: '100%', minHeight: 0}}>
        <CollectionSetStats
          cards={setCards}
          entries={entries}
          setCode={setCode}
          mode={statsMode}
          containerWidth={rowWidth}
        />
        <div style={{flex: 1, minWidth: 0, height: '100%'}}>
          <CollectionBinder
            cards={setCards}
            matchedIds={matchedIds}
            countsFor={countsFor}
            onChangeCount={changeCount}
            variant={stepperVariant}
            onSelect={onCardSelect}
          />
        </div>
      </div>
    </div>
  );
}
