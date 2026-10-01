import type {Meta, StoryObj} from '@storybook/react-vite';
import type {HealthAnalyzer, ScoreContribution} from '../types';
import {ScoreMathModal} from './ScoreMathModal';

const contribution = (dimension: string, points: number, reason: string): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution: points,
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
  a({id: 'synergyDensity', label: 'Synergy density', score: 72, status: 'warn', message: 'Strong core pairs, two weak links.'}),
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
