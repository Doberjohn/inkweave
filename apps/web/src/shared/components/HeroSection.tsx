import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, Z_INDEX} from '../constants';
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
  isMobile?: boolean;
}

function getStyles(isMobile: boolean) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: isMobile ? `48px ${SPACING.lg}px 40px` : '0 0 80px',
      position: 'relative',
      zIndex: 2,
      width: isMobile ? '100%' : undefined,
      boxSizing: 'border-box',
    } as React.CSSProperties,
    sparkle: {
      fontSize: `${isMobile ? FONT_SIZES.xs : FONT_SIZES.base}px`,
      letterSpacing: isMobile ? '3.6px' : '4.2px',
      color: COLORS.primary,
      fontWeight: 400,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
    } as React.CSSProperties,
    heading: {
      fontFamily: FONTS.hero,
      fontSize: isMobile ? 40 : 72,
      fontWeight: 400,
      color: COLORS.heroTitle,
      margin: 0,
      marginBottom: SPACING.sm,
      textAlign: 'center',
      lineHeight: isMobile ? '48px' : '90px',
    } as React.CSSProperties,
    subtitleContainer: {
      textAlign: 'center',
      marginBottom: isMobile ? 24 : 32,
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '6px' : '8px',
      padding: isMobile ? '0 8px' : undefined,
    } as React.CSSProperties,
    subtitlePrimary: {
      fontSize: `${isMobile ? 16 : 20}px`,
      color: COLORS.heroSubtitle,
      margin: 0,
      lineHeight: isMobile ? '22px' : '28px',
    } as React.CSSProperties,
    subtitleSecondary: {
      fontSize: `${isMobile ? FONT_SIZES.base : FONT_SIZES.xl}px`,
      color: COLORS.heroSubtitleSecondary,
      margin: 0,
      lineHeight: isMobile ? '18px' : '20px',
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

// Static styles that don't depend on responsive state
const gradientSpan: React.CSSProperties = {
  background: COLORS.heroGradient,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

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

export function HeroSection({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  cards = [],
  onCardSelect,
  onBrowse,
  onPlaystyles,
  isMobile,
}: HeroSectionProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const styles = getStyles(!!isMobile);

  const handleAutoSelect = (card: LorcanaCard) => onCardSelect?.(card);

  const autocomplete = useAutocomplete({
    cards,
    query: searchQuery,
    onQueryChange: onSearchChange,
    onSelect: handleAutoSelect,
  });

  const mobile = !!isMobile;
  const ctaHeight = mobile ? 48 : 44;

  return (
    <section data-testid="hero-section" aria-label="Hero" style={styles.container}>
      {/* Sparkle + Title */}
      <div style={styles.sparkle}>✦ INKWEAVE ✦</div>

      {/* Hero Heading */}
      <h1 style={styles.heading}>
        MASTER
        <br />
        <span style={gradientSpan}>LORCANA SYNERGIES</span>
      </h1>

      {/* Subtitle */}
      <div style={styles.subtitleContainer}>
        <p style={styles.subtitlePrimary}>
          Select any Lorcana card and instantly discover powerful combinations.
        </p>
        <p style={styles.subtitleSecondary}>
          Build stronger decks with intelligent synergy detection.
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
            onFocus={() => {
              autocomplete.inputProps.onFocus();
              setIsSearchFocused(true);
            }}
            onBlur={() => {
              autocomplete.inputProps.onBlur();
              setTimeout(() => setIsSearchFocused(false), 150);
            }}
            data-testid="hero-search"
            style={{
              width: '100%',
              height: mobile ? 48 : 56,
              padding: mobile ? '0 12px 0 44px' : '0 12px 0 48px',
              borderRadius: `${RADIUS.lg}px`,
              border: `1px solid ${isSearchFocused ? 'rgba(212, 175, 55, 0.5)' : COLORS.searchBorder}`,
              background: COLORS.searchBg,
              color: COLORS.text,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.xl}px`,
              boxSizing: 'border-box',
              boxShadow: isSearchFocused
                ? '0 0 0 3px rgba(212, 175, 55, 0.15), 0 0 20px rgba(212, 175, 55, 0.1)'
                : 'none',
              transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
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
          onMouseEnter={() => import('../../pages/PlaystyleGalleryPage')}
          style={{height: ctaHeight, width: mobile ? '100%' : undefined}}>
          <CompassIcon />
          Explore playstyles
        </CtaButton>
      </div>
    </section>
  );
}
