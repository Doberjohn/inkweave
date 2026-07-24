import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, hexRgba} from '../../../shared/constants';
import {SortSelect} from '../../../shared/components/SortSelect';
import type {Archetype} from '../types';
import {ArchetypeBadge, ARCHETYPE_LABELS} from './ArchetypeBadge';
import {scoreTier} from './scoreTier';

/** The gameplan selector's "let the classifier decide" sentinel (→ gameplan: undefined). */
const AUTO = 'auto';
type GameplanOption = Archetype | typeof AUTO;
const GAMEPLAN_OPTIONS: {value: GameplanOption; label: string}[] = [
  {value: AUTO, label: 'Auto-detect'},
  ...(Object.entries(ARCHETYPE_LABELS) as [Archetype, string][]).map(([value, label]) => ({
    value,
    label: `Play as ${label}`,
  })),
];

interface VerdictLineProps {
  archetype: Archetype;
  archetypeConfidence: number;
  /** The Deck Quality Score, 0..100. */
  score: number;
  /** Declared gameplan; undefined = auto-detect. */
  gameplan: Archetype | undefined;
  onGameplanChange: (gameplan: Archetype | undefined) => void;
}

/**
 * Zone 1 of the Analysis tab (#471): the one-glance verdict — the deck's archetype
 * identity + declared-gameplan control, and the Deck Quality Score as a plain tier
 * word + number (reusing scoreTier). The full score gauge + math live in Details.
 */
export function VerdictLine({archetype, archetypeConfidence, score, gameplan, onGameplanChange}: VerdictLineProps) {
  const tier = scoreTier(score);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.md,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.card,
        padding: SPACING.lg,
      }}>
      <div style={{minWidth: 0, flex: 1}}>
        <ArchetypeBadge archetype={archetype} confidence={archetypeConfidence} declared={gameplan != null} />
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, flexShrink: 0}}>
        <SortSelect
          options={GAMEPLAN_OPTIONS}
          value={gameplan ?? AUTO}
          onChange={(v) => onGameplanChange(v === AUTO ? undefined : v)}
          ariaLabel="Declared gameplan"
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: hexRgba(tier.color, 0.15),
            border: `1px solid ${tier.color}`,
            borderRadius: RADIUS.md,
            padding: `4px 12px`,
            minWidth: 58,
          }}>
          <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, color: tier.color, lineHeight: 1.1}}>
            {score}
          </span>
          <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textMuted}}>{tier.label}</span>
        </div>
      </div>
    </div>
  );
}
