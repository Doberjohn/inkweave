import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';
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

function DemoContent({onClose}: {onClose: () => void}) {
  return (
    <div style={{padding: SPACING.lg, color: COLORS.text, fontFamily: FONTS.body}}>
      <h2 style={{margin: 0, fontSize: FONT_SIZES.xl}}>The overlay contract</h2>
      <p style={{color: COLORS.textMuted, fontSize: FONT_SIZES.base}}>
        Escape closes. Backdrop click closes. Tab cycles inside. Focus restores on close.
      </p>
      <CtaButton variant="neutral" onClick={onClose}>
        Close
      </CtaButton>
    </div>
  );
}

function OpenableShell(props: {size?: 'sm' | 'md' | 'lg'; scrim?: 'default' | 'heavy'; goldRing?: boolean}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{height: 500, padding: SPACING.lg}}>
      <CtaButton onClick={() => setOpen(true)}>Open dialog</CtaButton>
      <DialogShell isOpen={open} onClose={() => setOpen(false)} ariaLabel="Demo dialog" {...props}>
        <DemoContent onClose={() => setOpen(false)} />
      </DialogShell>
    </div>
  );
}

export const Medium: Story = {render: () => <OpenableShell />};

export const SmallWithGoldRing: Story = {render: () => <OpenableShell size="sm" goldRing />};

// Lightbox-grade separation: the heavier scrim token.
export const HeavyScrim: Story = {render: () => <OpenableShell scrim="heavy" size="lg" />};
