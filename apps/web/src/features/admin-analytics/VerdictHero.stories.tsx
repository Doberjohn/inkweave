import type {Meta, StoryObj} from '@storybook/react-vite';
import {VerdictHero} from './VerdictHero';

const meta: Meta<typeof VerdictHero> = {
  title: 'Features/AdminAnalytics/VerdictHero',
  component: VerdictHero,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const WellCalibrated: Story = {args: {meanGap: 0.12, accuracySentiment: 0.02}};
// Within the calibration band: reads "well-calibrated" with a neutral-toned
// number, the mild lean carried only by the read line (locks the band fix).
export const SlightLean: Story = {args: {meanGap: -0.3, accuracySentiment: 0.03}};
export const RunsGenerous: Story = {args: {meanGap: -0.93, accuracySentiment: 0.08}};
export const RunsHarsh: Story = {args: {meanGap: 0.7, accuracySentiment: -0.14}};
export const NoData: Story = {args: {meanGap: null, accuracySentiment: null}};
