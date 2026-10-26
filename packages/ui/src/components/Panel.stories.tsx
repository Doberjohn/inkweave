import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, NEUTRAL_LADDER, SPACING, TABULAR} from '../tokens/theme';
import {LinkButton} from './LinkButton';
import {Panel} from './Panel';

const meta: Meta<typeof Panel> = {
  title: 'Shared/Panel',
  component: Panel,
  tags: ['autodocs'],
  parameters: {layout: 'padded'},
  decorators: [
    (Story) => (
      <div style={{color: COLORS.text, fontFamily: FONTS.body, maxWidth: 960}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const RULES = [
  {name: 'Ramp', gap: '−0.57'},
  {name: 'Shift targets', gap: '+0.83'},
  {name: 'Location payoff', gap: '−2.90'},
  {name: 'Song support', gap: '—'},
];

const VOTES = [
  {pair: 'Maui × Fishhook', score: '5'},
  {pair: 'Elsa - Spirit × Elsa - Snow Queen', score: '8'},
  {pair: 'Cogsworth × Beast’s Castle', score: '—'},
];

const CELL: React.CSSProperties = {padding: `${SPACING.sm}px ${SPACING.lg}px`, textAlign: 'left'};

/** A titled panel with an action in its header: a named region. */
export const Titled: Story = {
  args: {children: null},
  render: () => (
    <Panel
      title="Rules to review"
      action={
        <LinkButton type="button" size="sm" onClick={() => {}}>
          Open calibration →
        </LinkButton>
      }>
      {RULES.map((rule) => (
        <div
          key={rule.name}
          style={{display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 56px', gap: SPACING.md}}>
          <span>{rule.name}</span>
          <span style={{...TABULAR, textAlign: 'right'}}>{rule.gap}</span>
        </div>
      ))}
    </Panel>
  ),
};

/** `padded={false}`: a table runs edge to edge, and the header keeps its padding and a rule. */
export const Flush: Story = {
  args: {children: null},
  render: () => (
    <Panel title="Vote log" action="3 votes · 3 voters" padded={false}>
      <table style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{color: COLORS.textMuted}}>
            <th scope="col" style={CELL}>
              Pair
            </th>
            <th scope="col" style={CELL}>
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {VOTES.map((vote) => (
            <tr key={vote.pair} style={{borderTop: `1px solid ${NEUTRAL_LADDER.border}`}}>
              <td style={CELL}>{vote.pair}</td>
              <td style={{...CELL, ...TABULAR}}>{vote.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  ),
};

/** No title and no action: a plain surface, no landmark. */
export const Untitled: Story = {
  args: {children: <span style={{color: COLORS.textMuted}}>A panel with no header.</span>},
};
