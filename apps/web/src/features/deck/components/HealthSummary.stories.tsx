import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS} from '../../../shared/constants';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus, HealthAnalyzer, Vulnerability} from '../types';
import {HealthSummary} from './HealthSummary';

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

// HealthSummary only reads quality.score + health.{analyzers,vulnerabilities};
// stats/synergy are stubbed to satisfy the DeckAnalysis shape.
const analysis = (
  score: number,
  analyzers: HealthAnalyzer[],
  vulnerabilities: Vulnerability[],
): DeckAnalysis => ({
  suggestions: [],
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
  quality: {score, breakdown: [], configVersion: '1'},
});

const meta: Meta<typeof HealthSummary> = {
  title: 'Deck/HealthSummary',
  component: HealthSummary,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, width: 160, minHeight: 120, border: `1px solid ${COLORS.surfaceBorder}`}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onOpenAnalysis: fn(), isLoading: false},
};
export default meta;
type Story = StoryObj<typeof meta>;

// Warn + bad flags surface worst-first; the vulnerability count shows as a risk flag.
export const Flags: Story = {
  args: {
    analysis: analysis(
      72,
      [
        analyzer('curve', 'Curve', 90, 'good'),
        analyzer('removal', 'Removal', 55, 'warn'),
        analyzer('draw', 'Card Draw', 40, 'bad'),
      ],
      [vuln('low-strength', 'Low-strength board', 'high'), vuln('mass', 'Mass removal', 'medium')],
    ),
  },
};

// A clean deck: no non-good flags, no risks — just the score.
export const Clean: Story = {
  args: {
    analysis: analysis(84, [analyzer('curve', 'Curve', 90, 'good'), analyzer('inkable', 'Inkable Ratio', 88, 'good')], []),
  },
};

export const Loading: Story = {args: {analysis: null, isLoading: true}};

export const Empty: Story = {args: {analysis: null, isLoading: false}};

// The advisor pipeline failed (rare) — a brief unavailable note instead of stale/empty.
export const Unavailable: Story = {args: {analysis: null, isLoading: false, error: new Error('failed')}};
