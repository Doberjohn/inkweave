import type {Meta, StoryObj} from '@storybook/react-vite';
import {RaritySymbol} from './RaritySymbol';
import {RARITIES} from '../lib/rarity';
import {CAP_LABEL_XS, FONT_WEIGHT} from '../tokens/theme';

const meta: Meta<typeof RaritySymbol> = {
  title: 'Features/Reveals/RaritySymbol',
  component: RaritySymbol,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {rarity: 'super rare', size: 32},
};

export const AllRarities: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 28, alignItems: 'flex-end', padding: 24}}>
      {RARITIES.map((r) => (
        <div key={r.key} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <RaritySymbol rarity={r.key} size={32} />
          <span style={{...CAP_LABEL_XS, fontWeight: FONT_WEIGHT.semibold}}>{r.name}</span>
        </div>
      ))}
    </div>
  ),
};
