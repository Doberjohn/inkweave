import type {CSSProperties, Ref} from 'react';
import {FilterContent} from 'inkweave-ui/lorcana/FilterContent';
import {FilterSection, SortSelect} from '../../../shared/components';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  FONT_WEIGHT,
  LINE_HEIGHT,
  RADIUS,
  SPACING,
  TABULAR,
} from '../../../shared/constants';
import {FILTER_VOCABULARY} from '../../cards/filterOptions';
import {smallImageUrl} from '../../cards/loader';
import {BINDER_LOOK} from '../../cards/components/binderLook';
import '../../cards/components/binder.css';
import {ALL_PROMO_SETS, WHOLE_COLLECTION, isPromoScope, isPromoSet, setLabel} from '../binderCards';
import {percentOf} from '../collectionStats';
import {CoverBar, CoverBoard} from './BinderCover';
import type {BinderDraft} from './useBinderDraft';

/** The field the window's name and Name has share: the display name dialog's. */
const FIELD: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: SPACING.sm,
  background: COLORS.surfaceAlt,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.md,
  color: COLORS.text,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.md}px`,
};

/** The Sets a binder can keep, as the set picker offers them: every set, each set, every promo set, each promo set. */
function setsOptions(sets: readonly string[], scope: string) {
  const known = sets.includes(scope) || scope === WHOLE_COLLECTION || scope === ALL_PROMO_SETS ? sets : [...sets, scope];
  const promos = known.filter(isPromoSet);
  return [
    {value: WHOLE_COLLECTION, label: 'All sets'},
    ...known.filter((set) => !isPromoSet(set)).map((set) => ({value: set, label: setLabel(set)})),
    ...(promos.length > 0 ? [{value: ALL_PROMO_SETS, label: 'Promos'}] : []),
    ...promos.map((set) => ({value: set, label: setLabel(set)})),
  ];
}

interface RulesProps {
  draft: BinderDraft;
  isMobile: boolean;
  nameRef?: Ref<HTMLInputElement>;
}

/**
 * The window's rules, in one column: Name and Sets, then the filter panel's own sections (Ink
 * with its dual-ink switch, Inkwell, Ink Cost, Rarity with its art presets, Type, Classification,
 * Keyword), then Name has, which matches names as the search box does.
 */
export function RulesFields({draft, isMobile, nameRef}: RulesProps) {
  const {filters, options} = draft;
  return (
    <>
      <FilterSection label="Name">
        <input
          ref={nameRef}
          aria-label="Name"
          placeholder="Name it"
          autoComplete="off"
          value={draft.name}
          onChange={(event) => draft.setName(event.target.value)}
          style={FIELD}
        />
      </FilterSection>
      <FilterSection label="Sets">
        <SortSelect
          options={setsOptions(options.sets, draft.scope)}
          value={draft.scope}
          onChange={draft.setScope}
          ariaLabel="Sets"
          style={{width: '100%'}}
        />
      </FilterSection>
      <FilterContent
        inkFilters={filters.draftInks}
        typeFilters={filters.draftTypes}
        costFilters={filters.draftCosts}
        filters={filters.draftFilters}
        uniqueKeywords={options.keywords}
        uniqueClassifications={options.classifications}
        uniqueRarities={options.rarities}
        sets={[]}
        onToggleInk={filters.toggleInk}
        onToggleType={filters.toggleType}
        onToggleCost={filters.toggleCost}
        onFiltersChange={filters.updateFilters}
        vocabulary={FILTER_VOCABULARY}
        variant={isMobile ? 'mobile' : 'panel'}
        showSetFilter={false}
        showArtPresets
      />
      <FilterSection label="Name has">
        <input
          aria-label="Name has"
          placeholder="Stitch"
          autoComplete="off"
          value={draft.query}
          onChange={(event) => draft.setQuery(event.target.value)}
          style={FIELD}
        />
      </FilterSection>
    </>
  );
}

const count = (n: number) => n.toLocaleString('en-US');

const COUNT: CSSProperties = {
  ...TABULAR,
  margin: 0,
  fontFamily: FONTS.hero,
  fontSize: `${FONT_SIZES.xxl}px`,
  fontWeight: FONT_WEIGHT.regular,
  lineHeight: LINE_HEIGHT.tight,
  color: COLORS.text,
};

const LINE: CSSProperties = {...TABULAR, margin: 0, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

/**
 * What the draft binder holds, said: "625 cards", "You have 293 of them" and "46% complete" over
 * the gold bar, or "0 cards" and why it can't be made. Polite live words, so a screen reader
 * hears the count follow each pick.
 */
export function DraftCount({draft}: {draft: BinderDraft}) {
  const {complete, cards} = draft.preview.figures;
  const noun = isPromoScope(draft.scope) ? 'promos' : 'cards';
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xs}}>
      <p aria-live="polite" style={COUNT}>
        {`${count(cards)} ${cards === 1 ? noun.slice(0, -1) : noun}`}
      </p>
      {cards === 0 ? (
        <p style={LINE}>No card matches these rules.</p>
      ) : (
        <>
          <p style={LINE}>{`You have ${count(complete)} of them`}</p>
          <CoverBar figures={draft.preview.figures} />
          <p style={LINE}>{`${percentOf(complete, cards)}% complete`}</p>
        </>
      )}
    </div>
  );
}

/** The draft binder's cover, as the shelf will draw it: its name (or "Name it"), its rules and its card. */
export function DraftCover({draft}: {draft: BinderDraft}) {
  const rule = draft.preview.chips.join(' · ') || 'Every card';
  return <CoverBoard name={draft.name.trim() || 'Name it'} rule={rule} cover={draft.preview.cover} />;
}

const CHIPS: CSSProperties = {display: 'flex', flexWrap: 'wrap', gap: SPACING.xs, margin: 0, padding: 0, listStyle: 'none'};

const CHIP: CSSProperties = {
  padding: `${SPACING.xxs}px ${SPACING.sm}px`,
  borderRadius: `${RADIUS.pill}px`,
  border: `1px solid ${COLORS.surfaceBorder}`,
  background: COLORS.neutralFill,
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: FONT_WEIGHT.medium,
  color: COLORS.text,
};

const HEADING: CSSProperties = {
  margin: 0,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: FONT_WEIGHT.semibold,
  color: COLORS.textMuted,
};

/** The page's pockets, four across, on a binder page's own black. */
const PAGE = {
  ...BINDER_LOOK,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: SPACING.sm,
  padding: SPACING.md,
  borderRadius: `${RADIUS.md}px`,
  background: 'var(--binder-page)',
} as CSSProperties;

const POCKET: CSSProperties = {aspectRatio: '63 / 88'};

const pocketArt = (held: boolean): CSSProperties => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: `${RADIUS.xs}px`,
  // The binder's own grey for a card you don't have.
  filter: held ? undefined : 'grayscale(1) brightness(0.45)',
});

/** Beside the rules on a computer: the cover, the count, the rules as chips and the first page. */
export function DraftPreview({draft}: {draft: BinderDraft}) {
  const {chips, firstPage} = draft.preview;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.lg}}>
      <div style={{width: '72%', alignSelf: 'center'}}>
        <DraftCover draft={draft} />
      </div>
      <DraftCount draft={draft} />
      {chips.length > 0 && (
        <ul aria-label="Its rules" style={CHIPS}>
          {chips.map((chip) => (
            <li key={chip} style={CHIP}>
              {chip}
            </li>
          ))}
        </ul>
      )}
      {firstPage.length > 0 && (
        <section style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
          <h3 style={HEADING}>Its first page</h3>
          <div aria-hidden="true" style={PAGE}>
            {firstPage.map(({card, held}) => (
              <span key={card.id} className="binder-pocket" style={POCKET}>
                <img src={smallImageUrl(card)} alt="" decoding="async" loading="lazy" style={pocketArt(held)} />
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
