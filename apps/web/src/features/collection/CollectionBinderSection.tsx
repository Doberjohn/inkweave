import {useState} from 'react';
import type {LorcanaCard} from '../deck/types';
import type {CollectionEntries} from './collectionParser';
import {CollectionBinder, binderCardsForSet, type Finish} from './CollectionBinder';
import {TabList} from '../../shared/components';
import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../shared/constants';

/**
 * Collection mode's content: pick a set, pick a finish, read the binder.
 *
 * Set and finish live HERE rather than in the URL, unlike the filters. Filters
 * are shareable state — a link to "Amber, cost 1" means something to someone
 * else. Which page of which binder you happen to be on is not; it is where you
 * are standing, and putting it in the URL would push a history entry on every
 * page turn and hijack the back button.
 */

/** Every set with a binder, newest first — the sets people are opening now. */
const SETS = ['13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', 'Q1', 'Q2'];

const FINISHES = [
  {id: 'normal' as const, label: 'Normal'},
  {id: 'foil' as const, label: 'Foil'},
];

const selectStyle = {
  background: COLORS.surfaceAlt,
  color: COLORS.text,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.lg}px`,
  padding: `${SPACING.sm}px ${SPACING.md}px`,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.sm}px`,
};

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
  onCardSelect: (card: LorcanaCard) => void;
}

export function CollectionBinderSection({
  cards,
  matchedIds,
  entries,
  isLoading,
  error,
  onCardSelect,
}: CollectionBinderSectionProps) {
  const [setCode, setSetCode] = useState('1');
  const [finish, setFinish] = useState<Finish>('normal');

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
  if (isLoading) {
    return (
      <p style={{padding: SPACING.xxl, color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`}}>
        Loading your collection…
      </p>
    );
  }

  const setCards = binderCardsForSet(cards, setCode);
  // Per-finish, so the two views answer different questions: "which do I have?"
  // versus "which have I got foiled?". `ownedCount` from the context folds the
  // two together and would make every foil page identical to its normal one.
  const ownedCount = (cardId: string) => entries[cardId]?.[finish] ?? 0;
  const owned = setCards.filter((card) => ownedCount(card.id) > 0).length;

  return (
    <div style={{padding: `0 ${SPACING.xxl}px ${SPACING.xxl}px`, overflowY: 'auto', height: '100%'}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.lg,
          flexWrap: 'wrap',
          padding: `${SPACING.md}px 0`,
        }}>
        <label style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
          <span style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`}}>Set</span>
          <select
            value={setCode}
            onChange={(e) => setSetCode(e.target.value)}
            style={selectStyle}
            aria-label="Binder set">
            {SETS.map((code) => (
              <option key={code} value={code}>
                {code.startsWith('Q') ? `Quest ${code.slice(1)}` : `Set ${code}`}
              </option>
            ))}
          </select>
        </label>

        <div style={{minWidth: 200}}>
          <TabList tabs={FINISHES} active={finish} onChange={setFinish} ariaLabel="Card finish" />
        </div>

        <span style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, marginLeft: 'auto'}}>
          {`${owned} of ${setCards.length} owned`}
        </span>
      </div>

      <CollectionBinder
        cards={setCards}
        matchedIds={matchedIds}
        ownedCount={ownedCount}
        finish={finish}
        onSelect={onCardSelect}
      />
    </div>
  );
}
