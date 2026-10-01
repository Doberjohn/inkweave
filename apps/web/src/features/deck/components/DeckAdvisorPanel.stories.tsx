import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {Archetype, HealthAnalyzer, ScoreContribution, Vulnerability} from '../types';
import {DeckAdvisorPanel} from './DeckAdvisorPanel';

const contribution = (dimension: string, weight: number, dimensionScore: number, reason: string): ScoreContribution => ({
  dimension,
  weight,
  dimensionScore,
  contribution: Math.round(weight * dimensionScore * 100),
  reason,
});

const a = (entry: HealthAnalyzer): HealthAnalyzer => entry;
const ANALYZERS: HealthAnalyzer[] = [
  a({id: 'curve', label: 'Curve', score: 90, status: 'good', message: 'Peak at 2-3 ink with a healthy front-load.'}),
  a({id: 'inkable', label: 'Inkable Ratio', score: 70, status: 'warn', message: '43 inkable is a touch below the 44-48 target.'}),
  a({id: 'draw', label: 'Card Draw', score: 55, status: 'warn', message: '5 draw effects; the archetype wants 6-10.'}),
  a({id: 'removal', label: 'Removal', score: 40, status: 'bad', message: '3 removal pieces; the floor is 4.'}),
  a({id: 'actionsCap', label: 'Actions & Songs', score: 85, status: 'good', message: '13 actions sits under the ~15 cap.'}),
  a({id: 'typeMix', label: 'Card Types', score: 75, status: 'good', message: '24 characters / 13 actions / 5 items.'}),
  a({id: 'ruleOfEight', label: 'Rule of Eight', score: 65, status: 'warn', message: '7 interchangeable core pieces; 8 hits ~65% of opening hands.'}),
  a({id: 'consistency', label: 'Consistency', score: 80, status: 'warn', message: '18 distinct cards, 11 playsets.'}),
  a({id: 'lore', label: 'Lore Output', score: 95, status: 'good', message: 'Board lore keeps pace with a racing plan.'}),
  a({id: 'shiftCoverage', label: 'Shift Coverage', score: 100, status: 'good', message: 'Every Shift card has a same-name base.'}),
  a({id: 'synergyDensity', label: 'Synergy Density', score: 72, status: 'warn', message: 'Strong core pairs, two weak links.'}),
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
  suggestions: [],
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
