import type {Meta, StoryObj} from '@storybook/react-vite';
import type {DeckStatus, HealthAnalyzer, ScoreContribution} from '../types';
import {HealthGrid} from './HealthGrid';

const contribution = (dimension: string, points: number): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution: points,
  reason: 'r',
});

// The full production set: buildHealthAnalyzers returns 10 unconditionally plus
// synergyDensity, so the grid stories all 11 rings a real deck renders.
const a = (entry: HealthAnalyzer): HealthAnalyzer => entry;
const FULL_SET: HealthAnalyzer[] = [
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

const BREAKDOWN: ScoreContribution[] = [
  contribution('curve', 14),
  contribution('inkable', 4),
  contribution('draw', 7),
  contribution('removal', 6),
  contribution('actionsCap', 5),
  contribution('typeMix', 5),
  contribution('ruleOfEight', 4),
  contribution('consistency', 6),
  contribution('lore', 10),
  contribution('shiftCoverage', 8),
  contribution('synergyDensity', 9),
];

const meta: Meta<typeof HealthGrid> = {
  title: 'Deck/HealthGrid',
  component: HealthGrid,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [(Story) => <div style={{width: 380}}><Story /></div>],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The everyday case: trouble clusters top-left, the detail slot opens on the
// worst dimension. Captions come from the grid's short-label map (Draw vs Card
// Types stay distinguishable).
export const MixedStatuses: Story = {
  args: {analyzers: FULL_SET, breakdown: BREAKDOWN},
};

// A tuned deck: a calm wall of green, detail slot on the first ring.
export const AllGood: Story = {
  args: {
    analyzers: FULL_SET.map((a) => ({...a, score: Math.max(a.score, 85), status: 'good' as DeckStatus})),
    breakdown: BREAKDOWN,
  },
};
