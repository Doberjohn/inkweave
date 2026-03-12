import {useNavigate} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {CtaButton} from '../shared/components/CtaButton';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: FONTS.body,
        position: 'relative',
        overflow: 'hidden',
      }}>
      {/* Ethereal glow behind content */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 600,
          height: 400,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.12) 0%, rgba(212, 175, 55, 0.06) 40%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -55%)',
          pointerEvents: 'none',
        }}
      />

      {/* Sparkle particles */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}>
        {[
          {x: '19%', y: '22%', size: 3, color: COLORS.primary500, opacity: 0.3},
          {x: '76%', y: '33%', size: 2, color: '#8b5cf6', opacity: 0.25},
          {x: '24%', y: '75%', size: 4, color: COLORS.primary500, opacity: 0.2},
          {x: '73%', y: '69%', size: 2.5, color: '#8b5cf6', opacity: 0.2},
          {x: '35%', y: '17%', size: 2, color: COLORS.primary500, opacity: 0.3},
          {x: '64%', y: '20%', size: 3, color: '#10b981', opacity: 0.2},
        ].map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: s.color,
              opacity: s.opacity,
              boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `0 ${SPACING.xl}px`,
        }}>
        {/* 404 number */}
        <h1
          style={{
            margin: 0,
            fontFamily: FONTS.hero,
            fontSize: 'clamp(100px, 20vw, 180px)',
            fontWeight: 400,
            letterSpacing: 8,
            lineHeight: 1,
            background:
              'linear-gradient(180deg, #d4af37 0%, #ffb900 50%, rgba(212, 175, 55, 0.5) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
          404
        </h1>

        {/* Gold gradient divider */}
        <div
          aria-hidden="true"
          style={{
            width: 200,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)',
            marginTop: SPACING.xs,
          }}
        />

        {/* Title */}
        <h2
          style={{
            margin: 0,
            marginTop: SPACING.xxl,
            fontFamily: FONTS.hero,
            fontSize: `clamp(${FONT_SIZES.xxl}px, 4vw, 28px)`,
            fontWeight: 400,
            color: COLORS.text,
            letterSpacing: 2,
          }}>
          Lost in the Inkwell
        </h2>

        {/* Description */}
        <p
          style={{
            margin: 0,
            marginTop: SPACING.md,
            fontSize: `${FONT_SIZES.xl}px`,
            color: COLORS.textMuted,
            textAlign: 'center',
          }}>
          This page has vanished into the mists of Lorcana.
        </p>
        <p
          style={{
            margin: 0,
            marginTop: SPACING.sm,
            fontSize: `${FONT_SIZES.lg}px`,
            color: 'rgba(144, 161, 185, 0.5)',
            textAlign: 'center',
          }}>
          Perhaps it was banished, or simply never existed.
        </p>

        {/* CTA Button */}
        <CtaButton onClick={() => navigate('/')} style={{marginTop: 36}}>
          {/* Sparkle icon */}
          <svg
            width="16"
            height="16"
            viewBox="3.5 2 17 16"
            fill="none"
            aria-hidden="true"
            style={{flexShrink: 0}}>
            <path
              d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
              fill={COLORS.filterText}
              stroke={COLORS.filterText}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          Return to Inkweave
        </CtaButton>
      </div>

      {/* Brand watermark */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: SPACING.xxl,
          fontFamily: FONTS.hero,
          fontSize: `${FONT_SIZES.md}px`,
          letterSpacing: 4,
          color: 'rgba(144, 161, 185, 0.25)',
        }}>
        INKWEAVE
      </span>
    </main>
  );
}
