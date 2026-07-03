import {useState} from 'react';
import {COLORS, EASING, FONT_SIZES, FONTS, INK_COLORS, RADIUS, SPACING, hexRgba} from '../../shared/constants';
import type {Breakdown, VercelAnalytics, VercelEvent} from './vercelAnalyticsTypes';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-06-29" -> "Jun 29" (deterministic, no locale/Date parsing). */
function shortDate(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** eventData props that carry an ink name, so their breakdown bars take the ink's own color. */
const INK_PROPS = new Set(['ink', 'clickedCardInk', 'cardAInk', 'cardBInk']);
function barColor(prop: string, value: string): string {
  const inks = INK_COLORS as Record<string, {border: string} | undefined>;
  if (INK_PROPS.has(prop) && inks[value]) return inks[value]!.border;
  return COLORS.primary;
}

/**
 * Scoped styles for the tab. The app is inline-style-first, but a small style block
 * buys us :hover / :focus-visible, a responsive master-detail grid (media query), and
 * a staggered entrance, none of which inline styles can express.
 */
const STYLES = `
.wa-head{display:flex;justify-content:space-between;align-items:flex-end;gap:${SPACING.lg}px;flex-wrap:wrap;padding-bottom:${SPACING.md}px;border-bottom:1px solid ${COLORS.surfaceBorder};margin-bottom:${SPACING.xl}px;}
.wa-eyebrow{font-size:${FONT_SIZES.xs}px;letter-spacing:.14em;text-transform:uppercase;color:${COLORS.textDim};margin-bottom:${SPACING.sm}px;}
.wa-kpi{font-family:${FONTS.hero};font-size:30px;line-height:1;font-weight:700;color:${COLORS.primary};}
.wa-kpi-sub{font-size:${FONT_SIZES.base}px;color:${COLORS.textMuted};margin-top:${SPACING.xs}px;}
.wa-win{font-size:${FONT_SIZES.sm}px;color:${COLORS.textDim};text-align:right;}
.wa-win strong{display:block;margin-top:2px;font-size:${FONT_SIZES.base}px;font-weight:600;color:${COLORS.textMuted};}
.wa-body{display:grid;grid-template-columns:minmax(0,240px) 1fr;gap:${SPACING.xl}px;align-items:start;}
@media(max-width:720px){.wa-body{grid-template-columns:1fr;}}
.wa-rail{display:flex;flex-direction:column;gap:2px;}
.wa-rail-h{font-size:${FONT_SIZES.xs}px;letter-spacing:.12em;text-transform:uppercase;color:${COLORS.textDim};padding:0 ${SPACING.sm}px ${SPACING.xs}px;}
.wa-row{display:grid;grid-template-columns:1fr auto;align-items:center;gap:${SPACING.sm}px;width:100%;text-align:left;background:transparent;border:none;border-left:2px solid transparent;border-radius:${RADIUS.md}px;padding:9px ${SPACING.sm}px;cursor:pointer;color:${COLORS.textMuted};font-family:${FONTS.body};font-size:${FONT_SIZES.base}px;transition:background .2s ${EASING.snappy},color .2s;}
.wa-row:hover{background:${COLORS.surfaceHover};color:${COLORS.text};}
.wa-row:focus-visible{outline:2px solid ${COLORS.primary};outline-offset:2px;}
.wa-row[aria-current="true"]{background:${COLORS.surfaceAlt};border-left-color:${COLORS.primary};color:${COLORS.text};}
.wa-row-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wa-row-total{font-variant-numeric:tabular-nums;opacity:.8;}
.wa-row[aria-current="true"] .wa-row-total{color:${COLORS.primary};opacity:1;}
.wa-detail{background:${COLORS.surface};border:1px solid ${COLORS.surfaceBorder};border-radius:${RADIUS.card}px;padding:${SPACING.xl}px;}
.wa-dnum{font-family:${FONTS.hero};font-size:28px;line-height:1;font-weight:700;color:${COLORS.primary};}
.wa-block-h{font-size:${FONT_SIZES.xs}px;letter-spacing:.12em;text-transform:uppercase;color:${COLORS.textMuted};margin:${SPACING.lg}px 0 ${SPACING.xs}px;}
.wa-brow{position:relative;display:grid;grid-template-columns:1fr auto;align-items:center;gap:${SPACING.sm}px;padding:6px ${SPACING.sm}px;border-radius:${RADIUS.sm}px;overflow:hidden;}
.wa-bfill{position:absolute;top:0;bottom:0;left:0;border-radius:${RADIUS.sm}px;}
.wa-blabel,.wa-bval{position:relative;z-index:1;font-size:${FONT_SIZES.base}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wa-blabel{color:${COLORS.text};}
.wa-bval{color:${COLORS.textMuted};font-variant-numeric:tabular-nums;}
.wa-in{animation:wa-in .34s ${EASING.smooth} both;}
@keyframes wa-in{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
`;

/** Slim line sparkline with a faint area fill; stretches to its container width. */
function Sparkline({data}: {data: number[]}) {
  if (data.length < 2) return null;
  const H = 56;
  const W = 100;
  const max = Math.max(1, ...data);
  const stepX = W / (data.length - 1);
  const pts = data.map((v, i) => `${(i * stepX).toFixed(2)},${(H - 4 - (v / max) * (H - 8)).toFixed(2)}`);
  const line = pts.join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{display: 'block', marginTop: SPACING.md}}>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={hexRgba(COLORS.primary, 0.1)} />
      <polyline
        points={line}
        fill="none"
        stroke={COLORS.primary}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** One grouped breakdown: label plus rows whose subtle background fill encodes each value's share. */
function BreakdownBlock({breakdown}: {breakdown: Breakdown}) {
  const sum = breakdown.rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div>
      <div className="wa-block-h">{breakdown.label}</div>
      {breakdown.rows.length === 0 ? (
        <div style={{fontSize: FONT_SIZES.base, color: COLORS.textDim, padding: `2px ${SPACING.sm}px`}}>
          No data in window.
        </div>
      ) : (
        breakdown.rows.map((r) => {
          const pct = Math.round((r.count / sum) * 100);
          return (
            <div className="wa-brow" key={r.value} title={`${r.value}: ${fmt(r.count)} (${pct}%)`}>
              <div className="wa-bfill" style={{width: `${pct}%`, background: hexRgba(barColor(breakdown.prop, r.value), 0.16)}} />
              <span className="wa-blabel">{r.value}</span>
              <span className="wa-bval">
                {fmt(r.count)} · {pct}%
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

/** The focused event: headline total, trend sparkline, and each configured breakdown. */
function EventDetail({event}: {event: VercelEvent}) {
  return (
    <div className="wa-detail wa-in" key={event.name}>
      <div style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, marginBottom: SPACING.sm}}>{event.label}</div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: SPACING.sm, flexWrap: 'wrap'}}>
        <span className="wa-dnum">{fmt(event.total)}</span>
        <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted}}>events</span>
        <span style={{fontSize: FONT_SIZES.base, color: COLORS.textDim}}>· {fmt(event.visitors)} visitors</span>
      </div>
      {event.trend.length >= 2 && <Sparkline data={event.trend.map((t) => t.count)} />}
      {event.breakdowns.length === 0 ? (
        <div style={{fontSize: FONT_SIZES.base, color: COLORS.textDim, marginTop: SPACING.lg}}>
          No property breakdowns configured for this event.
        </div>
      ) : (
        event.breakdowns.map((b) => <BreakdownBlock key={b.prop} breakdown={b} />)
      )}
    </div>
  );
}

/** Shown when the artifact reports hasVercelData: false (no token at build time). */
function NoVercelDataNotice() {
  return (
    <section
      style={{
        background: COLORS.surfaceAlt,
        border: `1px dashed ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        fontSize: FONT_SIZES.base,
        color: COLORS.textMuted,
      }}>
      Web Analytics needs a Vercel access token at build time. Set{' '}
      <code style={{color: COLORS.primary}}>VERCEL_ANALYTICS_TOKEN</code> and{' '}
      <code style={{color: COLORS.primary}}>VERCEL_PROJECT_ID</code> in the build env and re-run{' '}
      <code style={{color: COLORS.primary}}>pnpm precompute-vercel-analytics</code> to populate this tab.
    </section>
  );
}

interface WebAnalyticsViewProps {
  analytics: VercelAnalytics | null;
}

/**
 * The Web Analytics tab: a master-detail read of Vercel Web Analytics custom events.
 * The left rail lists events by volume; the right panel focuses one event's total,
 * daily trend, and eventData breakdowns. Data arrives via props (fetched by the page)
 * so Storybook renders it from fixtures. `null` = artifact still loading.
 */
export function WebAnalyticsView({analytics}: WebAnalyticsViewProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);

  if (!analytics) return <p style={{color: COLORS.textMuted}}>Loading Web Analytics...</p>;
  if (!analytics.hasVercelData) return <NoVercelDataNotice />;

  const events = [...analytics.events].sort((a, b) => b.total - a.total);
  if (events.length === 0) return <p style={{color: COLORS.textMuted}}>No events tracked yet.</p>;

  const totalTracked = events.reduce((s, e) => s + e.total, 0);
  const selected = events.find((e) => e.name === selectedName) ?? events[0];
  const {reportingWindow} = analytics;

  return (
    <div>
      <style>{STYLES}</style>

      <div className="wa-head">
        <div>
          <div className="wa-eyebrow">Custom events</div>
          <div className="wa-kpi">{fmt(totalTracked)}</div>
          <div className="wa-kpi-sub">tracked across {events.length} event types</div>
        </div>
        {reportingWindow && (
          <div className="wa-win">
            trends and breakdowns
            <strong>
              {shortDate(reportingWindow.since)} to {shortDate(reportingWindow.until)}
            </strong>
          </div>
        )}
      </div>

      <div className="wa-body">
        <div className="wa-rail" aria-label="Tracked events">
          <div className="wa-rail-h">Event</div>
          {events.map((e, i) => (
            <button
              key={e.name}
              type="button"
              aria-current={e.name === selected.name}
              onClick={() => setSelectedName(e.name)}
              className="wa-row wa-in"
              style={{animationDelay: `${i * 24}ms`}}>
              <span className="wa-row-label">{e.label}</span>
              <span className="wa-row-total">{fmt(e.total)}</span>
            </button>
          ))}
        </div>

        <EventDetail event={selected} />
      </div>
    </div>
  );
}
