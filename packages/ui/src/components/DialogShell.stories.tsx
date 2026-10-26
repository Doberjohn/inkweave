import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../tokens/theme';
import {CtaButton} from './CtaButton';
import {DialogShell} from './DialogShell';

const meta: Meta<typeof DialogShell> = {
  title: 'Shared/DialogShell',
  component: DialogShell,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** No Close button of its own: the shell draws the ×, and a second "Close" breaks the ruling. */
function DemoContent() {
  return (
    <div style={{padding: SPACING.lg, color: COLORS.text, fontFamily: FONTS.body}}>
      <h2 style={{margin: 0, fontSize: FONT_SIZES.xl}}>The overlay contract</h2>
      <p style={{color: COLORS.textMuted, fontSize: FONT_SIZES.base}}>
        The × closes. Escape closes. Backdrop click closes. Tab cycles inside. Focus restores on close.
      </p>
    </div>
  );
}

function OpenableShell(props: {size?: 'sm' | 'md' | 'lg'; scrim?: 'default' | 'heavy'; goldRing?: boolean}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{height: 500, padding: SPACING.lg}}>
      <CtaButton onClick={() => setOpen(true)}>Open dialog</CtaButton>
      <DialogShell isOpen={open} onClose={() => setOpen(false)} ariaLabel="Demo dialog" {...props}>
        <DemoContent />
      </DialogShell>
    </div>
  );
}

export const Medium: Story = {render: () => <OpenableShell />};

export const SmallWithGoldRing: Story = {render: () => <OpenableShell size="sm" goldRing />};

// Lightbox-grade separation: the heavier scrim token.
export const HeavyScrim: Story = {render: () => <OpenableShell scrim="heavy" size="lg" />};
