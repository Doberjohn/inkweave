import type {Ink, CardType} from 'inkweave-synergy-engine';

// App branding
export const APP_NAME = 'Inkweave';

/**
 * Ink color styling. Each ink carries three values off ONE hue:
 * - `border` is the ink's **canonical solid colour**, and is misnamed: it is read
 *   as a FILL far more often than as a border (the cost-curve bands' background,
 *   bar glows, reveals tints via `inkTint.inkRgb`, playstyle accents, spotlight
 *   gradients). Treat it as "the ink colour"; renaming it is a separate sweep.
 * - `bg` is the dark chip/surface tint: same hue, L 15%, saturation ~60% of the
 *   canonical's.
 * - `text` is the readable-on-`bg` tint: same hue, L 68%, saturation ~95% of the
 *   canonical's. Every `text`/`bg` pair clears 5.6:1, and every `text` clears
 *   6.6:1 on `COLORS.background`.
 *
 * Values are the official Lorcana ink-symbol tones (2026-07-30 ruling), replacing
 * the previous bright Tailwind-ish set. Amethyst is the one adjustment: the symbol's
 * own mid-tone (`#64296b`) rendered at 1.9:1 and looked unlit beside its siblings on
 * the playstyles gallery, so it is lifted to 3.1:1 — matching Ruby, keeping the hue,
 * still a deep purple rather than a pastel. Amethyst and Ruby remain the two darkest
 * canonicals and should not carry small text directly.
 */
export const INK_COLORS: Record<Ink, {bg: string; text: string; border: string}> = {
  Amber: {bg: '#3d2c0f', text: '#f7c164', border: '#e69200'},
  Amethyst: {bg: '#2f1c31', text: '#ca8bd0', border: '#933b9b'},
  Emerald: {bg: '#133a1d', text: '#6bf08e', border: '#0c9d32'},
  Ruby: {bg: '#371518', text: '#e7747e', border: '#c31d2b'},
  Sapphire: {bg: '#0f323d', text: '#64d3f7', border: '#0096c7'},
  Steel: {bg: '#22272b', text: '#a5afb6', border: '#7d8c96'},
};

// Font families
export const FONTS = {
  body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  // Resolves to the `--font-hero` custom property declared in index.css, so the
  // app's serif is swapped in ONE place instead of hunting 18 files (and the dev
  // font switcher can trial candidates at runtime). Safe as a var(): every
  // consumer puts this into CSS (a style prop or a cssText string), never canvas.
  hero: "var(--font-hero, 'Marcellus', 'Georgia', serif)",
} as const;

// Layout constants
export const LAYOUT = {
  sidebarWidth: 480,
  headerHeight: 56,
  // Desktop only. Seven other sites derive sticky offsets and calc(100vh - …)
  // from this, so the single token is the whole change.
  compactHeaderHeight: 70,
  compactHeaderHeightMobile: 48,
  cardDetailWidth: 330,
  selectedCardImageWidth: 120,
  maxDisplayedCards: 204,
  /** CardGrid auto-fill minimum column width on desktop. Used by BrowseCardGrid + the shared CardGrid component. */
  cardGridMinWidth: 180,
  /** CardGrid auto-fill minimum column width on mobile. Lower so phones ≥360px viewport fit 2 columns. */
  cardGridMinWidthMobile: 140,
  synergyCardMinWidth: 160,
} as const;

// Spacing scale.
// xs..xxxl are a 4-multiple size ladder for general-purpose padding/gap.
// `xxs` is the sanctioned hairline half-step (2px separations); it is the ONLY
// sub-4 value — 6px and 10px are ruled out (2026-07-22 ruling: the 4-multiple
// principle stands; raw 6/10 converge to 4/8 and 8/12 when touched).
// `section` is the panel-rhythm value used for outer column gaps and the
// breathing room between major sections within a panel (header, content,
// CTA). It sits between md (12) and lg (16) and is referenced by mockup
// phase 2 as `.vote-section.combined-vote { gap: 14px }`.
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 14,
} as const;

// Border radius scale. `pill` is the fully-rounded idiom for chips/badges/nav
// pills (2026-07-22 ruling; replaces raw 999/20/18/10 literals).
export const RADIUS = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  card: 12,
  xl: 14,
  /** Bottom-sheet top corners — composed as `${RADIUS.sheet}px ${RADIUS.sheet}px 0 0` (#511 Wave-2 ruling). */
  sheet: 24,
  pill: 999,
} as const;

/**
 * Spring easing curves using CSS linear() timing function.
 * These replace mechanical ease/ease-out with physics-based motion.
 * Generated from spring parameters (stiffness, damping, mass).
 * Browser support: 88%+ (all major browsers since Dec 2023).
 */
export const EASING = {
  /** Gentle overshoot then settle. For selection commits and press feedback (the "it landed" moments). */
  bounce: 'linear(0, 0.004, 0.016, 0.035, 0.063, 0.098, 0.141, 0.191, 0.25, 0.316, 0.391, 0.472, 0.562, 0.66, 0.765, 0.878, 1, 1.029, 1.049, 1.061, 1.066, 1.064, 1.055, 1.042, 1.026, 1.008, 0.99, 0.974, 0.96, 0.95, 0.943, 0.94, 0.941, 0.946, 0.953, 0.963, 0.975, 0.987, 1)',
  /** Quick, minimal overshoot. For hover effects, fast transitions, tab switching (the de-facto hover standard; doc corrected 2026-07-22 to match usage). */
  snappy: 'linear(0, 0.11, 0.342, 0.562, 0.733, 0.858, 0.942, 0.992, 1.018, 1.026, 1.022, 1.012, 1.004, 0.998, 0.997, 0.999, 1)',
  /** Smooth deceleration, no overshoot. For fades, progress bars, subtle shifts. */
  smooth: 'linear(0, 0.064, 0.178, 0.324, 0.478, 0.621, 0.74, 0.833, 0.902, 0.95, 0.979, 0.995, 1)',
} as const;

/**
 * Transition durations, in milliseconds (2026-07-29 ruling). EASING tokenized
 * the CURVE; this is the other half of every transition, which was 18 distinct
 * values across 48 files — and three of the top four were spelled BOTH ways
 * (`0.25s` x20 alongside `250ms` x11). Milliseconds is the one spelling, to
 * match the `FLIP_DURATION` / `*_MS` consts already in the code.
 *
 * Three steps, deliberately. The 31 uses of 250ms converge to `base` or `slow`
 * when their file is next touched, on the same principle as the 4-multiple
 * spacing ruling: a step nobody can feel is a choice nobody should have to make.
 *
 * SCOPE: UI transitions and hovers only. Decorative infinite animations
 * (`reveal-floatY 4s`, `idv-shimmer 2.5s`) and FLIP/handoff choreography
 * (480ms, 1000ms) are cross-component or narrative timings, not system values —
 * they stay literal and named at their call site.
 */
export const DURATION = {
  /** Hover, press, small state flips. */
  fast: 150,
  /** The default: most transitions and fades. */
  base: 200,
  /** Larger moves — panels, expands, progress. */
  slow: 300,
} as const;

// Typography. The display tier (2026-07-22 ruling) covers hero numerals and
// display headings above the 22px body ceiling; raw 30/32/44 converge to the
// nearest step when touched. The dev-only banner tool's 68 stays exempt.
export const FONT_SIZES = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 16,
  xxl: 20,
  xxxl: 22,
  displaySm: 28,
  displayMd: 38,
  displayLg: 52,
} as const;

// Dark fantasy color palette
export const COLORS = {
  // Dark backgrounds
  background: '#0d0d14',
  surface: '#1a1a2e',
  surfaceHover: '#252540',
  surfaceAlt: '#151525',
  surfaceBorder: '#333355',

  // Elevation ladder (2026-07-22 ruling): on this near-black ground, black
  // drop-shadows barely read, so ELEVATION IS LIGHTNESS — higher surfaces get
  // lighter fills, with SHADOWS.* as soft secondary cues. rest = `surface`.
  surfaceRaised: '#1e1e35', // one step up (equals gray100 by design)
  surfaceFloating: '#222240', // floating cards/previews
  surfaceOverlay: '#252545', // top elevation: modal/panel fills

  // Overlay scrims (2026-07-22 ruling): the blue-black dialog scrim, and the
  // deeper pure-black variant for image lightboxes. Solid colors only — never
  // backdrop-filter (WebKit E2E repaint trap, #444/#445).
  scrim: 'rgba(4, 4, 10, 0.72)',
  scrimHeavy: 'rgba(0, 0, 0, 0.85)',

  // Primary accent (gold)
  primary: '#ffb900',
  primaryHover: '#ffc933',
  primaryMuted: '#d49a00',

  // Text
  text: '#e8e8e8',
  textMuted: '#90a1b9',
  textDim: '#666680',

  // Semantic
  white: '#e8e8e8',
  error: '#ef4444',
  errorBg: '#2a1515',
  errorBorder: '#5c2020',
  success: '#4ade80',
  successBg: '#152a15',

  // Gray scale (remapped for dark theme)
  gray50: '#1a1a2e',
  gray100: '#1e1e35',
  gray200: '#333355',
  gray300: '#444466',
  gray400: '#8888aa',
  gray500: '#8888aa',
  gray600: '#aaaacc',
  gray700: '#ccccdd',
  gray800: '#e8e8e8',
  gray900: '#f0f0f5',

  // Primary shades (gold-based for dark theme).
  // ONE-GOLD RULING (2026-07-22): `primary` #ffb900 is THE brand gold — glows,
  // rings, and new accents use it (via hexRgba/SHADOWS). The classic #d4af37
  // below is the LEGACY accent: existing uses are grandfathered, new work
  // should not reach for it.
  primary100: '#2a2515',
  primary200: '#3d3520',
  primary500: '#d4af37',
  primary600: '#d4af37',
  primary700: '#b8962e',

  // Backgrounds
  headerGradientStart: '#0d0d14',
  headerGradientEnd: '#1a1a2e',

  // Hero section
  heroTitle: '#ffffff',
  heroSubtitle: '#cad5e2',
  heroGradient: 'linear-gradient(90deg, #bedBff 0%, #e9d4ff 50%, #fcCEe8 100%)',

  // Search / Filter bar
  searchBg: 'rgba(15, 23, 43, 0.5)',
  searchBorder: 'rgba(49, 65, 88, 0.5)',
  /** Magnifier-glyph stroke. Placeholder TEXT is styled in index.css, not here. */
  searchIcon: '#90a1b9',
  filterGradient: 'linear-gradient(90deg, #fe9a00, #e17100)',
  filterText: '#0f172b',
  filterShadow: '0px 10px 15px 0px rgba(254,154,0,0.2), 0px 4px 6px 0px rgba(254,154,0,0.2)',

  // Featured section
  featuredLabel: '#90a1b9',
  featuredDivider: '#314158',

  // Synergy panel
  calloutBg: '#2a2515',
  descriptionText: '#c8c8d8',
  sortBg: '#1e1e35',

  // Ethereal glow orbs
  etherealBlue: 'rgba(43, 127, 255, 0.1)',
  etherealPurple: 'rgba(173, 70, 255, 0.1)',
  etherealTeal: 'rgba(0, 187, 167, 0.05)',

  // Lorcana ability box (cream surface + dark name tag — used by AbilityTag, AbilityCallout, ConnectionGroup, SynergyGroup)
  lorcanaCream: '#f1cd82',
  lorcanaTagBg: '#59432b',
  lorcanaTextDark: '#2a1f12',
  lorcanaTagText: '#f5e6c8',
  lorcanaCardLink: '#7a4d18',
} as const;

// All inks for iteration
export const ALL_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

// Known set codes
export type SetCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13';

// Set abbreviations (keyed by setCode)
export const SET_ABBREVIATIONS: Record<SetCode, string> = {
  '1': '1TFC',
  '2': '2ROF',
  '3': '3INK',
  '4': '4URS',
  '5': '5SSK',
  '6': '6ARI',
  '7': '7AZS',
  '8': '8JAF',
  '9': '9FAB',
  '10': '10WHI',
  '11': '11WSP',
  '12': '12WIL',
  '13': '13AVN',
} as const;

// Set full names (keyed by setCode)
export const SET_NAMES: Record<SetCode, string> = {
  '1': 'The First Chapter',
  '2': 'Rise of the Floodborn',
  '3': 'Into the Inklands',
  '4': "Ursula's Return",
  '5': 'Shimmering Skies',
  '6': "Archazia's Island",
  '7': 'Azurite Sea',
  '8': 'The Reign of Jafar',
  '9': 'Fabled',
  '10': 'Whispers in the Well',
  '11': 'Winterspell',
  '12': 'The Wilds Unknown',
  '13': 'Attack of the Vine!',
} as const;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

// Below this viewport width the inline cost-filter group (the widest inline
// toolbar control at ~482px) tucks into the Filters dialog so the toolbar stays
// one row alongside the 300px search box; ink + inkable icons are compact enough
// to remain. Math: Filters(86) + search(300) + full icon group(1106) + gaps +
// side padding needs ~1580px for one row; dropping cost frees ~493px → fits ~1075px.
export const INLINE_COST_FILTER_MIN_WIDTH = 1580;

// Z-index scale for layering
export const Z_INDEX = {
  /** Persistent promo/notice cards (BetaNotice, RevealsPromoCard) — float over content, yield to nav + overlays. */
  promo: 800,
  autocomplete: 900,
  /** Persistent app navigation chrome (mobile bottom nav) — above content, below overlays (#511 Wave-2 ruling). */
  nav: 900,
  modalBackdrop: 999,
  modal: 1000,
  popoverBackdrop: 1099,
  popover: 1100,
  /** Toasts sit above every overlay so confirmations survive open modals (2026-07-22; replaces raw 900/9999). */
  toast: 1200,
  /** The service-worker update prompt outranks everything, including toasts. */
  swUpdate: 1300,
} as const;

// Card type filter options (includes "Song" pseudo-type for UI filtering)
export type CardTypeFilter = CardType | 'Song';
export const CARD_TYPE_FILTERS: CardTypeFilter[] = [
  'Character',
  'Action',
  'Song',
  'Item',
  'Location',
];

// Shared select styles (dark theme)
export const SELECT_STYLE_SM: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: `${RADIUS.md}px`,
  border: `1px solid ${COLORS.surfaceBorder}`,
  fontSize: `${FONT_SIZES.sm}px`,
  fontFamily: FONTS.body,
  background: COLORS.gray100,
  color: COLORS.text,
  cursor: 'pointer',
};

export const SELECT_STYLE_MD: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: `${RADIUS.lg}px`,
  border: `1px solid ${COLORS.surfaceBorder}`,
  fontSize: `${FONT_SIZES.base}px`,
  fontFamily: FONTS.body,
  background: COLORS.gray100,
  color: COLORS.text,
  cursor: 'pointer',
  minHeight: '44px',
};

// Ink cost values for filter buttons
export const COST_BUTTONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Convert a hex color (#rrggbb) to "r, g, b" string for use in rgba() */
export const hexToRgb = (hex: string) =>
  `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;

/** Convert a hex color (#rrggbb) to rgba with the given alpha */
export const hexRgba = (hex: string, a: number) => `rgba(${hexToRgb(hex)}, ${a})`;

/** Black at the given alpha — for scrims, insets, and neutral shadows with no hue. */
export const blackRgba = (a: number) => `rgba(0, 0, 0, ${a})`;

/** White at the given alpha — for top-light highlights and subtle overlays. */
export const whiteRgba = (a: number) => `rgba(255, 255, 255, ${a})`;

/**
 * A colored glow shadow for DYNAMIC accents (ink colors, tier colors) that no
 * static token can cover. Fixed-color gold glows should use SHADOWS.glow* instead.
 */
export const glow = (color: string, size = 16) => `0 0 ${size}px ${color}`;

/**
 * Shadow recipes (2026-07-22 ruling). On the near-black ground, ELEVATION IS
 * LIGHTNESS (see COLORS.surfaceRaised/Floating/Overlay); these shadows are the
 * soft secondary cues plus the gold glow language. Gold members use
 * COLORS.primary per the one-gold ruling.
 */
export const SHADOWS = {
  /** Subtle resting lift for chips/tiles overlapping content. */
  raise: `0 2px 6px ${blackRgba(0.4)}`,
  /** Tooltips, toasts, hover-lifted tiles. */
  float: `0 6px 18px ${blackRgba(0.4)}`,
  /** Featured cards and fan tiles. */
  card: `0 10px 22px ${blackRgba(0.5)}`,
  /** Floating panels and previews. */
  panel: `0 16px 48px ${blackRgba(0.5)}`,
  /** Modal/dialog panels (soft negative spread). */
  overlay: `0 24px 60px -20px ${blackRgba(0.7)}`,
  /** Bottom sheets rising from below. */
  sheet: `0 -8px 32px ${blackRgba(0.6)}`,
  /** Composable faint 1px gold ring for overlay panels that want the accent: `${SHADOWS.overlay}, ${SHADOWS.goldRing}`. */
  goldRing: `0 0 0 1px ${hexRgba(COLORS.primary, 0.1)}`,
  /** Small gold glow: markers, badges, focus accents. */
  glowSm: `0 0 8px ${hexRgba(COLORS.primary, 0.35)}`,
  /** Medium gold glow: selection highlight. */
  glowMd: `0 0 16px 2px ${hexRgba(COLORS.primary, 0.45)}`,
  /** Large gold glow: hero/lightbox aura. */
  glowLg: `0 0 30px ${hexRgba(COLORS.primary, 0.3)}`,
} as const;

/**
 * Synergy-strength tier palette (2026-07-22 ruling: promoted from
 * scoreUtils.ts, where these hexes were the de-facto standard re-hardcoded
 * across features). Keys mirror the Synergy Score display tiers.
 */
export const TIER_COLORS = {
  perfect: {color: '#fbbf24', bg: '#3d3010'},
  strong: {color: '#6ee7a0', bg: '#1a3d1a'},
  moderate: {color: '#60b5f5', bg: '#10253d'},
  weak: {color: '#f59090', bg: '#3d1a1a'},
} as const;

// ---------------------------------------------------------------------------
// Micro-pattern style consts (#511). One source per retyped idiom, following
// the SELECT_STYLE_* precedent: consts, not wrapper components, so inline-style
// composition never fights flex/grid parents. Spread them, then override.
// ---------------------------------------------------------------------------

/** Letter-spacing scale: `cap` for uppercase section labels, `eyebrow` for hero kickers. */
export const LETTER_SPACING = {cap: '0.05em', eyebrow: '0.08em'} as const;

/** Uppercase section label (the 51-site idiom): md size, bold, tracked, muted. */
export const CAP_LABEL: React.CSSProperties = {
  fontSize: FONT_SIZES.md,
  fontWeight: 700,
  letterSpacing: LETTER_SPACING.cap,
  textTransform: 'uppercase',
  color: COLORS.textMuted,
};

/** CAP_LABEL at xs — for dense chrome (badges, tile captions). */
export const CAP_LABEL_XS: React.CSSProperties = {
  ...CAP_LABEL,
  fontSize: FONT_SIZES.xs,
};

/** Standalone surface panel. Radius rule: RADIUS.card for standalone panels/modals, RADIUS.lg for cards nested inside one. */
export const SURFACE_CARD: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.card,
  padding: SPACING.lg,
};

/** Dashed empty-state box, centered content. */
export const EMPTY_BOX: React.CSSProperties = {
  border: `1px dashed ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.lg,
  color: COLORS.textMuted,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
};

/** Single-line ellipsis truncation. REQUIRES an ancestor with minWidth: 0 in flex/grid layouts. */
export const TRUNCATE: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** Lining tabular figures — any numeral column that must not jitter (scores, counts, timers). */
export const TABULAR: React.CSSProperties = {fontVariantNumeric: 'tabular-nums'};

/**
 * The gold interaction glow, unified per the one-gold ruling: every value
 * derives from COLORS.primary (#ffb900). Selection/hover chips, nav pills,
 * and search focus rings compose from these.
 */
export const GOLD_GLOW = {
  activeBorder: hexRgba(COLORS.primary, 0.4),
  hoverBorder: hexRgba(COLORS.primary, 0.25),
  activeBg: hexRgba(COLORS.primary, 0.12),
  hoverBg: hexRgba(COLORS.primary, 0.06),
  shadow: `0 0 12px ${hexRgba(COLORS.primary, 0.15)}, inset 0 0 8px ${hexRgba(COLORS.primary, 0.05)}`,
  focusRing: `0 0 0 2px ${hexRgba(COLORS.primary, 0.15)}, 0 0 12px ${hexRgba(COLORS.primary, 0.08)}`,
} as const;

/** Minimum touch-target square (px) — the a11y floor for tap surfaces. */
export const TOUCH_TARGET = 44;

/** Icon size scale (px). */
export const ICON_SIZE = {sm: 16, md: 20, lg: 24} as const;

/** Uniform kit press feedback: pass to `scale(${PRESS_SCALE})`. */
export const PRESS_SCALE = 0.97;

/** Uniform kit disabled recipe: visibly dimmed, explicit cursor, no motion. */
export const DISABLED_STYLE: React.CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

// Browse sort order
// ── Sort orders ──

export type BrowseSortOrder =
  | 'ink-cost'
  | 'newest'
  | 'name-asc'
  | 'name-desc'
  | 'cost-asc'
  | 'cost-desc';

export type SynergySortOrder =
  | 'ink-cost'
  | 'cost-asc'
  | 'cost-desc'
  | 'strength-desc'
  | 'strength-asc'
  | 'name-asc'
  | 'name-desc';

export const BROWSE_SORT_OPTIONS: {
  value: BrowseSortOrder;
  label: string;
  mobileLabel?: string;
}[] = [
  {value: 'ink-cost', label: 'Color \u2192 Cost', mobileLabel: 'Color/Cost'},
  {value: 'newest', label: 'Newest first', mobileLabel: 'Newest'},
  {value: 'name-asc', label: 'Name A\u2013Z', mobileLabel: 'A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A', mobileLabel: 'Z\u2013A'},
  {value: 'cost-asc', label: 'Cost: Low \u2192 High', mobileLabel: 'Cost \u2191'},
  {value: 'cost-desc', label: 'Cost: High \u2192 Low', mobileLabel: 'Cost \u2193'},
];

export const SYNERGY_SORT_OPTIONS: {
  value: SynergySortOrder;
  label: string;
  mobileLabel?: string;
}[] = [
  {value: 'ink-cost', label: 'Color \u2192 Cost', mobileLabel: 'Color/Cost'},
  {value: 'cost-asc', label: 'Cost: Low \u2192 High', mobileLabel: 'Cost \u2191'},
  {value: 'cost-desc', label: 'Cost: High \u2192 Low', mobileLabel: 'Cost \u2193'},
  {value: 'strength-desc', label: 'Score: High \u2192 Low', mobileLabel: 'Score \u2193'},
  {value: 'strength-asc', label: 'Score: Low \u2192 High', mobileLabel: 'Score \u2191'},
  {value: 'name-asc', label: 'Name A\u2013Z', mobileLabel: 'A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A', mobileLabel: 'Z\u2013A'},
];
