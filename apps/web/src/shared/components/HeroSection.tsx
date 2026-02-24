import {useCallback, useState} from 'react';
import {motion} from 'framer-motion';
import type {LorcanaCard} from 'lorcana-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, Z_INDEX} from '../constants';
import {useAutocomplete} from '../hooks/useAutocomplete';
import {SearchAutocomplete} from './SearchAutocomplete';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  cards?: LorcanaCard[];
  onCardSelect?: (card: LorcanaCard) => void;
  isMobile?: boolean;
}

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

  const handleAutoSelect = useCallback((card: LorcanaCard) => onCardSelect?.(card), [onCardSelect]);

  const autocomplete = useAutocomplete({
    cards,
    query: searchQuery,
    onQueryChange: onSearchChange,
    onSelect: handleAutoSelect,
  });

  return (
    <div
      data-testid="hero-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...(isMobile ? {padding: `64px ${SPACING.lg}px 48px`} : {paddingBottom: 80}),
        position: 'relative',
        zIndex: 2,
        width: isMobile ? '100%' : undefined,
        boxSizing: 'border-box',
      }}>
      {/* Sparkle + Title */}
      <div
        style={{
          fontSize: `${isMobile ? FONT_SIZES.md : FONT_SIZES.lg}px`,
          letterSpacing: isMobile ? '3.6px' : '4.2px',
          color: COLORS.primary,
          fontWeight: 400,
          marginBottom: SPACING.sm,
          textTransform: 'uppercase',
        }}>
        ✦ INKWEAVE ✦
      </div>

      {/* Hero Heading */}
      <h1
        style={{
          fontFamily: FONTS.hero,
          fontSize: isMobile ? 48 : 72,
          fontWeight: 400,
          color: COLORS.heroTitle,
          margin: 0,
          marginBottom: SPACING.sm,
          textAlign: 'center',
          lineHeight: isMobile ? '60px' : '90px',
        }}>
        MASTER
        <br />
        <span
          style={{
            background: COLORS.heroGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
          LORCANA SYNERGIES
        </span>
      </h1>

      {/* Subtitle */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: isMobile ? 24 : 32,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
        <p
          style={{
            fontSize: `${isMobile ? 16 : 18}px`,
            color: COLORS.heroSubtitle,
            margin: 0,
            lineHeight: '24px',
          }}>
          Select any Lorcana card and instantly discover powerful combinations.
        </p>
        <p
          style={{
            fontSize: `${isMobile ? 14 : 16}px`,
            color: COLORS.heroSubtitleSecondary,
            margin: 0,
            lineHeight: '20px',
          }}>
          Build stronger decks with intelligent synergy detection.
        </p>
      </div>

      {/* Search Bar + Search Button */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0,
          width: '100%',
          maxWidth: isMobile ? undefined : 768,
        }}>
        <div style={{flex: 1, position: 'relative', zIndex: Z_INDEX.autocomplete}}>
          {/* Search icon */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 16,
              top: 28, // Vertically centered in 56px input
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              pointerEvents: 'none',
              zIndex: 1,
            }}
            viewBox="0 0 20 20"
            fill="none">
            <circle cx="9" cy="9" r="6" stroke={COLORS.searchPlaceholder} strokeWidth="1.5" />
            <line
              x1="13.5"
              y1="13.5"
              x2="17"
              y2="17"
              stroke={COLORS.searchPlaceholder}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            aria-label="Search for a card"
            placeholder="Search for a card..."
            {...autocomplete.inputProps}
            onKeyDown={(e) => {
              // Let autocomplete handle keyboard nav first
              autocomplete.inputProps.onKeyDown(e);
              // If autocomplete didn't prevent default (no highlight + Enter), trigger search submit
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
              // Delay to match autocomplete's 150ms blur timeout so focus ring persists
              // while user clicks a suggestion
              setTimeout(() => setIsSearchFocused(false), 150);
            }}
            data-testid="hero-search"
            style={{
              width: '100%',
              height: 56,
              padding: '0 12px 0 48px',
              borderRadius: isMobile ? `${RADIUS.lg}px` : `${RADIUS.lg}px 0 0 ${RADIUS.lg}px`,
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
          whileHover={
            isSearchEmpty
              ? {}
              : {
                  background: 'linear-gradient(90deg, #ffb020, #fe9a00)',
                }
          }
          whileTap={isSearchEmpty ? {} : {scale: 0.97}}
          transition={{type: 'tween', duration: 0.25}}
          style={{
            height: 56,
            padding: '0 24px',
            borderRadius: isMobile ? `${RADIUS.lg}px` : `0 ${RADIUS.lg}px ${RADIUS.lg}px 0`,
            border: 'none',
            background: isSearchEmpty ? COLORS.gray200 : COLORS.filterGradient,
            color: isSearchEmpty ? COLORS.gray500 : COLORS.filterText,
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
          {/* Search icon */}
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle
              cx="9"
              cy="9"
              r="6"
              stroke={isSearchEmpty ? COLORS.gray500 : COLORS.filterText}
              strokeWidth="2"
            />
            <line
              x1="13.5"
              y1="13.5"
              x2="17"
              y2="17"
              stroke={isSearchEmpty ? COLORS.gray500 : COLORS.filterText}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Search
        </motion.button>
      </div>
    </div>
  );
}
