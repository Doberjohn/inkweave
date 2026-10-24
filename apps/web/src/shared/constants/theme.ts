import type {Ink, CardType} from 'inkweave-synergy-engine';

// App branding
export const APP_NAME = 'Inkweave';

// Ink color styling (vibrant on dark backgrounds)
export const INK_COLORS: Record<Ink, {bg: string; text: string; border: string}> = {
  Amber: {bg: '#3d2e10', text: '#f5c542', border: '#f59e0b'},
  Amethyst: {bg: '#2a1a45', text: '#c4a5f5', border: '#8b5cf6'},
  Emerald: {bg: '#0f2e1f', text: '#6ee7a0', border: '#10b981'},
  Ruby: {bg: '#3d1515', text: '#f87171', border: '#ef4444'},
  Sapphire: {bg: '#0f1e3d', text: '#7db5f5', border: '#3b82f6'},
  Steel: {bg: '#252530', text: '#a0a0b0', border: '#6b7280'},
};

/**
 * The game's own ink-symbol colours, for the letter chips that name each card in a synergy line
 * (ConnectionGroup, #786). They are brighter than INK_COLORS, which is tuned for badges on dark
 * surfaces, so each ink carries the text colour that reads on its chip.
 */
export const INK_CHIP_COLORS: Record<Ink, {bg: string; text: string}> = {
  Amber: {bg: '#f5b202', text: '#000000'},
  Amethyst: {bg: '#81377b', text: '#ffffff'},
  Emerald: {bg: '#2a8934', text: '#ffffff'},
  Ruby: {bg: '#d3082f', text: '#ffffff'},
  Sapphire: {bg: '#0189c4', text: '#ffffff'},
  Steel: {bg: '#9fa8b4', text: '#000000'},
};

/**
 * The sign-in dialog's provider buttons (owner, 2026-10-22): each provider's own colours, so
 * each button reads as that provider's rather than ours. Google's are its light "Sign in with
 * Google" button (white fill, grey 1px stroke, near-black label); Discord's is its Blurple,
 * with white label and symbol. The logos themselves are files in src/assets.
 */
export const PROVIDER_COLORS = {
  google: {bg: '#ffffff', text: '#1f1f1f', border: '#747775'},
  discord: {bg: '#5865f2', text: '#ffffff'},
} as const;

// Font families
export const FONTS = {
  body: "'Plus Jakarta Sans', 'Inkweave Sans Fallback', -apple-system, BlinkMacSystemFont, sans-serif",
  /** Marcellus ships one weight, 400, and nothing synthesizes bold, so hero text is always set at 400. */
  hero: "'Marcellus', 'Georgia', serif",
} as const;

// Layout constants
export const LAYOUT = {
  sidebarWidth: 480,
  headerHeight: 56,
  compactHeaderHeight: 52,
  compactHeaderHeightMobile: 48,
  cardDetailWidth: 330,
  maxDisplayedCards: 204,
  /** CardGrid auto-fill minimum column width on desktop. Used by BrowseCardGrid + the shared CardGrid component. */
  cardGridMinWidth: 180,
  /** CardGrid auto-fill minimum column width on mobile. Lower so phones ≥360px viewport fit 2 columns. */
  cardGridMinWidthMobile: 140,
  synergyCardMinWidth: 160,
  /** The phone tab bar's height (`MobileBottomNav`), here so the entry's update toast can clear it without importing the nav. */
  mobileNavHeight: 110,
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
  textDim: '#666680', // never text: 2.6-3.5:1 on our surfaces (inkweave/no-dim-text); borders, strokes, disabled, decoration

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
  heroSubtitleSecondary: '#90a1b9',
  heroGradient: 'linear-gradient(90deg, #bedBff 0%, #e9d4ff 50%, #fcCEe8 100%)',

  // Search / Filter bar. A search field is RAISED (owner, 2026-10-15): the toolbar sort
  // control's surface and edge, so it holds its own on the page. It was a half-transparent
  // navy and slate before, which the near-black page swallowed. See `searchFieldStyle`.
  searchBg: '#1e1e35', // = surfaceRaised
  searchBorder: '#333355', // = surfaceBorder
  searchBorderHover: '#444466', // = gray300
  searchPlaceholder: '#90a1b9',
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
export type SetCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14';

// Set abbreviations (keyed by setCode)
export const SET_ABBREVIATIONS: Record<SetCode, string> = {
  '1': '1TFC',
  '2': '2ROF',
  '3': '3INK',
  '4': '4URS',
  '5': '5SSK',
  '6': '6AZS',
  '7': '7ARI',
  '8': '8JAF',
  '9': '9FAB',
  '10': '10WHI',
  '11': '11WSP',
  '12': '12WIL',
  '13': '13AVN',
  '14': '14HYP',
} as const;

// Set full names (keyed by setCode)
export const SET_NAMES: Record<SetCode, string> = {
  '1': 'The First Chapter',
  '2': 'Rise of the Floodborn',
  '3': 'Into the Inklands',
  '4': "Ursula's Return",
  '5': 'Shimmering Skies',
  '6': 'Azurite Sea',
  '7': "Archazia's Island",
  '8': 'The Reign of Jafar',
  '9': 'Fabled',
  '10': 'Whispers in the Well',
  '11': 'Winterspell',
  '12': 'The Wilds Unknown',
  '13': 'Attack of the Vine!',
  '14': 'Hyperia City',
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
  autocomplete: 900,
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

// Shared select style (dark theme)
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

/**
 * Dialog copy, so weight is decided ONCE rather than per overlay (owner ruling
 * 2026-08-02). Every dialog previously set its own inline font, which meant
 * "make dialog text 600" was an eleven-file edit with a twelfth waiting to
 * diverge. Spread these; override only where a dialog genuinely differs.
 */
export const DIALOG_TITLE: React.CSSProperties = {
  fontFamily: FONTS.hero,
  fontSize: FONT_SIZES.xxl,
  // The hero serif's one weight, said out loud: an <h2> asks for bold, which it has no face for.
  fontWeight: 400,
  color: COLORS.text,
  margin: 0,
};

export const DIALOG_BODY: React.CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.base,
  fontWeight: 600,
  color: COLORS.textMuted,
  margin: 0,
};

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

/** Screen-reader-only: kept in the accessibility tree, drawn nowhere (a chip's card name, a heading the layout implies). */
export const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

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

/** A search field's edge: gold while focused, lighter while hovered, the raised edge at rest. */
function searchEdge(focused: boolean, hovered: boolean): string {
  if (focused) return GOLD_GLOW.activeBorder;
  return hovered ? COLORS.searchBorderHover : COLORS.searchBorder;
}

/**
 * A search field's surface and edge (owner, 2026-10-15), one recipe for Browse's toolbar,
 * the header and the homepage hero: raised at rest, the edge lighter on hover, and gold with
 * the focus ring while focused. Spread it, then size the field.
 */
export function searchFieldStyle({focused, hovered}: {focused: boolean; hovered: boolean}): React.CSSProperties {
  return {
    background: COLORS.searchBg,
    border: `1px solid ${searchEdge(focused, hovered)}`,
    boxShadow: focused ? GOLD_GLOW.focusRing : 'none',
    transition: `border-color ${DURATION.base}ms ${EASING.snappy}, box-shadow ${DURATION.base}ms ${EASING.snappy}`,
  };
}

/**
 * The inset focus ring's gold, as the custom property `.inset-focus-ring` (index.css) reads:
 * the card art buttons (CardImageButton), the Reveals promo and the copies stripe's − and +.
 * Spread into each control's own style rather than set once on the page root, so the ring
 * shows wherever the control renders: in the card modal's portal, in Storybook, and in admin,
 * which imports the components and index.css but not this app's bootstrap.
 */
export const INSET_FOCUS_RING = {'--inkweave-gold': COLORS.primary} as React.CSSProperties;

/**
 * The card tiles' hover glow (owner, 2026-10-21): the gold behind a card a pointer is on or
 * keyboard focus has reached, the one way the app highlights a card (`.card-tile` and
 * `.synergy-more-tile`, index.css). Spread into each tile's own style, as INSET_FOCUS_RING
 * is, so the glow shows wherever a tile renders. The binder's pockets light the same one
 * (#941): its black pages show it as plainly as every grid does.
 */
export const CARD_TILE_GLOW = {
  '--tile-glow-soft': hexRgba(COLORS.primary, 0.42),
} as React.CSSProperties;

/**
 * The FOIL marker: brushed gold, for anything reporting foil copies.
 *
 * A SIX-INK RAINBOW WAS TRIED FIRST AND REJECTED (owner, 2026-08-14). It was the
 * literal convention other Lorcana tools use and it was defensible on paper, but
 * on a 20px pill six hues compress into a smear that reads as noise rather than
 * as foil, and it fought every card behind it. Gold says "premium" with one hue
 * and it is already the app's own accent.
 *
 * ONE SURFACE, NOT A REST/HOVER PAIR (owner, 2026-08-14). A quieter flat variant
 * for the resting state was tried and dropped: rest and hover are the same object
 * at two widths, and giving them two different fills made hovering look like a
 * substitution rather than an expansion.
 *
 * THREE LAYERS, in paint order: the light band, the gold, the ground. The gold is
 * SEMI-TRANSPARENT over that ground rather than replacing it, which is what holds
 * the count legible — flat `COLORS.primary` behind white bold text is 3.0:1 and
 * fails; over this ground it is 6.4:1. Recompute before raising it.
 *
 * The band is a separate layer sized to a fraction of the pill precisely so it can
 * travel: `.inkweave-foil-shimmer` in index.css animates the FIRST layer's
 * `background-position` and leaves the other two pinned, so the layer order is
 * load-bearing. Only the hovered control sweeps.
 */
const GOLD_EDGE = hexRgba(COLORS.primary, 0.2);
const GOLD_PEAK = hexRgba(COLORS.primary, 0.45);
const SHINE = whiteRgba(0.3);

export const FOIL_SHEEN = {
  /**
   * The foil surface over `ground`. The CALLER supplies the ground because how
   * opaque it must be is a property of where the control sits, not of the foil:
   * the deck pool lets a sliver of card art through, the binder does not.
   *
   * `band` is the light stripe, and it belongs to MOTION only (owner,
   * 2026-08-14). Narrowing it and parking it on the left shoulder was tried
   * first; a stripe that never moves still reads as a defect on a resting chip,
   * so the resting surface is plain gold and the band exists only while the
   * pill is open and sweeping. Pass `false` and the layer is not painted at all
   * — the size/position lists shrink with it.
   */
  surface: (ground: string, band = true): React.CSSProperties => ({
    backgroundImage: [
      ...(band ? [`linear-gradient(100deg, transparent 0%, ${SHINE} 50%, transparent 100%)`] : []),
      `linear-gradient(100deg, ${GOLD_EDGE} 0%, ${GOLD_PEAK} 50%, ${GOLD_EDGE} 100%)`,
      `linear-gradient(${ground}, ${ground})`,
    ].join(', '),
    // The band starts OFF the left edge so the sweep enters from outside the
    // pill rather than fading in over the count. `.inkweave-foil-shimmer`
    // animates this first position; the other two stay pinned.
    backgroundSize: band ? '36% 100%, 100% 100%, 100% 100%' : '100% 100%, 100% 100%',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: band ? '-20% 0, 0 0, 0 0' : '0 0, 0 0',
  }),

  /** index.css owns the keyframes so `prefers-reduced-motion` can kill them. */
  shimmerClass: 'inkweave-foil-shimmer',
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
// Labels are words, never arrows: an <option> can't hide part of its text, and screen
// readers would read "right arrow" in every name (#835).

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
  {value: 'ink-cost', label: 'Color, then Cost', mobileLabel: 'Color/Cost'},
  {value: 'newest', label: 'Newest first', mobileLabel: 'Newest'},
  {value: 'name-asc', label: 'Name A\u2013Z', mobileLabel: 'A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A', mobileLabel: 'Z\u2013A'},
  {value: 'cost-asc', label: 'Cost: Low to High', mobileLabel: 'Low cost'},
  {value: 'cost-desc', label: 'Cost: High to Low', mobileLabel: 'High cost'},
];

export const SYNERGY_SORT_OPTIONS: {
  value: SynergySortOrder;
  label: string;
  mobileLabel?: string;
}[] = [
  {value: 'ink-cost', label: 'Color, then Cost', mobileLabel: 'Color/Cost'},
  {value: 'cost-asc', label: 'Cost: Low to High', mobileLabel: 'Low cost'},
  {value: 'cost-desc', label: 'Cost: High to Low', mobileLabel: 'High cost'},
  {value: 'strength-desc', label: 'Score: High to Low', mobileLabel: 'High score'},
  {value: 'strength-asc', label: 'Score: Low to High', mobileLabel: 'Low score'},
  {value: 'name-asc', label: 'Name A\u2013Z', mobileLabel: 'A\u2013Z'},
  {value: 'name-desc', label: 'Name Z\u2013A', mobileLabel: 'Z\u2013A'},
];
