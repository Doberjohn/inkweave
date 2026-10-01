import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import type {HealthAnalyzer} from '../types';
import {HealthGlance} from './HealthGlance';

const an = (id: string, label: string, status: HealthAnalyzer['status'], message: string): HealthAnalyzer => ({
  id,
  label,
  status,
  message,
  score: status === 'bad' ? 20 : status === 'warn' ? 55 : 85,
});

const meta: Meta<typeof HealthGlance> = {
  title: 'Deck/HealthGlance',
  component: HealthGlance,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, width: 360, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {vulnerabilities: []},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const OneProblem: Story = {
  args: {
    analyzers: [
      an('curve', 'Curve', 'good', 'Curve looks healthy'),
      an('removal', 'Removal', 'bad', 'Only 4 removal cards — you may struggle to answer threats'),
      an('draw', 'Draw', 'warn', 'Card draw is a little thin'),
      an('synergyDensity', 'Synergy', 'good', 'Cards wire together well'),
    ],
  },
};

export const AllHealthy: Story = {
  args: {
    analyzers: [
      an('curve', 'Curve', 'good', 'ok'),
      an('removal', 'Removal', 'good', 'ok'),
      an('synergyDensity', 'Synergy', 'good', 'ok'),
    ],
  },
};
