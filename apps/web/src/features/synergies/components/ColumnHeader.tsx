import type {ReactNode} from 'react';
import {COLORS, FONTS} from '../../../shared/constants';

interface ColumnHeaderProps {
  title: string;
  accentColor: string;
  score: string;
  scoreColor: string;
  scoreFontSize: number;
  showScale: boolean;
  meta: ReactNode;
}

export function ColumnHeader({
  title,
  accentColor,
  score,
  scoreColor,
  scoreFontSize,
  showScale,
  meta,
}: ColumnHeaderProps) {
  return (
    <header
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 14,
        position: 'relative',
      }}>
      <h3
        style={{
          gridColumn: 2,
          margin: 0,
          fontFamily: FONTS.hero,
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '0.04em',
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
          gap: 4,
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
      <div
        aria-hidden="true"
        style={{
          gridColumn: '1 / -1',
          gridRow: 2,
          height: 1,
          marginTop: 14,
          background: `linear-gradient(90deg, transparent, ${accentColor} 50%, transparent)`,
        }}
      />
    </header>
  );
}
