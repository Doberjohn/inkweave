import type {ReactNode} from 'react';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, SPACING, hexRgba} from '../constants';
import {CtaButton} from './CtaButton';

/**
 * The full-page notice scene shared by the 404 and the off-season /reveals page:
 * a centred column over a bespoke glow, an ink-tinted sparkle field and a brand
 * watermark, then an optional oversized hero mark, a gold divider, a hero-serif
 * title, exactly two prose lines and one CTA.
 *
 * The decorative layers are separate components rather than inline markup, which
 * is what keeps the composed scene under the Large Method threshold (#525 pushed
 * the 404's single-function form to 179 lines against a limit of 120).
 */

/**
 * Deliberately NOT shared with EtherealBackground: this glow is bespoke to the
 * notice scene (different size, gradient stops and offset), and unifying them
 * would change how the pages look.
 */
function EtherealGlow() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 600,
        height: 400,
        borderRadius: '50%',
        background: `radial-gradient(ellipse at center, ${hexRgba(INK_COLORS.Amethyst.border, 0.12)} 0%, ${hexRgba(COLORS.primary, 0.06)} 40%, transparent 70%)`,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -55%)',
        pointerEvents: 'none',
      }}
    />
  );
}

// Sparkle accents read from the tokens rather than copied values. The ink colours
// here were the OLD Amethyst/Emerald, orphaned by the 2026-07-30 repalette, and
// the golds were the legacy accent, converged to the one brand gold by owner
// ruling when this scene moved into a file the grandfather ledger does not cover.
// Naming no hex on purpose: the value gate greps literals and cannot tell a
// comment from code, so quoting one here would register as restating a token.
const SPARKLES = [
  {x: '19%', y: '22%', size: 3, color: COLORS.primary, opacity: 0.3},
  {x: '76%', y: '33%', size: 2, color: INK_COLORS.Amethyst.border, opacity: 0.25},
  {x: '24%', y: '75%', size: 4, color: COLORS.primary, opacity: 0.2},
  {x: '73%', y: '69%', size: 2.5, color: INK_COLORS.Amethyst.border, opacity: 0.2},
  {x: '35%', y: '17%', size: 2, color: COLORS.primary, opacity: 0.3},
  {x: '64%', y: '20%', size: 3, color: INK_COLORS.Emerald.border, opacity: 0.2},
];

function SparkleField() {
  return (
    <div
      aria-hidden="true"
      style={{position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden'}}>
      {SPARKLES.map((s, i) => (
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
  );
}

function BrandWatermark() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: SPACING.xxl,
        fontFamily: FONTS.hero,
        fontSize: `${FONT_SIZES.md}px`,
        letterSpacing: 4,
        color: hexRgba(COLORS.textMuted, 0.25),
      }}>
      INKWEAVE
    </span>
  );
}

/** The sparkle that leads the CTA on both pages. */
function SparkleIcon() {
  return (
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
  );
}

interface FullPageNoticeProps {
  /**
   * Oversized mark above the divider (the 404's numeral). Omit for a title-first
   * page. When present, this element carries the page's `<h1>`.
   */
  hero?: ReactNode;
  title: string;
  /**
   * Heading level for `title`. Defaults to 2 because the 404 supplies the page's
   * <h1> through `hero`; a consumer with no hero must pass 1, or its page ends up
   * with no h1 at all.
   */
  titleLevel?: 1 | 2;
  /** Exactly two lines; the second renders dimmer than the first. */
  lines: [string, string];
  ctaLabel: string;
  onCta: () => void;
}

function NoticeContent({hero, title, lines, ctaLabel, onCta, titleLevel = 2}: FullPageNoticeProps) {
  const Heading = titleLevel === 1 ? 'h1' : 'h2';
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: `0 ${SPACING.xl}px`,
      }}>
      {hero}
      <div
        aria-hidden="true"
        style={{
          width: 200,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, ${COLORS.primary} 50%, transparent 100%)`,
          marginTop: SPACING.xs,
        }}
      />
      <Heading
        style={{
          margin: 0,
          marginTop: SPACING.xxl,
          fontFamily: FONTS.hero,
          fontSize: `clamp(${FONT_SIZES.xxl}px, 4vw, 28px)`,
          fontWeight: 400,
          color: COLORS.text,
          letterSpacing: 2,
          textAlign: 'center',
        }}>
        {title}
      </Heading>
      <p
        style={{
          margin: 0,
          marginTop: SPACING.md,
          fontSize: `${FONT_SIZES.xl}px`,
          color: COLORS.textMuted,
          textAlign: 'center',
        }}>
        {lines[0]}
      </p>
      <p
        style={{
          margin: 0,
          marginTop: SPACING.sm,
          fontSize: `${FONT_SIZES.lg}px`,
          color: hexRgba(COLORS.textMuted, 0.5),
          textAlign: 'center',
        }}>
        {lines[1]}
      </p>
      <CtaButton onClick={onCta} style={{marginTop: 36}}>
        <SparkleIcon />
        {ctaLabel}
      </CtaButton>
    </div>
  );
}

export function FullPageNotice(props: FullPageNoticeProps) {
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
      <EtherealGlow />
      <SparkleField />
      <NoticeContent {...props} />
      <BrandWatermark />
    </main>
  );
}
