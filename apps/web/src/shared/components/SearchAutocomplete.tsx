import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useTransitionPresence} from '../hooks';
import type {UseAutocompleteReturn} from '../hooks';
import {
  COLORS,
  EASING,
  FONT_SIZES,
  RADIUS,
  SET_ABBREVIATIONS,
  SET_NAMES,
  SPACING,
  Z_INDEX,
} from '../constants';

interface SearchAutocompleteProps {
  suggestions: LorcanaCard[];
  isOpen: boolean;
  highlightedIndex: number;
  query: string;
  listboxProps: UseAutocompleteReturn['listboxProps'];
  getOptionProps: UseAutocompleteReturn['getOptionProps'];
}

function HighlightedName({fullName, query}: {fullName: string; query: string}) {
  if (!query || query.length < 2) return <>{fullName}</>;

  const lowerName = fullName.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerName.indexOf(lowerQuery);

  if (matchIndex === -1) return <>{fullName}</>;

  const before = fullName.slice(0, matchIndex);
  const match = fullName.slice(matchIndex, matchIndex + query.length);
  const after = fullName.slice(matchIndex + query.length);

  return (
    <>
      {before}
      <mark
        style={{
          background: 'transparent',
          color: COLORS.primary,
          fontWeight: 600,
        }}>
        {match}
      </mark>
      {after}
    </>
  );
}

export function SearchAutocomplete({
  suggestions,
  isOpen,
  highlightedIndex,
  query,
  listboxProps,
  getOptionProps,
}: SearchAutocompleteProps) {
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);

  if (!mounted) return null;

  return (
    <div
      className={`overlay-transition overlay-fast overlay-slide-down overlay-enter ${visible ? 'overlay-visible' : ''}`}
      onTransitionEnd={onTransitionEnd}
      {...listboxProps}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: SPACING.xs,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 1px rgba(212,175,55,0.15)',
        maxHeight: 360,
        overflowY: 'auto',
        zIndex: Z_INDEX.autocomplete,
      }}>
      {suggestions.map((card, index) => {
        const optionProps = getOptionProps(index);
        const isHighlighted = index === highlightedIndex;
        const setAbbr =
          SET_ABBREVIATIONS[card.setCode as keyof typeof SET_ABBREVIATIONS] ?? card.setCode ?? '';
        const setName =
          SET_NAMES[card.setCode as keyof typeof SET_NAMES] ?? `Set ${card.setCode ?? 'Unknown'}`;

        return (
          <div
            key={card.id}
            {...optionProps}
            style={{
              padding: `${SPACING.lg}px ${SPACING.xl}px`,
              cursor: 'pointer',
              fontSize: FONT_SIZES.lg,
              color: COLORS.text,
              background: isHighlighted ? COLORS.surfaceHover : 'transparent',
              borderBottom:
                index < suggestions.length - 1 ? `1px solid ${COLORS.surfaceBorder}` : undefined,
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.lg,
              transition: `background 0.1s ${EASING.snappy}`,
            }}>
            {/* Set abbreviation with tooltip */}
            <span
              title={setName}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: FONT_SIZES.md,
                color: COLORS.text,
                fontWeight: 500,
                flexShrink: 0,
                minWidth: 32,
                letterSpacing: '0.3px',
                lineHeight: 1,
              }}>
              {setAbbr}
            </span>

            {/* Card name with query highlight */}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}>
              <HighlightedName fullName={card.fullName} query={query} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
