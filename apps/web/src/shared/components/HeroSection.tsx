import {useCallback, useState} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from 'lorcana-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, Z_INDEX} from '../constants';
import {useAutocomplete} from '../hooks';
import {SearchAutocomplete} from './SearchAutocomplete';
import {SearchIcon} from './SearchIcon';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  cards?: LorcanaCard[];
  onCardSelect?: (card: LorcanaCard) => void;
  isMobile?: boolean;
}

function getStyles(isMobile: boolean) {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: isMobile ? `64px ${SPACING.lg}px 48px` : `0 0 80px`,
      position: 'relative',
      zIndex: 2,
      width: isMobile ? '100%' : undefined,
      boxSizing: 'border-box',
    } as React.CSSProperties,
    sparkle: {
      fontSize: `${isMobile ? FONT_SIZES.md : FONT_SIZES.lg}px`,
      letterSpacing: isMobile ? '3.6px' : '4.2px',
      color: COLORS.primary,
      fontWeight: 400,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
    } as React.CSSProperties,
    heading: {
      fontFamily: FONTS.hero,
      fontSize: isMobile ? 48 : 72,
      fontWeight: 400,
      color: COLORS.heroTitle,
      margin: 0,
      marginBottom: SPACING.sm,
      textAlign: 'center',
      lineHeight: isMobile ? '60px' : '90px',
    } as React.CSSProperties,
    subtitleContainer: {
      textAlign: 'center',
      marginBottom: isMobile ? 24 : 32,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    } as React.CSSProperties,
    subtitlePrimary: {
      fontSize: `${isMobile ? 16 : 18}px`,
      color: COLORS.heroSubtitle,
      margin: 0,
      lineHeight: '24px',
    } as React.CSSProperties,
    subtitleSecondary: {
      fontSize: `${isMobile ? 14 : 16}px`,
      color: COLORS.heroSubtitleSecondary,
      margin: 0,
      lineHeight: '20px',
    } as React.CSSProperties,
    searchRow: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 0,
      width: '100%',
      maxWidth: isMobile ? undefined : 768,
    } as React.CSSProperties,
    inputBorderRadius: isMobile ? `${RADIUS.lg}px` : `${RADIUS.lg}px 0 0 ${RADIUS.lg}px`,
    buttonBorderRadius: isMobile ? `${RADIUS.lg}px` : `0 ${RADIUS.lg}px ${RADIUS.lg}px 0`,
  };
}

// Static styles that don't depend on responsive state
const gradientSpan: React.CSSProperties = {
  background: COLORS.heroGradient,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

const searchIconPosition: React.CSSProperties = {
  position: 'absolute',
  left: 16,
  top: 28,
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  zIndex: 1,
};

export function HeroSection({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  cards = [],
  onCardSelect,
  isMobile,
}: HeroSectionProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const isSearchEmpty = searchQuery.trim().length === 0;
  const styles = getStyles(!!isMobile);

  const handleAutoSelect = useCallback((card: LorcanaCard) => onCardSelect?.(card), [onCardSelect]);

  const autocomplete = useAutocomplete({
    cards,
    query: searchQuery,
    onQueryChange: onSearchChange,
    onSelect: handleAutoSelect,
  });

  const buttonColor = isSearchEmpty ? COLORS.gray500 : COLORS.filterText;

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

      {/* Search Bar + Search Button */}
      <div style={styles.searchRow}>
        <div style={{flex: 1, position: 'relative', zIndex: Z_INDEX.autocomplete}}>
          {/* Search icon */}
          <div style={searchIconPosition}>
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
              height: 56,
              padding: '0 12px 0 48px',
              borderRadius: styles.inputBorderRadius,
              border: `1px solid ${isSearchFocused ? 'rgba(212, 175, 55, 0.5)' : COLORS.searchBorder}`,
              borderRight: isMobile ? undefined : 'none',
              background: COLORS.searchBg,
              color: COLORS.text,
              fontSize: `${FONT_SIZES.xl}px`,
              boxSizing: 'border-box',
              boxShadow: isSearchFocused
                ? '0 0 0 3px rgba(212, 175, 55, 0.15), 0 0 20px rgba(212, 175, 55, 0.1)'
                : 'none',
              transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
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
        <motion.button
          onClick={onSearchSubmit}
          disabled={isSearchEmpty}
          aria-label="Search"
          whileHover={isSearchEmpty ? {} : {background: 'linear-gradient(90deg, #ffb020, #fe9a00)'}}
          whileTap={isSearchEmpty ? {} : {scale: 0.97}}
          transition={{type: 'tween', duration: 0.25}}
          style={{
            height: 56,
            padding: '0 24px',
            borderRadius: styles.buttonBorderRadius,
            border: 'none',
            background: isSearchEmpty ? COLORS.gray200 : COLORS.filterGradient,
            color: buttonColor,
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 400,
            cursor: isSearchEmpty ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexShrink: 0,
            boxShadow: isSearchEmpty ? 'none' : COLORS.filterShadow,
            transition: 'background 0.2s ease, color 0.2s ease',
          }}>
          <SearchIcon size={18} color={buttonColor} strokeWidth={2} />
          Search
        </motion.button>
      </div>
    </section>
  );
}
