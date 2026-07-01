import type {CSSProperties} from 'react';
import './reveals.css';
import {FONTS} from '../../shared/constants';
import {hexToRgb} from '../../shared/constants/theme';

export interface SupportCard {
  src: string;
  alt: string;
}

/** A single rich spotlight: one hero card + a small fan of supporting cards. */
export interface SpotlightHeroData {
  accent: string;
  /** Optional two-color background wash (e.g. dual-ink cards); overrides the accent gradient. */
  accentGradient?: {from: string; to: string};
  isNew: boolean;
  /** Short label, e.g. "8 Vinelings" or "New keyword". */
  count: string;
  title: string;
  summary: string;
  /** CTA label; defaults to "View synergies →" (link) or "View cards →" (action). */
  cta?: string;
  href?: string;
  heroImage: string;
  heroAlt: string;
  /** 2-3 supporting cards fanned on the opposite side. */
  support: SupportCard[];
}

/** ★ NEW pill, tinted in the spotlight's accent. */
function NewBadge({accent}: {accent: string}) {
  const rgb = hexToRgb(accent);
  return (
    <span
      style={{
        display: 'inline-block',
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        color: accent,
        border: `1px solid rgba(${rgb}, 0.55)`,
        background: `rgba(${rgb}, 0.14)`,
        padding: '4px 10px',
        borderRadius: 20,
      }}
    >
      ★ New
    </span>
  );
}

/**
 * Overlapping fan of up to three supporting cards with slight size asymmetry
 * (front card largest). Base + hover transforms are passed as CSS variables so
 * the fan spreads open on hover (see reveals.css).
 */
function SupportFan({cards, accent, compact}: {cards: SupportCard[]; accent: string; compact: boolean}) {
  const rgb = hexToRgb(accent);
  const base = compact ? 62 : 92;
  const scales = [0.9, 1, 0.82];
  const rots = [-10, -1, 9];
  const lifts = [14, -10, 16];
  const spreads = [-14, 0, 14];
  return (
    <div className="reveal-rise reveal-rise-2" style={{display: 'flex', alignItems: 'center', flexShrink: 0, paddingRight: compact ? 0 : 8}}>
      {cards.slice(0, 3).map((c, i) => {
        const w = Math.round(base * (scales[i] ?? 0.85));
        const rot = rots[i] ?? 0;
        const lift = lifts[i] ?? 0;
        const spread = spreads[i] ?? 0;
        return (
          <div
            key={c.src}
            className="reveal-fan-card"
            style={
              {
                '--t': `rotate(${rot}deg) translateY(${lift}px)`,
                '--th': `rotate(${rot * 1.5}deg) translateY(${lift - 8}px) translateX(${spread}px) scale(1.06)`,
                width: w,
                height: Math.round(w * 1.4),
                marginLeft: i === 0 ? 0 : -Math.round(w * 0.5),
                borderRadius: 9,
                overflow: 'hidden',
                border: `1px solid rgba(${rgb}, 0.45)`,
                boxShadow: `0 10px 22px rgba(0, 0, 0, 0.55)`,
                background: '#0c0c15',
                zIndex: i === 1 ? 3 : i,
              } as CSSProperties
            }
          >
            <img src={c.src} alt={c.alt} loading="lazy" style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
          </div>
        );
      })}
    </div>
  );
}

/** Per-density layout values, resolved once from `compact` so the render body stays branch-free. */
interface SpotlightDims {
  heroW: number;
  heroT: string;
  heroTh: string;
  padding: string;
  gap: number;
  flexDirection: CSSProperties['flexDirection'];
  textAlign: CSSProperties['textAlign'];
  headerJustify: CSSProperties['justifyContent'];
  titleSize: number;
  summarySize: number;
}

const FULL_DIMS: SpotlightDims = {
  heroW: 188,
  heroT: 'perspective(1000px) rotateY(14deg) rotate(-4deg)',
  heroTh: 'perspective(1000px) rotateY(7deg) rotate(-2deg) translateY(-6px) scale(1.05)',
  padding: '30px 34px',
  gap: 36,
  flexDirection: 'row',
  textAlign: 'left',
  headerJustify: 'flex-start',
  titleSize: 27,
  summarySize: 14,
};

const COMPACT_DIMS: SpotlightDims = {
  heroW: 132,
  heroT: 'none',
  heroTh: 'translateY(-4px) scale(1.03)',
  padding: '22px 18px',
  gap: 14,
  flexDirection: 'column',
  textAlign: 'center',
  headerJustify: 'center',
  titleSize: 22,
  summarySize: 13,
};

/** Accent wash behind the hero: a two-color gradient for dual-ink spotlights, else a single-accent sweep. */
function washFor(rgb: string, grad?: {from: string; to: string}): string {
  if (grad) {
    const from = hexToRgb(grad.from);
    const to = hexToRgb(grad.to);
    return `linear-gradient(105deg, rgba(${from}, 0.32) 0%, rgba(${from}, 0.12) 34%, rgba(${to}, 0.14) 64%, rgba(${to}, 0.32) 100%), radial-gradient(520px 320px at 100% 40%, rgba(${to}, 0.18), transparent)`;
  }
  return `linear-gradient(110deg, rgba(${rgb}, 0.26), rgba(${rgb}, 0.06) 52%, transparent 78%), radial-gradient(560px 320px at 92% 130%, rgba(${rgb}, 0.22), transparent)`;
}

/** CTA label: caller-provided, else the sensible default for a link vs an action tile. */
function ctaLabel(data: SpotlightHeroData): string {
  return data.cta ?? (data.href ? 'View synergies →' : 'View cards →');
}

/** The shared hero + copy + fan interior, rendered inside whichever wrapper the tile needs. */
function SpotlightInner({data, dims, onActivate, compact}: {data: SpotlightHeroData; dims: SpotlightDims; onActivate?: () => void; compact: boolean}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: dims.gap,
        flexDirection: dims.flexDirection,
        textAlign: dims.textAlign,
      }}
    >
      <div className="reveal-rise" style={{flexShrink: 0}}>
        <div
          className="reveal-hero-card"
          style={
            {
              '--t': dims.heroT,
              '--th': dims.heroTh,
              width: dims.heroW,
              height: Math.round(dims.heroW * 1.4),
              borderRadius: 13,
              overflow: 'hidden',
              background: '#0c0c15',
            } as CSSProperties
          }
        >
          <img src={data.heroImage} alt={data.heroAlt} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
        </div>
      </div>

      <div className="reveal-rise reveal-rise-1" style={{flex: '0 1 auto', minWidth: 0, maxWidth: 460}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', justifyContent: dims.headerJustify}}>
          {data.isNew && <NewBadge accent={data.accent} />}
          <span style={{fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: '#90a1b9'}}>{data.count}</span>
        </div>
        <h3 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: dims.titleSize, color: '#f4f4f8', margin: '11px 0 0'}}>{data.title}</h3>
        <p style={{fontWeight: 400, fontSize: dims.summarySize, lineHeight: 1.55, color: '#d2d2de', margin: '9px 0 0', maxWidth: 420}}>{data.summary}</p>
        {(data.href || onActivate) && (
          <span style={{display: 'inline-block', marginTop: 13, fontSize: 13, fontWeight: 700, color: data.accent, letterSpacing: 0.3}}>
            {ctaLabel(data)}
          </span>
        )}
      </div>

      <SupportFan cards={data.support} accent={data.accent} compact={compact} />
    </div>
  );
}

/**
 * Cinematic spotlight: a large hero card tilted in pseudo-3D over a saturated
 * accent wash on the left, a fan of supporting cards on the right, and the
 * description between them. Hover straightens + lifts the hero and spreads the
 * fan; the whole tile is a link to the playstyle page when one exists.
 */
export function SpotlightHero({
  data,
  compact = false,
  onActivate,
}: {
  data: SpotlightHeroData;
  compact?: boolean;
  /** Click handler for action tiles (e.g. open a modal) when there is no href. */
  onActivate?: () => void;
}) {
  const rgb = hexToRgb(data.accent);
  const dims = compact ? COMPACT_DIMS : FULL_DIMS;

  const shell = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    border: `1px solid rgba(${rgb}, 0.4)`,
    background: '#0b0b12',
    backgroundImage: washFor(rgb, data.accentGradient),
    padding: dims.padding,
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    '--accent-rgb': rgb,
  } as CSSProperties;

  const inner = <SpotlightInner data={data} dims={dims} onActivate={onActivate} compact={compact} />;

  if (data.href) {
    return (
      <a href={data.href} className="reveal-spotlight-hero" aria-label={`${data.title}: view synergies`} style={shell}>
        {inner}
      </a>
    );
  }
  if (onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="reveal-spotlight-hero"
        aria-label={`View ${data.title} cards`}
        style={{...shell, appearance: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%'}}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="reveal-spotlight-hero" style={shell}>
      {inner}
    </div>
  );
}
