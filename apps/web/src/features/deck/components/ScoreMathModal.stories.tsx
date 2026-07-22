import type {Meta, StoryObj} from '@storybook/react-vite';
import type {DeckStatus, HealthAnalyzer, ScoreContribution} from '../types';
import {ScoreMathModal} from './ScoreMathModal';

const analyzer = (id: string, label: string, score: number, status: DeckStatus, message: string): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message,
});

const contribution = (dimension: string, points: number, reason: string): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution: points,
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
  analyzer('synergyDensity', 'Synergy density', 72, 'warn', 'Strong core pairs, two weak links.'),
];

// Mirrors score.ts: each dimension's reason IS its analyzer message (the modal
// dedups it and computes the weight line from the structured fields instead);
// only the penalty carries distinct prose.
const POINTS: Record<string, number> = {
  curve: 14,
  inkable: 4,
  draw: 7,
  removal: 6,
  actionsCap: 5,
  typeMix: 5,
  ruleOfEight: 4,
  consistency: 6,
  lore: 10,
  shiftCoverage: 8,
  synergyDensity: 9,
};

const BREAKDOWN: ScoreContribution[] = [
  ...ANALYZERS.map((a) => contribution(a.id, POINTS[a.id], a.message)),
  contribution('vulnerability-penalty', -6, '2 vulnerabilities (1 high, 1 medium) subtract 6 points.'),
];

const meta: Meta<typeof ScoreMathModal> = {
  title: 'Deck/ScoreMathModal',
  component: ScoreMathModal,
  parameters: {backgrounds: {default: 'dark'}, layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The full glass box: status-grouped rows, the bad row pre-expanded, penalty last.
export const Open: Story = {
  args: {score: 72, configVersion: '1', analyzers: ANALYZERS, breakdown: BREAKDOWN, onClose: () => {}},
};
