import type {Meta, StoryObj} from '@storybook/react-vite';
import type {DeckStatus, HealthAnalyzer, ScoreContribution} from '../types';
import {HealthGrid} from './HealthGrid';

const analyzer = (id: string, label: string, score: number, status: DeckStatus, message: string): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message,
});

const contribution = (dimension: string, points: number): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution: points,
  reason: 'r',
});

// The full production set: buildHealthAnalyzers returns 10 unconditionally plus
// synergyDensity, so the grid stories all 11 rings a real deck renders.
const FULL_SET: HealthAnalyzer[] = [
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
