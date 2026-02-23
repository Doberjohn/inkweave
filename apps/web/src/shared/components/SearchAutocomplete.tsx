import {AnimatePresence, motion} from 'framer-motion';
import type {LorcanaCard} from 'lorcana-synergy-engine';
import {useCardPreview} from '../../features/cards/components/useCardPreview';
import type {UseAutocompleteReturn} from '../hooks/useAutocomplete';
import {COLORS, FONT_SIZES, RADIUS, SET_ABBREVIATIONS, SET_NAMES, SPACING, Z_INDEX} from '../constants';

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

/** Camera icon SVG for card preview trigger. */
function PhotoIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="15" rx="3" stroke={COLORS.text} strokeWidth="1.5" />
      <circle cx="12" cy="14" r="4" stroke={COLORS.text} strokeWidth="1.5" />
      <path d="M8.5 6V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1" stroke={COLORS.text} strokeWidth="1.5" />
    </svg>
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
  const {showPreview, updatePosition, hidePreview} = useCardPreview();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{opacity: 0, y: -4}}
          animate={{opacity: 1, y: 0}}
          exit={{opacity: 0, y: -4}}
          transition={{duration: 0.15}}
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
            const setAbbr = SET_ABBREVIATIONS[card.setCode ?? ''] ?? '';
            const setName = SET_NAMES[card.setCode ?? ''] ?? '';

            return (
              <div
                key={card.id}
                {...optionProps}
                style={{
                  padding: `${SPACING.md}px ${SPACING.lg}px`,
                  cursor: 'pointer',
                  fontSize: FONT_SIZES.lg,
                  color: COLORS.text,
                  background: isHighlighted ? COLORS.surfaceHover : 'transparent',
                  borderBottom:
                    index < suggestions.length - 1
                      ? `1px solid ${COLORS.surfaceBorder}`
                      : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  transition: 'background 0.1s ease',
                }}>
                {/* Photo icon — hover to preview card */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                    padding: 2,
                  }}
                  onMouseEnter={(e) => showPreview(card, e.clientX, e.clientY)}
                  onMouseMove={(e) => updatePosition(e.clientX, e.clientY)}
                  onMouseLeave={() => hidePreview()}>
                  <PhotoIcon />
                </span>

                {/* Set abbreviation with tooltip */}
                <span
                  title={setName}
                  style={{
                    fontSize: FONT_SIZES.md,
                    color: COLORS.text,
                    fontWeight: 500,
                    flexShrink: 0,
                    minWidth: 32,
                    letterSpacing: '0.3px',
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
                  }}>
                  <HighlightedName fullName={card.fullName} query={query} />
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
