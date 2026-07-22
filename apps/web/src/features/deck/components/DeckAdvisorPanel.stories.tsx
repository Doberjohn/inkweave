import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {Archetype, DeckStatus, HealthAnalyzer, ScoreContribution, Vulnerability} from '../types';
import {DeckAdvisorPanel} from './DeckAdvisorPanel';

const analyzer = (id: string, label: string, score: number, status: DeckStatus, message: string): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message,
});

const contribution = (dimension: string, weight: number, dimensionScore: number, reason: string): ScoreContribution => ({
  dimension,
  weight,
  dimensionScore,
  contribution: Math.round(weight * dimensionScore * 100),
  reason,
});

const ANALYZERS: HealthAnalyzer[] = [
  analyzer('curve', 'Curve', 90, 'good', 'Peak at 2-3 ink with a healthy front-load.'),
  analyzer('inkable', 'Inkable Ratio', 70, 'warn', '43 inkable is a touch below the 44-48 target.'),
  analyzer('draw', 'Card Draw', 55, 'warn', '5 draw effects; the archetype wants 6-10.'),
  analyzer('removal', 'Removal', 40, 'bad', '3 removal pieces; the floor is 4.'),
  analyzer('actionsCap', 'Actions & Songs', 85, 'good', '13 actions sits under the ~15 cap.'),
  analyzer('typeMix', 'Card Types', 75, 'good', '24 characters / 13 actions / 5 items.'),
  analyzer('ruleOfEight', 'Rule of Eight', 65, 'warn', '7 interchangeable core pieces; 8 hits ~65% of opening hands.'),
  analyzer('consistency', 'Consistency', 80, 'warn', '18 distinct cards, 11 playsets.'),
  analyzer('lore', 'Lore Output', 95, 'good', 'Board lore keeps pace with a racing plan.'),
  analyzer('shiftCoverage', 'Shift Coverage', 100, 'good', 'Every Shift card has a same-name base.'),
  analyzer('synergyDensity', 'Synergy Density', 72, 'warn', 'Strong core pairs, two weak links.'),
];

const BREAKDOWN: ScoreContribution[] = [
  contribution('curve', 0.16, 0.9, 'Curve peaks on time for the plan.'),
  contribution('removal', 0.14, 0.4, 'Below the 4-piece removal floor.'),
  contribution('draw', 0.12, 0.55, 'Draw is thin for the long game.'),
  contribution('synergyDensity', 0.12, 0.72, 'Core pairs pull together.'),
  contribution('lore', 0.1, 0.95, 'Lore output races well.'),
  contribution('consistency', 0.08, 0.8, 'Mostly playsets, few singletons.'),
  {dimension: 'vulnerability-penalty', weight: 1, dimensionScore: -0.06, contribution: -6, reason: 'Low-strength exposure invites a sweeper.'},
];

const RISKS: Vulnerability[] = [
  {
    id: 'low-strength',
    label: 'Low-strength board',
    conditionType: 'low-strength',
    severity: 'high',
    exposurePct: 68,
    message: '68% of your characters have 2 strength or less; one sweep clears them.',
  },
  {
    id: 'mass',
    label: 'Mass removal',
    conditionType: 'mass',
    severity: 'medium',
    message: 'Wide boards refill slowly here after a board wipe.',
  },
];

const ANALYSIS: DeckAnalysis = {
  stats: {
    totalCards: 60,
    uniqueCards: 18,
    inkDistribution: {},
    costCurve: {},
    costCurveByInk: {},
    typeDistribution: {},
    inkCount: 2,
    inkableCount: 43,
    isLegal: true,
    legalityErrors: [],
  },
  synergy: {overallScore: 74, keyCards: [], weakLinks: [], connectionCounts: {}},
  health: {overall: 72, archetype: 'midrange', archetypeConfidence: 0.8, analyzers: ANALYZERS, vulnerabilities: RISKS},
  quality: {score: 72, breakdown: BREAKDOWN, configVersion: '1'},
};

// Interactive wrapper: declaring a gameplan flips the badge to "Declared" live.
function InteractivePanel({analysis}: {analysis: DeckAnalysis | null}) {
  const [gameplan, setGameplan] = useState<Archetype | undefined>(undefined);
  return (
    <DeckAdvisorPanel
      analysis={analysis}
      isLoading={false}
      error={null}
      gameplan={gameplan}
      onGameplanChange={setGameplan}
    />
  );
}

const meta: Meta<typeof DeckAdvisorPanel> = {
  title: 'Deck/DeckAdvisorPanel',
  component: DeckAdvisorPanel,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [(Story) => <div style={{width: 400}}><Story /></div>],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The full advisor: identity header, glass-box score, all 11 dimensions, risks.
// The gameplan selector is live; declaring one flips the badge provenance.
export const FullAnalysis: Story = {
  args: {analysis: ANALYSIS, isLoading: false, error: null, gameplan: undefined, onGameplanChange: () => {}},
  render: () => <InteractivePanel analysis={ANALYSIS} />,
};

// Empty deck: one quiet dashed box, no advisor chrome.
export const Empty: Story = {
  args: {analysis: null, isLoading: false, error: null, gameplan: undefined, onGameplanChange: () => {}},
};

// First analysis in flight.
export const Loading: Story = {
  args: {analysis: null, isLoading: true, error: null, gameplan: undefined, onGameplanChange: () => {}},
};
