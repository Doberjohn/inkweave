import type {Ink, CardType} from 'lorcana-synergy-engine';

// Ink color styling
export const INK_COLORS: Record<Ink, {bg: string; text: string; border: string}> = {
  Amber: {bg: '#fef3c7', text: '#92400e', border: '#f59e0b'},
  Amethyst: {bg: '#ede9fe', text: '#5b21b6', border: '#8b5cf6'},
  Emerald: {bg: '#d1fae5', text: '#065f46', border: '#10b981'},
  Ruby: {bg: '#fee2e2', text: '#991b1b', border: '#ef4444'},
  Sapphire: {bg: '#dbeafe', text: '#1e40af', border: '#3b82f6'},
  Steel: {bg: '#e5e7eb', text: '#374151', border: '#6b7280'},
};

// Synergy strength styling
export const STRENGTH_STYLES: Record<'strong' | 'moderate' | 'weak', {bg: string; text: string}> = {
  strong: {bg: '#dcfce7', text: '#166534'},
  moderate: {bg: '#fef9c3', text: '#854d0e'},
  weak: {bg: '#f3f4f6', text: '#6b7280'},
};

// Layout constants
export const LAYOUT = {
  sidebarWidth: 340,
  deckPanelWidth: 380,
  headerHeight: 80,
  cardTileImageWidth: 40,
  cardTileImageHeight: 56,
  synergyCardImageWidth: 60,
  synergyCardImageHeight: 84,
  selectedCardImageWidth: 120,
  maxDisplayedCards: 200,
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
  xl: 12,
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

// Common colors
export const COLORS = {
  // Grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Primary (Indigo)
  primary50: '#eef2ff',
  primary100: '#e0e7ff',
  primary200: '#c7d2fe',
  primary500: '#6366f1',
  primary600: '#4f46e5',
  primary700: '#4338ca',
  primary800: '#312e81',
  primary900: '#1e1b4b',

  // Semantic
  white: '#ffffff',
  error: '#dc2626',
  errorBg: '#fef2f2',
  errorBorder: '#fecaca',
  successBg: '#dcfce7',

  // Backgrounds
  bgGradientStart: '#f8fafc',
  bgGradientEnd: '#e2e8f0',
  headerGradientStart: '#1e1b4b',
  headerGradientEnd: '#312e81',
} as const;

// All inks for iteration
export const ALL_INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

// Breakpoints for responsive design
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
} as const;

// Mobile-specific layout constants
export const LAYOUT_MOBILE = {
  headerHeight: 56,
  bottomNavHeight: 56,
  cardTileImageWidth: 48,
  cardTileImageHeight: 67,
} as const;

// Z-index scale for layering
export const Z_INDEX = {
  mobileNav: 900,
  modalBackdrop: 999,
  modal: 1000,
  popoverBackdrop: 1099,
  popover: 1100,
} as const;

// Card types for filtering
export const CARD_TYPES: CardType[] = ['Character', 'Action', 'Item', 'Location'];

// Cost options for filtering (0-10, where 10 represents 10+)
export const COST_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Shared select styles
export const SELECT_STYLE_SM: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: `${RADIUS.md}px`,
  border: `1px solid ${COLORS.gray200}`,
  fontSize: `${FONT_SIZES.sm}px`,
  background: COLORS.white,
  cursor: 'pointer',
};

export const SELECT_STYLE_MD: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: `${RADIUS.lg}px`,
  border: `1px solid ${COLORS.gray200}`,
  fontSize: `${FONT_SIZES.base}px`,
  background: COLORS.white,
  cursor: 'pointer',
  minHeight: '44px',
};
