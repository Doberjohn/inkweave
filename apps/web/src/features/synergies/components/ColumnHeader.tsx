import type {ReactNode} from 'react';
import {Tooltip} from '../../../shared/components';
import {COLORS, FONTS, SPACING} from '../../../shared/constants';

interface ColumnHeaderProps {
  title: string;
  accentColor: string;
  score: string;
  scoreColor: string;
  scoreFontSize: number;
  showScale: boolean;
  meta: ReactNode;
  /** Optional tooltip-shown ("?" info button next to score). Used by EngineColumn for tier explainer. */
  scoreTooltip?: string;
}

export function ColumnHeader({
  title,
  accentColor,
  score,
  scoreColor,
  scoreFontSize,
  showScale,
  meta,
  scoreTooltip,
}: ColumnHeaderProps) {
  return (
    <header
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        marginBottom: SPACING.section,
        paddingBottom: SPACING.section,
        position: 'relative',
      }}>
      <h3
        style={{
          gridColumn: 2,
          margin: 0,
          // Match the modal h1 (card name) treatment: Plus Jakarta Sans, 22px / 700.
          // Bigger than the mockup's 17px on user's request — column titles are the second
          // most important readout in the focused state and earned more visual weight.
          fontFamily: FONTS.body,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.02em',
          textAlign: 'center',
          lineHeight: 1.15,
          color: accentColor,
        }}>
        {title}
      </h3>
      <div
        style={{
          gridColumn: 3,
          justifySelf: 'end',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          // Mockup phase 2 `.score-col-stats { gap: 8px }` — sets the score-line vs meta-line spacing.
          gap: 8,
        }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
            whiteSpace: 'nowrap',
          }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: scoreFontSize,
              color: scoreColor,
              lineHeight: 1,
            }}>
            {score}
          </span>
          {showScale && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.textMuted,
                marginLeft: 2,
              }}>
              / 10
            </span>
          )}
          {scoreTooltip && (
            <Tooltip content={scoreTooltip} triggerStyle={{alignSelf: 'center', marginLeft: 6}}>
              <button
                type="button"
                aria-label="What does this score mean?"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'rgba(212, 175, 55, 0.06)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: 'rgba(212, 175, 55, 0.85)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'help',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  padding: 0,
                }}>
                ?
              </button>
            </Tooltip>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            color: COLORS.textMuted,
          }}>
          {meta}
        </div>
      </div>
      {/* Gradient divider — absolutely positioned at the bottom of the header so it sits inside
          padding-bottom without taking grid-row height (mockup phase 2 uses `::after` for this). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor} 50%, transparent)`,
        }}
      />
    </header>
  );
}
