import {forwardRef, useImperativeHandle, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, DURATION, EASING, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SET_ABBREVIATIONS, SHADOWS, SPACING, TRUNCATE} from '../constants';
import {BottomSheet} from './BottomSheet';
import {LinkButton} from './LinkButton';
import {searchSheetGeometry} from './searchSheetGeometry';
import {useCardDataContext} from '../contexts/CardDataContext';
import {useCardModal} from '../contexts/CardModalContext';
import {smallImageUrl} from '../../features/cards/loader';
import {
  useAutocomplete,
  useDialogFocus,
  useScrollLock,
  useTransitionPresence,
  useVisualViewport,
} from '../hooks';
import {trackEvent} from '../lib/analytics';

// =====================================================================
// Highlighted name (reused from SearchAutocomplete).
// =====================================================================

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
      <mark style={{background: 'transparent', color: COLORS.primary, fontWeight: 600}}>
        {match}
      </mark>
      {after}
    </>
  );
}

// =====================================================================
// Ink color / set abbreviation helpers.
// =====================================================================

function inkColor(card: LorcanaCard): string {
  // Use the primary ink for the thumbnail border. (LorcanaCard exposes
  // `ink` / `ink2` — there is no `inkColor` field; the old code read an
  // always-undefined property and silently fell back to the gray border.)
  // 2026-07-22: the former private ink map here drifted from the theme (its Steel
  // was a different grey) — derive from the token instead. That stray value came
  // from the button-design spec, which has since been corrected; both are now
  // historical, since the ink palette was replaced wholesale on 2026-07-30.
  // Deliberately naming no hex: the value gate greps literals and cannot tell a
  // comment from code, so quoting a token's value here would register as a
  // violation of the very rule this comment is about.
  return INK_COLORS[card.ink]?.border ?? COLORS.surfaceBorder;
}

/** Set abbreviation for a card. Split guard form keeps each conditional simple. */
function getSetAbbr(card: LorcanaCard): string {
  const abbr = SET_ABBREVIATIONS[card.setCode as keyof typeof SET_ABBREVIATIONS];
  if (abbr) return abbr;
  if (card.setCode) return card.setCode;
  return '';
}

/** Ink display label like " · Amber" or " · Amethyst-Sapphire". */
function getInkLabel(card: LorcanaCard): string {
  return card.ink2 ? ` · ${card.ink}-${card.ink2}` : ` · ${card.ink}`;
}

/** Singular/plural results label. */
function getResultsCountLabel(count: number): string {
  if (count === 1) return '1 result';
  return `${count} results`;
}

// =====================================================================
// Recent searches (localStorage).
// =====================================================================

const RECENT_KEY = 'inkweave-recent-searches';
const MAX_RECENT = 6;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (import.meta.env.DEV) console.warn('Failed to read recent searches:', e);
    return [];
  }
}

function addRecentSearch(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const recent = getRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    recent.unshift(trimmed);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch (e) {
    if (import.meta.env.DEV) console.warn('Failed to save recent search:', e);
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch (e) {
    if (import.meta.env.DEV) console.warn('Failed to clear recent searches:', e);
  }
}

/** Focus an input ref if mounted. Module-level so its `if` doesn't roll up to callers. */
function focusInput(ref: React.RefObject<HTMLInputElement | null>): void {
  if (ref.current) ref.current.focus();
}

// =====================================================================
// Lifecycle hook — encapsulates the previous-value pattern so its
// compound conditionals don't roll up to the main component's CC.
// =====================================================================

interface SheetLifecycleInput {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function useSheetLifecycle({isOpen, onOpen, onClose}: SheetLifecycleInput): void {
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    onOpen();
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
    onClose();
  }
}

// =====================================================================
// Subcomponents — internal, not exported.
// =====================================================================

interface SearchSheetInputProps {
  query: string;
  autocomplete: ReturnType<typeof useAutocomplete>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onClear: () => void;
}

function SearchSheetInput({query, autocomplete, inputRef, onSubmit, onClear}: SearchSheetInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    autocomplete.inputProps.onKeyDown(e);
    if (e.defaultPrevented) return;
    if (e.key !== 'Enter') return;
    if (!query.trim()) return;
    onSubmit();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: `0 ${SPACING.lg}px ${SPACING.md}px`,
        flexShrink: 0,
      }}>
      {/* Search icon */}
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" style={{flexShrink: 0}}>
        <circle cx="9" cy="9" r="6" stroke={COLORS.primary} strokeWidth="1.5" />
        <line x1="13.5" y1="13.5" x2="17" y2="17" stroke={COLORS.primary} strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {/* Input */}
      <div style={{flex: 1, position: 'relative'}}>
        <input
          ref={inputRef}
          type="text"
          aria-label="Search cards"
          placeholder="Search cards..."
          {...autocomplete.inputProps}
          onKeyDown={handleKeyDown}
          data-testid="search-sheet-input"
          style={{
            width: '100%',
            height: 40,
            padding: '0 36px 0 12px',
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.primary}`,
            background: COLORS.searchBg,
            color: COLORS.text,
            fontSize: `${FONT_SIZES.lg}px`,
            fontFamily: FONTS.body,
            boxSizing: 'border-box',
            outline: 'none',
            boxShadow: SHADOWS.glowSm,
          }}
        />
        {query && <ClearButton onClear={onClear} />}
      </div>
    </div>
  );
}

function ClearButton({onClear}: {onClear: () => void}) {
  return (
    <button
      aria-label="Clear search"
      onClick={onClear}
      style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: 'none',
        background: COLORS.surfaceBorder,
        color: COLORS.textMuted,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: FONT_SIZES.lg,
        lineHeight: 1,
        padding: 0,
      }}>
      ×
    </button>
  );
}

interface SearchResultRowProps {
  card: LorcanaCard;
  isHighlighted: boolean;
  isLast: boolean;
  query: string;
  optionProps: React.HTMLAttributes<HTMLDivElement>;
}

function SearchResultRow({card, isHighlighted, isLast, query, optionProps}: SearchResultRowProps) {
  const setAbbr = getSetAbbr(card);
  const inkLabel = getInkLabel(card);
  return (
    <div>
      <div
        {...optionProps}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          padding: `${SPACING.sm}px ${SPACING.lg}px`,
          minHeight: 60,
          cursor: 'pointer',
          background: isHighlighted ? COLORS.surfaceHover : 'transparent',
          transition: `background ${DURATION.fast}ms ${EASING.snappy}`,
        }}>
        {/* Thumbnail */}
        <div
          style={{
            width: 38,
            height: 53,
            borderRadius: RADIUS.sm,
            background: inkColor(card),
            flexShrink: 0,
            overflow: 'hidden',
          }}>
          {card.imageUrl && (
            <img
              src={smallImageUrl(card) ?? card.imageUrl}
              alt=""
              loading="lazy"
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          )}
        </div>

        {/* Card info */}
        <div style={{flex: 1, minWidth: 0}}>
          <div
            style={{
              fontSize: `${FONT_SIZES.lg}px`,
              fontWeight: 500,
              color: COLORS.text,
              fontFamily: FONTS.body,
              ...TRUNCATE,
            }}>
            <HighlightedName fullName={card.fullName} query={query} />
          </div>
          <div
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              marginTop: 2,
            }}>
            {setAbbr}
            {inkLabel}
          </div>
        </div>

        {/* Chevron */}
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink: 0}}>
          <path d="M9 18l6-6-6-6" stroke={COLORS.gray300} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {!isLast && (
        <div style={{height: 1, background: COLORS.surfaceHover, marginLeft: SPACING.lg, marginRight: SPACING.lg}} />
      )}
    </div>
  );
}

interface SearchResultsListProps {
  suggestions: LorcanaCard[];
  highlightedIndex: number;
  query: string;
  getOptionProps: (index: number) => React.HTMLAttributes<HTMLDivElement>;
}

function SearchResultsList({suggestions, highlightedIndex, query, getOptionProps}: SearchResultsListProps) {
  return (
    <div>
      <div
        style={{
          padding: `${SPACING.sm}px ${SPACING.lg}px`,
          fontSize: `${FONT_SIZES.sm}px`,
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
          fontWeight: 500,
        }}>
        {getResultsCountLabel(suggestions.length)}
      </div>
      {suggestions.map((card, index) => (
        <SearchResultRow
          key={card.id}
          card={card}
          isHighlighted={index === highlightedIndex}
          isLast={index === suggestions.length - 1}
          query={query}
          optionProps={getOptionProps(index)}
        />
      ))}
    </div>
  );
}

interface RecentSearchChipProps {
  term: string;
  onClick: (term: string) => void;
}

function RecentSearchChip({term, onClick}: RecentSearchChipProps) {
  return (
    <button
      onClick={() => onClick(term)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 32,
        padding: '0 12px',
        borderRadius: RADIUS.pill,
        border: `1px solid ${COLORS.surfaceBorder}`,
        background: COLORS.surfaceAlt,
        color: COLORS.text,
        fontSize: `${FONT_SIZES.xs}px`,
        fontWeight: 500,
        fontFamily: FONTS.body,
        cursor: 'pointer',
      }}>
      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke={COLORS.gray300} strokeWidth="2" />
        <path d="M12 6v6l4 2" stroke={COLORS.gray300} strokeWidth="2" strokeLinecap="round" />
      </svg>
      {term}
    </button>
  );
}

interface SearchEmptyStateProps {
  recentSearches: string[];
  onRecentClick: (term: string) => void;
  onClearRecent: () => void;
}

function SearchEmptyState({recentSearches, onRecentClick, onClearRecent}: SearchEmptyStateProps) {
  const hasRecent = recentSearches.length > 0;
  return (
    <div style={{padding: `${SPACING.md}px ${SPACING.lg}px`}}>
      {hasRecent ? (
        <RecentSection recentSearches={recentSearches} onRecentClick={onRecentClick} onClearRecent={onClearRecent} />
      ) : (
        <EmptyPrompt />
      )}
    </div>
  );
}

function RecentSection({recentSearches, onRecentClick, onClearRecent}: SearchEmptyStateProps) {
  return (
    <div style={{marginBottom: SPACING.xl}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md}}>
        <span
          style={{
            fontSize: `${FONT_SIZES.xs}px`,
            fontWeight: 600,
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
          Recent
        </span>
        <LinkButton size="sm" onClick={onClearRecent}>
          Clear
        </LinkButton>
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: SPACING.sm}}>
        {recentSearches.map((term) => (
          <RecentSearchChip key={term} term={term} onClick={onRecentClick} />
        ))}
      </div>
    </div>
  );
}

function EmptyPrompt() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: `${SPACING.xxl}px 0`,
        color: COLORS.textMuted,
        fontSize: `${FONT_SIZES.base}px`,
        fontFamily: FONTS.body,
      }}>
      Search for a card to see its synergies
    </div>
  );
}

// =====================================================================
// Sheet chrome — backdrop + dialog shell. Extracted so the main
// component's function body stays under the line-length threshold.
// =====================================================================

function Divider() {
  return <div style={{height: 1, background: COLORS.surfaceBorder, flexShrink: 0}} />;
}

interface SearchSheetProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  /**
   * Both edges, from `searchSheetGeometry`. `bottom` is not always 0: it rides
   * on top of the on-screen keyboard so the sheet is never partly behind it.
   */
  geometry: {top: number; bottom: number};
  hasResults: boolean;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onTransitionEnd: React.TransitionEventHandler<HTMLDivElement>;
  onClose: () => void;
  query: string;
  autocomplete: ReturnType<typeof useAutocomplete>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onClear: () => void;
  recentSearches: string[];
  onRecentClick: (term: string) => void;
  onClearRecent: () => void;
}

function SearchSheet({
  sheetRef,
  visible,
  geometry,
  hasResults,
  onKeyDown,
  onTransitionEnd,
  onClose,
  query,
  autocomplete,
  inputRef,
  onSubmit,
  onClear,
  recentSearches,
  onRecentClick,
  onClearRecent,
}: SearchSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      ariaLabel="Search cards"
      backdropTestId="search-sheet-backdrop"
      sheetRef={sheetRef}
      onKeyDown={onKeyDown}
      sheetStyle={{
        top: geometry.top,
        // Overrides BottomSheet's `bottom: 0`. Both edges are set so the sheet
        // has a DEFINITE height for its `flex: 1` results list to scroll inside.
        bottom: geometry.bottom,
        // `bottom` is in the transition because the keyboard animates open; without
        // it the sheet's lower edge would jump to the keyboard while its top slid.
        transition: `top ${DURATION.slow}ms ${EASING.smooth}, bottom ${DURATION.slow}ms ${EASING.smooth}, opacity ${DURATION.slow}ms ${EASING.smooth}, transform ${DURATION.slow}ms ${EASING.smooth}`,
      }}>
      <SearchSheetInput
        query={query}
        autocomplete={autocomplete}
        inputRef={inputRef}
        onSubmit={onSubmit}
        onClear={onClear}
      />
      <Divider />
      <div style={{flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch'}}>
        {hasResults ? (
          <SearchResultsList
            suggestions={autocomplete.suggestions}
            highlightedIndex={autocomplete.highlightedIndex}
            query={query}
            getOptionProps={autocomplete.getOptionProps}
          />
        ) : (
          <SearchEmptyState
            recentSearches={recentSearches}
            onRecentClick={onRecentClick}
            onClearRecent={onClearRecent}
          />
        )}
      </div>
    </BottomSheet>
  );
}

// =====================================================================
// Public component.
// =====================================================================

export interface SearchBottomSheetHandle {
  /** Focus the proxy input synchronously. Call from the tap handler to preserve iOS keyboard activation. */
  focusProxy: () => void;
}

interface SearchBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchBottomSheet = forwardRef<SearchBottomSheetHandle, SearchBottomSheetProps>(
  function SearchBottomSheet({isOpen, onClose}, ref) {
    const navigate = useNavigate();
    const {openCardModal} = useCardModal();
    const {cards} = useCardDataContext();
    const inputRef = useRef<HTMLInputElement>(null);
    const proxyRef = useRef<HTMLInputElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      focusProxy: () => focusInput(proxyRef),
    }));

    const [query, setQuery] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
    // Subscribed unconditionally, not gated on `isOpen`: the keyboard is often
    // already animating open when the sheet mounts (openSearch focuses a proxy
    // input inside the tap call stack), so a listener attached later would miss
    // the resize that matters most.
    const viewport = useVisualViewport();

    const handleSelect = (card: LorcanaCard) => {
      addRecentSearch(card.fullName);
      onClose();
      // Small delay so close animation starts before opening modal
      setTimeout(() => openCardModal(card.id), 50);
    };

    const autocomplete = useAutocomplete({
      cards,
      query,
      onQueryChange: setQuery,
      onSelect: handleSelect,
    });

    // Reset state when isOpen changes (previous-value pattern per React docs).
    // getRecentSearches() is a read-only localStorage call, safe during render.
    useSheetLifecycle({
      isOpen,
      onOpen: () => setRecentSearches(getRecentSearches()),
      onClose: () => setQuery(''),
    });

    useScrollLock(isOpen);

    const handleRecentClick = (term: string) => {
      autocomplete.searchImmediate(term);
      focusInput(inputRef);
    };

    const handleClearRecent = () => {
      clearRecentSearches();
      setRecentSearches([]);
    };

    const handleInputClear = () => {
      setQuery('');
      autocomplete.close();
      focusInput(inputRef);
    };

    const handleSubmit = () => {
      const q = query.trim();
      if (q) trackEvent('search_submitted', {query: q, source: 'mobile_sheet'});
      onClose();
      navigate(`/browse?q=${encodeURIComponent(q)}`);
    };

    // Focus trap + Escape key handling.
    // useDialogFocus focuses inputRef after 100ms (isOpen=true), which fires after
    // useTransitionPresence's rAF sets visible=true, so the element is focusable.
    const {handleKeyDown: handleDialogKeyDown} = useDialogFocus({
      isOpen,
      containerRef: sheetRef,
      initialFocusRef: inputRef,
      onClose,
    });

    // Proxy input: always in the DOM so iOS can focus it synchronously on tap,
    // keeping the keyboard activation "ticket" alive until the real input mounts.
    const proxyInput = (
      <input
        ref={proxyRef}
        aria-hidden="true"
        tabIndex={-1}
        style={{position: 'fixed', opacity: 0, pointerEvents: 'none', left: -9999}}
      />
    );

    if (!mounted) return proxyInput;

    const hasResults = autocomplete.suggestions.length > 0 && query.length >= 2;
    // Sized against the VISIBLE viewport, not the layout one. The previous
    // hardcoded `top: 100 / 244` measured the layout viewport, which does not
    // shrink for the keyboard — so on an 812px phone only ~232px of a 568px
    // sheet was above the keys. See `searchSheetGeometry`.
    const geometry = searchSheetGeometry({
      layoutHeight: window.innerHeight,
      visibleHeight: viewport.height,
      keyboardInset: viewport.keyboardInset,
      hasResults,
    });

    return (
      <>
        {proxyInput}
        <SearchSheet
          sheetRef={sheetRef}
          visible={visible}
          geometry={geometry}
          hasResults={hasResults}
          onKeyDown={handleDialogKeyDown}
          onTransitionEnd={onTransitionEnd}
          onClose={onClose}
          query={query}
          autocomplete={autocomplete}
          inputRef={inputRef}
          onSubmit={handleSubmit}
          onClear={handleInputClear}
          recentSearches={recentSearches}
          onRecentClick={handleRecentClick}
          onClearRecent={handleClearRecent}
        />
      </>
    );
  },
);
