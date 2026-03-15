import {useCallback, useState, useMemo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {chipStyle} from '../utils';
import {SynergyGroup} from './SynergyGroup';
import {ExpandedGroupView} from './ExpandedGroupView';
import {CardImage, CardLightbox} from '../../../shared/components';
import {COLORS, FONT_SIZES, FONTS, SPACING} from '../../../shared/constants';

interface MobileCardDetailProps {
  card: LorcanaCard;
  synergies: SynergyGroupData[];
  onBack: () => void;
  onSynergyCardClick?: (card: LorcanaCard) => void;
}

/** Mobile-only card detail view with inline synergy groups. */
export function MobileCardDetail({
  card,
  synergies,
  onBack,
  onSynergyCardClick,
}: MobileCardDetailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    if (!activeGroupFilter) return synergies;
    return synergies.filter((g) => g.groupKey === activeGroupFilter);
  }, [synergies, activeGroupFilter]);

  const expandedGroupData = expandedGroup
    ? synergies.find((g) => g.groupKey === expandedGroup)
    : null;

  const handleShowAll = useCallback((groupKey: string) => {
    setExpandedGroup(groupKey);
    setActiveGroupFilter(groupKey);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-expanded-group="${groupKey}"]`)
        ?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
  }, []);

  const handleBackToAll = useCallback(() => {
    setExpandedGroup(null);
    setActiveGroupFilter(null);
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
        overflowX: 'hidden',
      }}>
      {/* Ethereal glow orb */}
      <div
        style={{
          position: 'absolute',
          top: -50,
          left: -80,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Compact header */}
      <div
        style={{
          height: 48,
          background: 'linear-gradient(180deg, #0d0d14 0%, #1a1a2e 100%)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: SPACING.lg,
          borderBottom: `1px solid ${COLORS.surfaceBorder}`,
          position: 'sticky',
          top: 0,
          zIndex: 902,
        }}>
        <button
          onClick={onBack}
          aria-label="Back to home"
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.primary500,
            fontSize: FONT_SIZES.md,
            fontWeight: 700,
            letterSpacing: '0.96px',
            cursor: 'pointer',
            padding: `${SPACING.sm}px 0`,
            fontFamily: FONTS.body,
          }}>
          INKWEAVE
        </button>
      </div>

      <div style={{position: 'relative', zIndex: 1, padding: `${SPACING.lg}px`}}>
        {/* Card image — centered with gold glow border */}
        <div style={{display: 'flex', justifyContent: 'center', marginBottom: SPACING.lg}}>
          <button
            aria-label="Enlarge card image"
            onClick={() => card.imageUrl && setLightboxOpen(true)}
            style={{
              border: 'none',
              borderRadius: 12,
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
              background: 'none',
            }}>
            <CardImage
              src={card.imageUrl}
              alt={card.fullName}
              width={220}
              height={308}
              inkColor={card.ink}
              cost={card.cost}
              lazy={false}
              borderRadius={10}
            />
          </button>
        </div>

        {/* Card name + version */}
        <h1
          style={{
            textAlign: 'center',
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            lineHeight: 1.2,
          }}>
          {card.name}
        </h1>
        {card.version && (
          <div
            style={{
              textAlign: 'center',
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.textMuted,
              marginTop: 3,
            }}>
            {card.version}
          </div>
        )}

        {/* Synergy breakdown removed on mobile — cards grid below is sufficient */}

        {/* Synergy section */}
        {synergies.length > 0 && expandedGroupData ? (
          <div style={{marginTop: SPACING.lg}}>
            <ExpandedGroupView
              group={expandedGroupData}
              isMobile
              onBackToAll={handleBackToAll}
              onCardClick={onSynergyCardClick}
            />
          </div>
        ) : synergies.length > 0 ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: `${SPACING.lg}px 0 ${SPACING.sm}px`,
              }}>
              <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
              <h2
                style={{
                  margin: 0,
                  fontSize: `${FONT_SIZES.xl}px`,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: COLORS.text,
                }}>
                Synergies
              </h2>
              <div style={{flex: 1, height: 1, background: COLORS.surfaceBorder}} />
            </div>

            {/* Group chips — horizontal scroll */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '4px',
                marginBottom: SPACING.lg,
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
              }}>
              <button
                onClick={() => setActiveGroupFilter(null)}
                style={chipStyle(activeGroupFilter === null, true)}>
                All
              </button>
              {synergies.map((g) => (
                <button
                  key={g.groupKey}
                  onClick={() => setActiveGroupFilter(g.groupKey)}
                  style={chipStyle(activeGroupFilter === g.groupKey, true)}>
                  {g.label}
                </button>
              ))}
            </div>

            {/* Synergy groups */}
            {filteredGroups.map((group) => (
              <SynergyGroup
                key={group.groupKey}
                group={group}
                isMobile
                maxVisibleCards={group.category === 'direct' ? Infinity : 5}
                onShowAll={handleShowAll}
                onCardClick={onSynergyCardClick}
              />
            ))}
          </>
        ) : null}

        {/* Empty state */}
        {synergies.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              fontSize: FONT_SIZES.base,
              color: COLORS.textMuted,
              margin: `${SPACING.xxl}px 0`,
            }}>
            No synergies found for this card.
          </p>
        )}
      </div>

      {lightboxOpen && card.imageUrl && (
        <CardLightbox
          src={card.imageUrl}
          alt={card.fullName}
          isLocation={card.type === 'Location'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </main>
  );
}
