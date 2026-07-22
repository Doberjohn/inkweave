import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {Archetype} from '../types';
import {SortSelect} from '../../../shared/components/SortSelect';
import {ArchetypeBadge, ARCHETYPE_LABELS} from './ArchetypeBadge';
import {HealthGrid} from './HealthGrid';
import {ScoreGauge} from './ScoreGauge';
import {ScoreMathModal} from './ScoreMathModal';
import {VulnerabilityBox} from './VulnerabilityBox';

/** The selector's "let the classifier decide" sentinel (maps to gameplan: undefined). */
const AUTO = 'auto';
type GameplanOption = Archetype | typeof AUTO;

const GAMEPLAN_OPTIONS: {value: GameplanOption; label: string}[] = [
  {value: AUTO, label: 'Auto-detect'},
  ...(Object.entries(ARCHETYPE_LABELS) as [Archetype, string][]).map(([value, label]) => ({
    value,
    label: `Play as ${label}`,
  })),
];

interface DeckAdvisorPanelProps {
  analysis: DeckAnalysis | null;
  isLoading: boolean;
  error: Error | null;
  /** The deck's declared gameplan; undefined = auto-detect. */
  gameplan: Archetype | undefined;
  /** Writes `deck.gameplan` (via useDeck.setGameplan); undefined clears the declaration. */
  onGameplanChange: (gameplan: Archetype | undefined) => void;
}

/**
 * The expanded deck advisor (#472, PLAN item 26): archetype identity + declared-
 * gameplan selector, the glass-box Deck Quality Score, the full per-dimension
 * health detail, and the vulnerability watch list, composed for the Analysis tab.
 * Declaring a gameplan re-runs `analyzeDeck` upstream (the deck signature changes),
 * so every section below the selector reacts to it live.
 */
export function DeckAdvisorPanel({analysis, isLoading, error, gameplan, onGameplanChange}: DeckAdvisorPanelProps) {
  if (!analysis) {
    const emptyMessage = error
      ? 'Analysis unavailable — try editing the deck.'
      : isLoading
        ? 'Analyzing deck…'
        : 'Add cards to see the Deck Quality Score.';
    return (
      <div
        style={{border: `1px dashed ${COLORS.surfaceBorder}`, borderRadius: RADIUS.md, padding: SPACING.lg, textAlign: 'center', color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`}}>
        {emptyMessage}
      </div>
    );
  }

  return <AdvisorContent analysis={analysis} gameplan={gameplan} onGameplanChange={onGameplanChange} />;
}

/**
 * The populated advisor. Split from the shell so `mathOpen` UNMOUNTS with its
 * data: if the analysis empties while the math modal is open (deck cleared to
 * zero), this component leaves the tree and the modal state dies with it, so a
 * later analysis cannot resurrect the modal (adversarial-review find; the
 * effect-based reset alternative trips react-hooks/set-state-in-effect).
 */
function AdvisorContent({
  analysis,
  gameplan,
  onGameplanChange,
}: {
  analysis: DeckAnalysis;
  gameplan: Archetype | undefined;
  onGameplanChange: (gameplan: Archetype | undefined) => void;
}) {
  const [mathOpen, setMathOpen] = useState(false);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
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
        <ArchetypeBadge
          archetype={analysis.health.archetype}
          confidence={analysis.health.archetypeConfidence}
          declared={gameplan != null}
        />
        <SortSelect
          options={GAMEPLAN_OPTIONS}
          value={gameplan ?? AUTO}
          onChange={(v) => onGameplanChange(v === AUTO ? undefined : v)}
          ariaLabel="Declared gameplan"
          style={{flexShrink: 0}}
        />
      </div>
      <ScoreGauge quality={analysis.quality} onShowMath={() => setMathOpen(true)} />
      <HealthGrid analyzers={analysis.health.analyzers} breakdown={analysis.quality.breakdown} />
      <VulnerabilityBox vulnerabilities={analysis.health.vulnerabilities} />
      {mathOpen && (
        <ScoreMathModal
          score={analysis.quality.score}
          configVersion={analysis.quality.configVersion}
          analyzers={analysis.health.analyzers}
          breakdown={analysis.quality.breakdown}
          onClose={() => setMathOpen(false)}
        />
      )}
    </div>
  );
}
