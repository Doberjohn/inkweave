import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONTS, FONT_SIZES, GOLD_GLOW, RADIUS, SPACING, Z_INDEX} from '../constants';
import {useAutocomplete} from '../hooks';
import {SearchAutocomplete} from './SearchAutocomplete';
import {SearchIcon} from './SearchIcon';
import {CtaButton} from './CtaButton';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  cards?: LorcanaCard[];
  onCardSelect?: (card: LorcanaCard) => void;
  onBrowse?: () => void;
  onPlaystyles?: () => void;
  onVote?: () => void;
  isMobile?: boolean;
}

function getStyles(isMobile: boolean) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: isMobile ? `48px ${SPACING.lg}px 40px` : 0,
      position: 'relative',
      zIndex: 2,
      width: isMobile ? '100%' : undefined,
      boxSizing: 'border-box',
    } as React.CSSProperties,
    heading: {
      margin: 0,
      marginBottom: isMobile ? 16 : 20,
      lineHeight: 0,
    } as React.CSSProperties,
    // A definite width (clamped by maxWidth) is what lets the img's width/height attributes
    // reserve its box before the SVG arrives. The <h1> shrink-wraps its content, so the old
    // `width: '100%'` resolved against a 0-wide parent until the image loaded, and the hero
    // then grew by 192 px, moving the whole centered page (#627).
    logo: {
      display: 'block',
      width: isMobile ? 380 : 600,
      maxWidth: '100%',
      height: 'auto',
      userSelect: 'none',
    } as React.CSSProperties,
    // Head-term for the H1: read by Google + screen readers, invisible on screen (#496).
    srOnly: {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
      border: 0,
    } as React.CSSProperties,
    subtitleContainer: {
      textAlign: 'center',
      marginBottom: isMobile ? 24 : 32,
      padding: isMobile ? '0 8px' : undefined,
    } as React.CSSProperties,
    subtitlePrimary: {
      fontSize: `${isMobile ? 16 : 20}px`,
      color: COLORS.heroSubtitle,
      margin: 0,
      lineHeight: isMobile ? '22px' : '28px',
    } as React.CSSProperties,
    searchRow: {
      display: 'flex',
      width: '100%',
      maxWidth: isMobile ? undefined : 768,
    } as React.CSSProperties,
    searchIconPosition: {
      position: 'absolute',
      left: isMobile ? 14 : 16,
      top: isMobile ? 24 : 28,
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      zIndex: 1,
    } as React.CSSProperties,
    ctaRow: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 10 : 12,
      marginTop: isMobile ? 16 : 20,
      width: isMobile ? '100%' : undefined,
    } as React.CSSProperties,
  };
}

/** Grid icon for "Browse all cards" CTA. */
function GridIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

/** Compass icon for "Explore playstyles" CTA. */
function CompassIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

/** Star icon for "Rate synergies" CTA. */
function StarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function HeroSection({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  cards = [],
  onCardSelect,
  onBrowse,
  onPlaystyles,
  onVote,
  isMobile,
}: HeroSectionProps) {
  const styles = getStyles(!!isMobile);

  const handleAutoSelect = (card: LorcanaCard) => onCardSelect?.(card);

  const autocomplete = useAutocomplete({
    cards,
    query: searchQuery,
    onQueryChange: onSearchChange,
    onSelect: handleAutoSelect,
  });
  // The hook's focus state carries the blur delay and cancels it on refocus and unmount.
  const isSearchFocused = autocomplete.isFocused;

  const mobile = !!isMobile;
  const ctaHeight = mobile ? 48 : 44;

  return (
    <section data-testid="hero-section" aria-label="Hero" style={styles.container}>
      {/* Logo — animated SVG with self-contained CSS animations (honors prefers-reduced-motion).
          Wrapping in h1 preserves a single top-level heading for a11y; alt provides the name. */}
      <h1 style={styles.heading}>
        {/* width/height are the SVG's intrinsic size: with styles.logo's definite width they
            reserve the logo's box before the file arrives, so the vertically centered <main>
            does not shift (#627). fetchPriority: this is the page's LCP element. */}
        <img
          src="/brand/logo-animated.svg"
          alt="Inkweave"
          width={977}
          height={313}
          fetchPriority="high"
          style={styles.logo}
        />
        <span style={styles.srOnly}>Disney Lorcana Card Synergy Finder for Core format</span>
      </h1>

      {/* Subtitle */}
      <div style={styles.subtitleContainer}>
        <p style={styles.subtitlePrimary}>
          Select any Lorcana card and instantly discover powerful synergies.
        </p>
      </div>

      {/* Search Bar */}
      <div style={styles.searchRow}>
        <div style={{flex: 1, position: 'relative', zIndex: Z_INDEX.autocomplete}}>
          <div style={styles.searchIconPosition}>
            <SearchIcon color={COLORS.searchPlaceholder} />
          </div>
          <input
            type="text"
            aria-label="Search for a card"
            placeholder="Search for a card..."
            {...autocomplete.inputProps}
            onKeyDown={(e) => {
              autocomplete.inputProps.onKeyDown(e);
              if (!e.defaultPrevented && e.key === 'Enter') {
                onSearchSubmit?.();
              }
            }}
            data-testid="hero-search"
            style={{
              width: '100%',
              height: mobile ? 48 : 56,
              padding: mobile ? '0 12px 0 44px' : '0 12px 0 48px',
              borderRadius: `${RADIUS.lg}px`,
              border: `1px solid ${isSearchFocused ? GOLD_GLOW.activeBorder : COLORS.searchBorder}`,
              background: COLORS.searchBg,
              color: COLORS.text,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.xl}px`,
              boxSizing: 'border-box',
              boxShadow: isSearchFocused ? GOLD_GLOW.focusRing : 'none',
              transition: `border-color 0.25s ${EASING.snappy}, box-shadow 0.25s ${EASING.snappy}`,
              outline: 'none',
            }}
          />
          <SearchAutocomplete
            suggestions={autocomplete.suggestions}
            isOpen={autocomplete.isOpen}
            highlightedIndex={autocomplete.highlightedIndex}
            query={searchQuery}
            listboxProps={autocomplete.listboxProps}
            getOptionProps={autocomplete.getOptionProps}
          />
        </div>
      </div>

      {/* CTA Buttons */}
      <div style={styles.ctaRow}>
        <CtaButton
          data-testid="cta-browse"
          onClick={onBrowse}
          style={{height: ctaHeight, width: mobile ? '100%' : undefined}}>
          <GridIcon />
          Browse all cards
        </CtaButton>
        <CtaButton
          variant="ghost"
          data-testid="cta-playstyles"
          onClick={onPlaystyles}
          style={{height: ctaHeight, width: mobile ? '100%' : undefined}}>
          <CompassIcon />
          Explore playstyles
        </CtaButton>
        {onVote && (
          <CtaButton
            variant="ghost"
            data-testid="cta-vote"
            onClick={onVote}
            style={{height: ctaHeight, width: mobile ? '100%' : undefined}}>
            <StarIcon />
            Rate synergies
          </CtaButton>
        )}
      </div>
    </section>
  );
}
