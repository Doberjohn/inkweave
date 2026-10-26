import type {Meta, StoryObj} from '@storybook/react-vite';
import {CtaButton, type CtaVariant} from './CtaButton';

const meta: Meta<typeof CtaButton> = {
  title: 'Shared/CtaButton',
  component: CtaButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// The four blessed variants (#509): filled = primary action, ghost = gold
// secondary, neutral = quiet secondary (warms to gold on hover), pill = nav promo.
export const Filled: Story = {args: {children: 'Browse all cards'}};
export const Ghost: Story = {args: {variant: 'ghost', children: 'Skip this pair'}};
export const Neutral: Story = {args: {variant: 'neutral', children: 'Cancel'}};
export const Pill: Story = {args: {variant: 'pill', children: 'Reveals'}};

// The full menu, enabled and disabled — the uniform disabled recipe
// (opacity 0.4 + not-allowed cursor) reads identically across variants.
export const Matrix: Story = {
  render: () => (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      {[false, true].map((disabled) => (
        <div key={String(disabled)} style={{display: 'flex', gap: 12}}>
          {(['filled', 'ghost', 'neutral', 'pill'] as CtaVariant[]).map((variant) => (
            <CtaButton key={variant} variant={variant} disabled={disabled}>
              {variant}
            </CtaButton>
          ))}
        </div>
      ))}
    </div>
  ),
};
