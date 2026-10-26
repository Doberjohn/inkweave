import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CopiesStripe} from './CopiesStripe';
import {COLORS} from '../tokens/theme';

/** A 1920px screen's binder pocket, the size the pocket's stripe is drawn for at 90%. */
const POCKET = {width: 144, height: 200};
/** A 1440px screen's pocket, where the stripe scales down with the card. */
const NARROW_POCKET = {width: 84, height: 117};
/** The card window's desktop card. */
const WINDOW_CARD = {width: 337, height: 470};

/** Normal copies, then foil: the parts' order across the stripe. */
const parts = (normal: number, foil: number) => [
  {label: 'normal', count: normal, tone: 'default' as const, onChange: fn()},
  {label: 'foil', count: foil, tone: 'foil' as const, onChange: fn()},
];

/**
 * A card's copies as a stripe across its foot (owner, 2026-10-20), at the foot of a frame the
 * card's size, a 1920px screen's pocket unless a story names another `frame`.
 */
const meta: Meta<typeof CopiesStripe> = {
  title: 'Shared/CopiesStripe',
  component: CopiesStripe,
  decorators: [
    (Story, {parameters}) => (
      <div style={{position: 'relative', ...(parameters.frame ?? POCKET), background: COLORS.surfaceAlt, margin: 16}}>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0}}>
          <Story />
        </div>
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {parts: parts(2, 1), open: false},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** At rest in a pocket: each held finish's count at the middle, normal dark, foil gold. */
export const AtRest: Story = {};

/** Open in a pocket: each finish across its half, − count +, the foil's light sweeping. */
export const Open: Story = {args: {open: true}};

/** A card you hold none of, open: both finishes at 0, their − greyed. */
export const OpenUnheld: Story = {args: {open: true, parts: parts(0, 0)}};

/** Open in a 1440px screen's pocket: the same stripe, scaled down with its card. */
export const OpenNarrow: Story = {args: {open: true}, parameters: {frame: NARROW_POCKET}};

/** A printing made only in foil (Enchanted, Epic, Iconic, the alt foils): Foil alone across the stripe. */
export const FoilOnly: Story = {args: {open: true, parts: parts(0, 1).slice(1)}};

/** A printing made only in normal, as 1/C3 is (#880): Normal alone across the stripe. */
export const NormalOnly: Story = {args: {open: true, parts: parts(1, 0).slice(0, 1)}};

/** The card window's: always open, as tall as the card's own black bar. */
export const InTheCardWindow: Story = {args: {open: true, fit: 'bar'}, parameters: {frame: WINDOW_CARD}};
