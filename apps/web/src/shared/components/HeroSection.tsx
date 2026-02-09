import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../constants';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onFiltersClick: () => void;
  activeFilterCount: number;
  isMobile?: boolean;
}

export function HeroSection({
  searchQuery,
  onSearchChange,
  onFiltersClick,
  activeFilterCount,
  isMobile,
}: HeroSectionProps) {
  return (
    <div
      data-testid="hero-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: isMobile ? 20 : 40,
        padding: isMobile ? `0 ${SPACING.md}px 20px` : undefined,
        position: 'relative',
        zIndex: 1,
        width: isMobile ? '100%' : undefined,
        boxSizing: 'border-box',
      }}>
      {/* Sparkle + Title */}
      <div
        style={{
          fontSize: `${isMobile ? FONT_SIZES.sm : FONT_SIZES.base}px`,
          letterSpacing: '0.3em',
          color: COLORS.primary,
          fontWeight: 600,
          marginBottom: SPACING.sm,
        }}>
        ✦ INKWEAVE ✦
      </div>

      {/* Hero Heading */}
      <h1
        style={{
          fontFamily: FONTS.hero,
          fontSize: isMobile ? 28 : 48,
          fontWeight: 700,
          color: COLORS.heroTitle,
          margin: 0,
          marginBottom: SPACING.sm,
          textAlign: 'center',
          letterSpacing: '0.04em',
          lineHeight: 1.15,
        }}>
        MASTER LORCANA
        <br />
        SYNERGIES
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: `${isMobile ? FONT_SIZES.base : FONT_SIZES.xl}px`,
          color: COLORS.heroSubtitle,
          margin: 0,
          marginBottom: isMobile ? 20 : 32,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
        Select any Lorcana card and instantly discover powerful combinations.
        <br />
        Build stronger decks with intelligent synergy detection.
      </p>

      {/* Search Bar + Filters */}
      <div
        style={{
          display: 'flex',
          gap: `${SPACING.sm}px`,
          width: '100%',
          maxWidth: isMobile ? undefined : 520,
        }}>
        <input
          type="text"
          placeholder="Search for a card..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="hero-search"
          style={{
            flex: 1,
            height: isMobile ? 42 : 48,
            padding: '0 14px',
            borderRadius: `${RADIUS.lg}px`,
            border: `1px solid ${COLORS.surfaceBorder}`,
            background: COLORS.surfaceAlt,
            color: COLORS.text,
            fontSize: `${isMobile ? FONT_SIZES.base : FONT_SIZES.lg}px`,
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <button
          onClick={onFiltersClick}
          aria-label={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
          style={{
            height: isMobile ? 42 : 48,
            padding: isMobile ? '0 16px' : '0 24px',
            borderRadius: `${RADIUS.lg}px`,
            border: 'none',
            background: COLORS.primary,
            color: COLORS.background,
            fontSize: `${isMobile ? FONT_SIZES.base : FONT_SIZES.lg}px`,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}>
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                background: COLORS.background,
                color: COLORS.primary,
                width: 20,
                height: 20,
                borderRadius: '50%',
                fontSize: `${FONT_SIZES.xs}px`,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
