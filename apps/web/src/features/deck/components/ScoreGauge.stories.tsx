import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import type {QualityScore} from '../types';
import {ScoreGauge} from './ScoreGauge';

// A realistic glass-box breakdown (11 weighted dimensions + the vulnerability
// penalty). Story `score` overrides just move the tier; the breakdown is illustrative.
const quality = (over: Partial<QualityScore> = {}): QualityScore => ({
  score: 72,
  configVersion: '1',
  breakdown: [
    {dimension: 'curve', weight: 0.15, dimensionScore: 0.9, contribution: 11, reason: 'Smooth 2–3 peak, front-loaded for tempo'},
    {dimension: 'inkable', weight: 0.12, dimensionScore: 0.85, contribution: 9, reason: '46 inkable — reliable early ink'},
    {dimension: 'synergyDensity', weight: 0.12, dimensionScore: 0.8, contribution: 8, reason: '5 key cards anchoring the deck'},
    {dimension: 'removal', weight: 0.1, dimensionScore: 0.6, contribution: 6, reason: '5 answers — a touch light for midrange'},
    {dimension: 'typeMix', weight: 0.08, dimensionScore: 0.75, contribution: 4, reason: 'Balanced character / action split'},
    {dimension: 'draw', weight: 0.08, dimensionScore: 0.7, contribution: 4, reason: 'Meets the 4-source draw floor'},
    {dimension: 'consistency', weight: 0.07, dimensionScore: 0.6, contribution: 3, reason: '17 distinct cards, favours 4-ofs'},
    {dimension: 'ruleOfEight', weight: 0.06, dimensionScore: 0.5, contribution: 3, reason: '2 interchangeable cores'},
    {dimension: 'lore', weight: 0.05, dimensionScore: 0.6, contribution: 2, reason: 'Enough board lore to race'},
    {dimension: 'actionsCap', weight: 0.04, dimensionScore: 0.9, contribution: 2, reason: 'Well under the actions cap'},
    {dimension: 'shiftCoverage', weight: 0.03, dimensionScore: 0.4, contribution: 1, reason: 'Some Shift cards lack a same-named base'},
    {dimension: 'vulnerability-penalty', weight: -1, dimensionScore: 0.06, contribution: -6, reason: '2 vulnerabilities (1 high, 1 medium) subtract 6 points'},
  ],
  ...over,
});

const meta: Meta<typeof ScoreGauge> = {
  title: 'Deck/ScoreGauge',
  component: ScoreGauge,
  args: {onShowMath: () => {}},
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, width: 460, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Strong: Story = {args: {quality: quality()}};

export const Excellent: Story = {args: {quality: quality({score: 88})}};

export const Fair: Story = {args: {quality: quality({score: 52})}};

export const NeedsWork: Story = {args: {quality: quality({score: 34})}};

// A clean deck: the vulnerability row reports zero and no points are docked.
export const NoVulnerabilities: Story = {
  args: {
    quality: quality({
      score: 81,
      breakdown: quality().breakdown.map((b) =>
        b.dimension === 'vulnerability-penalty'
          ? {...b, dimensionScore: 0, contribution: 0, reason: 'No vulnerabilities detected.'}
          : b,
      ),
    }),
  },
};
