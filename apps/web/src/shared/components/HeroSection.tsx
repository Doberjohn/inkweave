import {motion} from 'framer-motion';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../constants';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  isMobile?: boolean;
}

export function HeroSection({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  isMobile,
}: HeroSectionProps) {
  return (
    <div
      data-testid="hero-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...(isMobile
          ? {padding: `64px ${SPACING.lg}px 48px`}
          : {paddingBottom: 80}),
        position: 'relative',
        zIndex: 1,
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

      {/* Search Bar + Filters */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0,
          width: '100%',
          maxWidth: isMobile ? undefined : 768,
        }}>
        <div style={{flex: 1, position: 'relative'}}>
          {/* Search icon */}
          <svg
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              pointerEvents: 'none',
            }}
            viewBox="0 0 20 20"
            fill="none">
            <circle cx="9" cy="9" r="6" stroke={COLORS.searchPlaceholder} strokeWidth="1.5" />
            <line x1="13.5" y1="13.5" x2="17" y2="17" stroke={COLORS.searchPlaceholder} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search for a card..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchSubmit?.();
            }}
            data-testid="hero-search"
            style={{
              width: '100%',
              height: 56,
              padding: '0 12px 0 48px',
              borderRadius: isMobile
                ? `${RADIUS.lg}px`
                : `${RADIUS.lg}px 0 0 ${RADIUS.lg}px`,
              border: `1px solid ${COLORS.searchBorder}`,
              borderRight: isMobile ? undefined : 'none',
              background: COLORS.searchBg,
              color: COLORS.text,
              fontSize: `${FONT_SIZES.xl}px`,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
        <motion.button
          onClick={onSearchSubmit}
          aria-label="Search"
          whileHover={{
            scale: 1.03,
            boxShadow: `0 0 20px ${COLORS.primary}40, 0 4px 12px rgba(0,0,0,0.3)`,
          }}
          whileTap={{scale: 0.97}}
          transition={{
            default: {type: 'spring', stiffness: 400, damping: 25},
            boxShadow: {type: 'tween', duration: 0.15},
          }}
          style={{
            height: 56,
            padding: '0 24px',
            borderRadius: isMobile
              ? `${RADIUS.lg}px`
              : `0 ${RADIUS.lg}px ${RADIUS.lg}px 0`,
            border: 'none',
            background: COLORS.filterGradient,
            color: COLORS.filterText,
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexShrink: 0,
            boxShadow: COLORS.filterShadow,
          }}>
          {/* Search icon */}
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke={COLORS.filterText} strokeWidth="2" />
            <line x1="13.5" y1="13.5" x2="17" y2="17" stroke={COLORS.filterText} strokeWidth="2" strokeLinecap="round" />
          </svg>
          Search
        </motion.button>
      </div>
    </div>
  );
}
