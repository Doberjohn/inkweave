import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus, HealthAnalyzer, ScoreContribution, Vulnerability} from '../types';
import {PrioritiesView, RadarMedallion, VitalsView} from './HealthVariants';

const analyzer = (id: string, label: string, score: number, status: DeckStatus): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message: `${label} placeholder`,
  value: score,
});

const vuln = (id: string, label: string, severity: Vulnerability['severity']): Vulnerability => ({
  id,
  label,
  conditionType: id,
  severity,
  message: `${label} placeholder`,
});

// Only `weight` is read (PrioritiesView ranks by weight x points-lost); the rest of the
// ScoreContribution shape is stubbed so the fixtures stay readable.
const weightOf = (dimension: string, weight: number): ScoreContribution => ({
  dimension,
  weight,
  dimensionScore: 0,
  contribution: 0,
  reason: '',
});

// These lenses read quality.{score,breakdown} + health.{archetype,analyzers,vulnerabilities};
// stats/synergy are stubbed to satisfy the DeckAnalysis shape.
const analysis = (
  score: number,
  analyzers: HealthAnalyzer[],
  vulnerabilities: Vulnerability[],
  breakdown: ScoreContribution[] = [],
): DeckAnalysis => ({
  stats: {
    totalCards: 60,
    uniqueCards: 17,
    inkDistribution: {},
    costCurve: {},
    costCurveByInk: {},
    typeDistribution: {},
    inkCount: 2,
    inkableCount: 46,
    isLegal: true,
    legalityErrors: [],
  },
  synergy: {overallScore: 74, keyCards: [], weakLinks: [], connectionCounts: {}},
  health: {overall: score, archetype: 'midrange', archetypeConfidence: 0.8, analyzers, vulnerabilities},
  quality: {score, breakdown, configVersion: '1'},
});

// `consistency` is here so the radar renders the SHIPPED hexagon. A real deck always
// produces all six RADAR_PREF ids (buildHealthAnalyzers returns 10 unconditionally, plus
// synergyDensity), so a five-analyzer fixture would story a pentagon that never ships.
// Its low weight keeps it out of the Priorities top-3, leaving those stories unchanged.
const ANALYZERS = [
  analyzer('curve', 'Curve', 90, 'good'),
  analyzer('inkable', 'Inkable Ratio', 70, 'warn'),
  analyzer('draw', 'Card Draw', 55, 'warn'),
  analyzer('removal', 'Removal', 40, 'bad'),
  analyzer('consistency', 'Consistency', 80, 'warn'),
  analyzer('lore', 'Lore Pressure', 95, 'good'),
];

const WEIGHTS = [
  weightOf('curve', 0.3),
  weightOf('inkable', 0.05),
  weightOf('draw', 0.2),
  weightOf('removal', 0.25),
  weightOf('consistency', 0.05),
  weightOf('lore', 0.15),
];

const RISKS = [vuln('low-strength', 'Low-strength board', 'high'), vuln('mass', 'Mass removal', 'medium')];

const meta: Meta<typeof PrioritiesView> = {
  title: 'Deck/HealthVariants',
  component: PrioritiesView,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    // Mirrors the shipped health cell: a fixed-height flex column, since each lens
    // sizes itself with `flex: 1` and would collapse in an auto-height wrapper.
    (Story) => (
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.surfaceBorder}`,
          width: 260,
          height: 240,
          display: 'flex',
          flexDirection: 'column',
          padding: 15,
        }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Default lens: the three dimensions costing the most points, so the sub-rings
// explain the overall. Removal (0.25 x 60) drags hardest, then Draw, then Curve.
export const Priorities: Story = {
  args: {analysis: analysis(72, ANALYZERS, RISKS, WEIGHTS)},
};

// A healthy deck: same lens, nothing alarming, and the risk caption drops out entirely.
export const PrioritiesNoRisks: Story = {
  args: {
    analysis: analysis(
      88,
      [analyzer('curve', 'Curve', 92, 'good'), analyzer('inkable', 'Inkable Ratio', 88, 'good'), analyzer('draw', 'Card Draw', 84, 'good')],
      [],
      WEIGHTS,
    ),
  },
};

// Fundamentals lens: always Curve / Inkable / Draw, so the axes stay comparable
// deck-to-deck rather than shifting with whatever is worst today.
export const Vitals: Story = {
  args: {analysis: analysis(72, ANALYZERS, RISKS, WEIGHTS)},
  render: (args) => <VitalsView {...args} />,
};

// Radar lens: the whole health SHAPE on the six axes production actually renders,
// with the score as a center coin.
export const Radar: Story = {
  args: {analysis: analysis(72, ANALYZERS, RISKS, WEIGHTS)},
  render: (args) => <RadarMedallion {...args} />,
};

// Guard: fewer analyzers than the six preferred axes still renders a closed polygon.
export const RadarPartialAxes: Story = {
  args: {
    analysis: analysis(61, [analyzer('curve', 'Curve', 80, 'good'), analyzer('draw', 'Card Draw', 45, 'bad'), analyzer('lore', 'Lore Pressure', 58, 'warn')], RISKS, WEIGHTS),
  },
  render: (args) => <RadarMedallion {...args} />,
};
