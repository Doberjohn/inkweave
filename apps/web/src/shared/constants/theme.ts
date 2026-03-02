import type {Ink, CardType} from 'lorcana-synergy-engine';

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

// Font families
export const FONTS = {
  body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  hero: "'Tinos', 'Cinzel', 'Georgia', serif",
} as const;

// Layout constants
export const LAYOUT = {
  sidebarWidth: 480,
  headerHeight: 56,
  compactHeaderHeight: 52,
  cardDetailWidth: 330,
  selectedCardImageWidth: 120,
  maxDisplayedCards: 200,
  browseCardMinWidth: 180,
  synergyCardMinWidth: 160,
  browseMaxWidth: 1280,
} as const;

// Spacing scale
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

// Border radius scale
export const RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 14,
} as const;

// Typography
export const FONT_SIZES = {
  xs: 10,
  sm: 11,
  md: 12,
  base: 13,
  lg: 14,
  xl: 16,
  xxl: 20,
  xxxl: 22,
} as const;

// Dark fantasy color palette
export const COLORS = {
  // Dark backgrounds
  background: '#0d0d14',
  surface: '#1a1a2e',
  surfaceHover: '#252540',
  surfaceAlt: '#151525',
  surfaceBorder: '#333355',

  // Primary accent (gold)
  primary: '#ffb900',
  primaryHover: '#ffc933',
  primaryMuted: '#d49a00',

  // Text
  text: '#e8e8e8',
  textMuted: '#e8e8e8',
  textDim: '#666680',

  // Semantic
  white: '#e8e8e8',
  error: '#ef4444',
  errorBg: '#2a1515',
  errorBorder: '#5c2020',
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

  // Primary shades (gold-based for dark theme)
  primary50: '#1a1810',
  primary100: '#2a2515',
  primary200: '#3d3520',
  primary500: '#d4af37',
  primary600: '#d4af37',
  primary700: '#b8962e',
  primary800: '#8a7022',
  primary900: '#5c4a16',

  // Backgrounds
  bgGradientStart: '#0d0d14',
  bgGradientEnd: '#12121f',
  headerGradientStart: '#0d0d14',
  headerGradientEnd: '#1a1a2e',

  // Hero section
  heroTitle: '#ffffff',
  heroSubtitle: '#cad5e2',
  heroSubtitleSecondary: '#90a1b9',
  heroGradient: 'linear-gradient(90deg, #bedBff 0%, #e9d4ff 50%, #fcCEe8 100%)',

  // Search / Filter bar
  searchBg: 'rgba(15, 23, 43, 0.5)',
  searchBorder: 'rgba(49, 65, 88, 0.5)',
  searchPlaceholder: '#90a1b9',
  filterGradient: 'linear-gradient(90deg, #fe9a00, #e17100)',
  filterText: '#0f172b',
  filterShadow: '0px 10px 15px 0px rgba(254,154,0,0.2), 0px 4px 6px 0px rgba(254,154,0,0.2)',

  // Featured section
  featuredLabel: '#90a1b9',
  featuredDivider: '#314158',

  // Ethereal glow orbs
  etherealBlue: 'rgba(43, 127, 255, 0.1)',
  etherealPurple: 'rgba(173, 70, 255, 0.1)',
  etherealTeal: 'rgba(0, 187, 167, 0.05)',
  // Legacy orb aliases (keep for backward compat)
  etherealGold: 'rgba(212, 175, 55, 0.10)',
  etherealEmerald: 'rgba(16, 185, 129, 0.12)',
} as const;

// All inks for iteration
export const ALL_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

// Known set codes
export type SetCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';

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
} as const;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
} as const;

// Mobile-specific layout constants
export const LAYOUT_MOBILE = {
  cardTileImageWidth: 48,
  cardTileImageHeight: 67,
} as const;

// Z-index scale for layering
export const Z_INDEX = {
  autocomplete: 900,
  modalBackdrop: 999,
  modal: 1000,
  popoverBackdrop: 1099,
  popover: 1100,
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

/** Convert a hex color (#rrggbb) to rgba with the given alpha */
export const hexRgba = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

// CTA button style (orange gradient, matching Figma Filters button)
export const CTA_BUTTON_STYLE: React.CSSProperties = {
  background: COLORS.filterGradient,
  color: COLORS.filterText,
  border: 'none',
  borderRadius: `${RADIUS.lg}px`,
  padding: `${SPACING.sm}px ${SPACING.xl}px`,
  fontSize: `${FONT_SIZES.lg}px`,
  fontWeight: 500,
  cursor: 'pointer',
  minHeight: '44px',
  boxShadow: COLORS.filterShadow,
};
