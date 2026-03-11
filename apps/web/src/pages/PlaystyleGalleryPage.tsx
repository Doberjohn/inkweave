import {useCallback, useMemo, useState, type ReactNode} from 'react';
import {useNavigate} from 'react-router-dom';
import {isSyntheticMouseEvent} from '../shared/utils/touchGuard';
import {
  getAllPlaystyles,
  getRulesByPlaystyle,
  type LorcanaCard,
  type Playstyle,
} from 'inkweave-synergy-engine';
import {useAllPlaystyleCards} from '../features/synergies/hooks';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  LoadingSpinner,
} from '../shared/components';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  PLAYSTYLE_UI,
  COMING_SOON_PLAYSTYLES,
  type PlaystyleUiMeta,
  type ComingSoonPlaystyle,
} from '../shared/constants';
import {smallImageUrl} from '../features/cards';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive, usePreloadImages} from '../shared/hooks';

// ── Layout config (computed once, passed as concrete values) ──

interface LayoutConfig {
  cardPadding: number;
  cardGap: number;
  thumbW: number;
  thumbH: number;
  pagePadding: string;
  gridPadding: string;
  dividerPadding: string;
  gridColumn: string | undefined;
  maxSubtitleWidth: number | undefined;
}

const DESKTOP_LAYOUT: LayoutConfig = {
  cardPadding: 24,
  cardGap: 16,
  thumbW: 56,
  thumbH: 78,
  pagePadding: `${SPACING.xxl + 8}px 32px 0`,
  gridPadding: `${SPACING.xxl}px 32px 48px`,
  dividerPadding: `${SPACING.md}px 0 0`,
  gridColumn: '1 / -1',
  maxSubtitleWidth: 640,
};

const MOBILE_LAYOUT: LayoutConfig = {
  cardPadding: 20,
  cardGap: 12,
  thumbW: 48,
  thumbH: 67,
  pagePadding: `${SPACING.xl}px ${SPACING.lg}px 0`,
  gridPadding: `${SPACING.xl}px ${SPACING.lg}px 48px`,
  dividerPadding: `${SPACING.sm}px 0 0`,
  gridColumn: undefined,
  maxSubtitleWidth: undefined,
};

// ── Scrim constants ──

const SCRIM_GRADIENT =
  'linear-gradient(180deg, rgba(26,26,46,0.75) 0%, rgba(26,26,46,0.55) 40%, rgba(26,26,46,0.8) 100%)';
const ART_IDLE = {opacity: 0.35, filter: 'saturate(0.2) brightness(0.7)', transform: 'scale(1)'};
const ART_HOVER = {
  opacity: 0.45,
  filter: 'saturate(0.7) brightness(0.85)',
  transform: 'scale(1.1)',
};

// ── Shared Card Shell ──

function PlaystyleCardShell({
  accentColor,
  accentRgb,
  coverArt,
  name,
  description,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
  layout,
  opacity,
  cursor,
  descriptionFlex,
  children,
}: {
  accentColor: string;
  accentRgb: string;
  coverArt: string;
  name: string;
  description: string;
  isHovered: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
  layout: LayoutConfig;
  opacity?: number;
  cursor: string;
  descriptionFlex?: number;
  children?: ReactNode;
}) {
  const art = isHovered ? ART_HOVER : ART_IDLE;
  const isClickable = !!onClick;

  return (
    <article
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={() => {
        if (isSyntheticMouseEvent()) return;
        onClick?.();
      }}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: COLORS.surface,
        border: `1px solid ${isHovered ? `rgba(${accentRgb}, 0.4)` : COLORS.surfaceBorder}`,
        borderRadius: `${RADIUS.card}px`,
        padding: layout.cardPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: layout.cardGap,
        cursor,
        position: 'relative',
        overflow: 'hidden',
        opacity,
        transform: isHovered ? 'translateY(-4px)' : undefined,
        boxShadow: isHovered
          ? `0 12px 32px rgba(0,0,0,0.4), 0 0 24px rgba(${accentRgb}, 0.08)`
          : undefined,
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s, opacity 0.3s',
      }}>
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 3,
          height: '100%',
          borderRadius: `${RADIUS.card}px 0 0 ${RADIUS.card}px`,
          background: accentColor,
          zIndex: 3,
        }}
      />
      {/* Background art */}
      <div
        style={{
          position: 'absolute',
          inset: -20,
          borderRadius: `${RADIUS.card}px`,
          zIndex: 1,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `url(${coverArt})`,
          opacity: art.opacity,
          filter: art.filter,
          transform: art.transform,
          transition:
            'opacity 0.5s ease, filter 0.6s ease, transform 4s cubic-bezier(0.25,0.1,0.25,1)',
        }}
      />
      {/* Scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: `${RADIUS.card}px`,
          zIndex: 1,
          background: SCRIM_GRADIENT,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2}}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: accentColor,
            flexShrink: 0,
          }}
        />
        <h2
          style={{
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            margin: 0,
          }}>
          {name}
        </h2>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: `${FONT_SIZES.base}px`,
          lineHeight: 1.6,
          color: COLORS.descriptionText,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: descriptionFlex,
          position: 'relative',
          zIndex: 2,
          margin: 0,
        }}>
        {description}
      </p>

      {children}
    </article>
  );
}

// ── Active Playstyle Card ──

function ActivePlaystyleCard({
  playstyle,
  ui,
  cardCount,
  ruleCount,
  previewCards,
  onClick,
  layout,
  enableHover,
}: {
  playstyle: Playstyle;
  ui: PlaystyleUiMeta;
  cardCount: number;
  ruleCount: number;
  previewCards: Pick<LorcanaCard, 'imageUrl' | 'fullName'>[];
  onClick: () => void;
  layout: LayoutConfig;
  enableHover: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <PlaystyleCardShell
      accentColor={ui.accentColor}
      accentRgb={ui.accentRgb}
      coverArt={ui.coverArt}
      name={playstyle.name}
      description={playstyle.description}
      isHovered={isHovered}
      onMouseEnter={enableHover ? () => setIsHovered(true) : undefined}
      onMouseLeave={enableHover ? () => setIsHovered(false) : undefined}
      onClick={onClick}
      layout={layout}
      cursor="pointer"
      descriptionFlex={1}>
      {/* Preview cards */}
      <div style={{display: 'flex', gap: 8, position: 'relative', zIndex: 2}}>
        {previewCards.map((card) => (
          <div
            key={card.fullName}
            style={{
              width: layout.thumbW,
              height: layout.thumbH,
              borderRadius: `${RADIUS.md}px`,
              flexShrink: 0,
              overflow: 'hidden',
              background: COLORS.surfaceAlt,
              border: `1px solid ${COLORS.surfaceBorder}`,
            }}>
            {card.imageUrl && (
              <img
                src={smallImageUrl(card.imageUrl)}
                alt={card.fullName}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            )}
          </div>
        ))}
        {cardCount > 4 && (
          <div
            style={{
              width: layout.thumbW,
              height: layout.thumbH,
              borderRadius: `${RADIUS.md}px`,
              border: `1px dashed ${COLORS.gray300}`,
              background: COLORS.surfaceAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${FONT_SIZES.xs}px`,
              color: COLORS.primary500,
              fontWeight: 700,
              flexShrink: 0,
            }}>
            +{cardCount - 4}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `12px ${layout.cardPadding}px`,
          margin: `0 -${layout.cardPadding}px -${layout.cardPadding}px`,
          borderRadius: `0 0 ${RADIUS.card - 1}px ${RADIUS.card - 1}px`,
          background: `rgba(${ui.accentRgb}, 0.2)`,
          borderTop: `1px solid rgba(${ui.accentRgb}, 0.18)`,
          position: 'relative',
          zIndex: 2,
        }}>
        <span style={{fontSize: `${FONT_SIZES.base}px`, color: COLORS.descriptionText}}>
          <strong style={{color: COLORS.text, fontWeight: 600}}>{cardCount}</strong> cards ·{' '}
          <strong style={{color: COLORS.text, fontWeight: 600}}>{ruleCount}</strong>{' '}
          {ruleCount === 1 ? 'rule' : 'rules'}
        </span>
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            gap: isHovered ? 8 : 4,
            transition: 'gap 0.2s',
          }}>
          Explore →
        </span>
      </div>
    </PlaystyleCardShell>
  );
}

// ── Coming Soon Card ──

function ComingSoonCard({
  playstyle,
  layout,
  enableHover,
}: {
  playstyle: ComingSoonPlaystyle;
  layout: LayoutConfig;
  enableHover: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <PlaystyleCardShell
      accentColor={playstyle.accentColor}
      accentRgb={playstyle.accentRgb}
      coverArt={playstyle.coverArt}
      name={playstyle.name}
      description={playstyle.description}
      isHovered={false}
      onMouseEnter={enableHover ? () => setIsHovered(true) : undefined}
      onMouseLeave={enableHover ? () => setIsHovered(false) : undefined}
      layout={layout}
      cursor="default"
      descriptionFlex={1}
      opacity={isHovered ? 0.55 : 0.45}
    />
  );
}

// ── Section Divider ──

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: COLORS.surfaceBorder,
};

function SectionDivider({label, layout}: {label: string; layout: LayoutConfig}) {
  return (
    <div
      style={{
        gridColumn: layout.gridColumn,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: layout.dividerPadding,
      }}>
      <div style={dividerLineStyle} />
      <span
        style={{
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: COLORS.textMuted,
          whiteSpace: 'nowrap',
        }}>
        {label}
      </span>
      <div style={dividerLineStyle} />
    </div>
  );
}

// ── Page ──

const gridStyleDesktop: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))',
  gap: 16,
  padding: DESKTOP_LAYOUT.gridPadding,
};

const gridStyleMobile: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: MOBILE_LAYOUT.gridPadding,
};

export function PlaystyleGalleryPage() {
  const navigate = useNavigate();
  const {cards, isLoading, error, retryLoad} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const {isMobile} = useResponsive();

  const layout = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
  const enableHover = !isMobile;

  // Preload cover art images so CSS backgroundImage doesn't wait for render
  const coverArtUrls = useMemo(
    () => [
      ...Object.values(PLAYSTYLE_UI).map((ui) => ui.coverArt),
      ...COMING_SOON_PLAYSTYLES.map((ps) => ps.coverArt),
    ],
    [],
  );
  usePreloadImages(coverArtUrls);

  const goHome = useCallback(() => navigate('/'), [navigate]);

  const handleSearchSubmit = useCallback(() => {
    const q = searchQuery.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  }, [navigate, searchQuery]);

  const handleCardSelect = useCallback(
    (card: {id: string}) => navigate(`/card/${card.id}`),
    [navigate],
  );

  const {data: playstyleCardData} = useAllPlaystyleCards();

  const activePlaystyles = useMemo(() => {
    return getAllPlaystyles()
      .filter((ps) => {
        if (!PLAYSTYLE_UI[ps.id]) {
          console.error(`Missing PLAYSTYLE_UI entry for playstyle "${ps.id}"`);
          return false;
        }
        return true;
      })
      .map((ps) => {
        const ui = PLAYSTYLE_UI[ps.id];
        const ruleCount = getRulesByPlaystyle(ps.id).length;
        const psData = playstyleCardData.get(ps.id);
        return {
          playstyle: ps,
          ui,
          ruleCount,
          cardCount: psData?.count ?? 0,
          previewCards: psData?.previewCards ?? [],
        };
      });
  }, [playstyleCardData]);

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          fontFamily: FONTS.body,
          background: COLORS.background,
        }}>
        <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
          Failed to load card data.
        </p>
        <button
          onClick={retryLoad}
          style={{
            padding: '8px 20px',
            background: COLORS.primary,
            color: COLORS.background,
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: FONTS.body,
            fontWeight: 600,
          }}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
      }}>
      <EtherealBackground />
      <CompactHeader
        onLogoClick={goHome}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        cards={cards}
        onCardSelect={handleCardSelect}
        isMobile={isMobile}
      />

      <div style={{position: 'relative', zIndex: 1}}>
        {/* Page intro */}
        <div style={{padding: layout.pagePadding}}>
          <h1
            style={{
              fontSize: `${FONT_SIZES.xxl}px`,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: SPACING.sm,
            }}>
            Lorcana Playstyles
          </h1>
          <p
            style={{
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.descriptionText,
              lineHeight: 1.5,
              maxWidth: layout.maxSubtitleWidth,
              margin: 0,
            }}>
            Strategic archetypes that emerge when cards share a common gameplay pattern. Explore
            each playstyle to find cards that reinforce your strategy.
          </p>
        </div>

        {/* Grid */}
        <ErrorBoundary>
          {isLoading ? (
            <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
              <LoadingSpinner />
            </div>
          ) : (
            <div style={isMobile ? gridStyleMobile : gridStyleDesktop}>
              {/* Active playstyles */}
              {activePlaystyles.map(({playstyle, ui, ruleCount, cardCount, previewCards}) => (
                <ActivePlaystyleCard
                  key={playstyle.id}
                  playstyle={playstyle}
                  ui={ui}
                  cardCount={cardCount}
                  ruleCount={ruleCount}
                  previewCards={previewCards}
                  onClick={() => navigate(`/playstyles/${playstyle.id}`)}
                  layout={layout}
                  enableHover={enableHover}
                />
              ))}

              {/* Coming soon divider + cards */}
              {COMING_SOON_PLAYSTYLES.length > 0 && (
                <>
                  <SectionDivider label="Coming Soon" layout={layout} />
                  {COMING_SOON_PLAYSTYLES.map((ps) => (
                    <ComingSoonCard
                      key={ps.name}
                      playstyle={ps}
                      layout={layout}
                      enableHover={enableHover}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </ErrorBoundary>
      </div>
    </main>
  );
}
