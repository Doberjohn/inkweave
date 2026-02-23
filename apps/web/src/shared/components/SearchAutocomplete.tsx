import {AnimatePresence, motion} from 'framer-motion';
import type {LorcanaCard} from 'lorcana-synergy-engine';
import type {UseAutocompleteReturn} from '../hooks/useAutocomplete';
import {COLORS, FONT_SIZES, INK_COLORS, RADIUS, SPACING, Z_INDEX} from '../constants';

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
            const inkColor = INK_COLORS[card.ink] ?? {bg: '#252530', text: '#a0a0b0', border: '#6b7280'};

            return (
              <div
                key={card.id}
                {...optionProps}
                style={{
                  padding: `${SPACING.md}px ${SPACING.lg}px`,
                  cursor: 'pointer',
                  fontSize: FONT_SIZES.md,
                  color: COLORS.text,
                  background: isHighlighted ? COLORS.surfaceHover : 'transparent',
                  borderBottom:
                    index < suggestions.length - 1
                      ? `1px solid ${COLORS.surfaceBorder}`
                      : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: SPACING.sm,
                  transition: 'background 0.1s ease',
                }}>
                <span style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  <HighlightedName fullName={card.fullName} query={query} />
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACING.xs,
                    flexShrink: 0,
                  }}>
                  {/* Ink color dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: inkColor.border,
                    }}
                    title={card.ink}
                  />
                  {/* Cost badge */}
                  <span
                    style={{
                      fontSize: FONT_SIZES.xs,
                      color: COLORS.muted,
                      fontWeight: 500,
                      minWidth: 14,
                      textAlign: 'right',
                    }}>
                    {card.cost}⬡
                  </span>
                </span>
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
