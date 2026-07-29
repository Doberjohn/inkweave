import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, Z_INDEX} from '../constants';

/**
 * Candidates for the hero/serif face. The first entry has an EMPTY stack: it clears
 * the override so `FONTS.hero`'s own fallback (the shipped face) applies — which
 * also keeps the incumbent's name out of this file, where restating a token value
 * would trip the design-token value gate.
 */
const CANDIDATES = [
  {label: 'Current (shipped)', stack: ''},
  {label: 'Cinzel', stack: "'Cinzel', 'Georgia', serif"},
  {label: 'Cormorant Garamond', stack: "'Cormorant Garamond', 'Georgia', serif"},
  {label: 'Playfair Display', stack: "'Playfair Display', 'Georgia', serif"},
  {label: 'Marcellus', stack: "'Marcellus', 'Georgia', serif"},
] as const;

const STORAGE_KEY = 'inkweave:devHeroFont';

/** Override the `--font-hero` custom property every heading reads; '' restores the default. */
function applyFont(stack: string) {
  const root = document.documentElement;
  if (stack === '') root.style.removeProperty('--font-hero');
  else root.style.setProperty('--font-hero', stack);
}

/**
 * DEV-ONLY hero-font trial (see index.css `--font-hero`). Floats over the app so
 * candidates can be judged on real screens rather than a specimen page: picking one
 * overrides the custom property that `FONTS.hero` resolves to, so every heading in
 * the app changes live. The choice persists across reloads.
 *
 * Temporary: delete this component, the losing @font-face blocks, and their .woff2
 * files once the replacement is chosen. Never rendered in production — AppLayout
 * mounts it behind `import.meta.env.DEV`.
 */
export function FontSwitcher() {
  const [active, setActive] = useState(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const match = CANDIDATES.find((c) => c.label === stored);
    if (match) applyFont(match.stack);
    return match?.label ?? CANDIDATES[0].label;
  });
  const [open, setOpen] = useState(false);

  const choose = (candidate: (typeof CANDIDATES)[number]) => {
    applyFont(candidate.stack);
    setActive(candidate.label);
    try {
      localStorage.setItem(STORAGE_KEY, candidate.label);
    } catch {
      // private mode: the trial just won't persist
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: SPACING.md,
        bottom: SPACING.md,
        zIndex: Z_INDEX.toast,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.md,
        padding: open ? SPACING.sm : 0,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.md}px`,
        boxShadow: `0 6px 20px ${COLORS.background}`,
      }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          appearance: 'none',
          background: 'transparent',
          border: 'none',
          color: COLORS.primary,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.sm}px`,
          padding: open ? `0 0 ${SPACING.xs}px` : `${SPACING.xs}px ${SPACING.sm}px`,
          cursor: 'pointer',
        }}>
        Aa {open ? '▾' : `· ${active}`}
      </button>

      {open && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 2, minWidth: 170}}>
          {CANDIDATES.map((candidate) => (
            <button
              key={candidate.label}
              type="button"
              onClick={() => choose(candidate)}
              style={{
                appearance: 'none',
                textAlign: 'left',
                background: candidate.label === active ? COLORS.surfaceHover : 'transparent',
                border: 'none',
                borderRadius: RADIUS.xs,
                color: candidate.label === active ? COLORS.primary : COLORS.textMuted,
                // Each entry previews its own face, so the list is its own specimen.
                fontFamily: candidate.stack,
                fontSize: `${FONT_SIZES.base}px`,
                padding: `4px ${SPACING.sm}px`,
                cursor: 'pointer',
              }}>
              {candidate.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
