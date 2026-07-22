import {useRef, useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONT_SIZES, SPACING} from '../constants';
import {useDialogFocus, useTransitionPresence} from '../hooks';
import {BottomSheet} from './BottomSheet';
import {CtaButton} from './CtaButton';

const meta: Meta<typeof BottomSheet> = {
  title: 'Shared/BottomSheet',
  component: BottomSheet,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The chrome wired to the house hook trio, exactly as the two sheets consume it. */
function DemoSheet() {
  const [open, setOpen] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(open);
  const {handleKeyDown} = useDialogFocus({
    isOpen: open,
    containerRef: sheetRef,
    initialFocusRef: sheetRef,
    onClose: () => setOpen(false),
  });

  return (
    <div style={{height: 500, padding: SPACING.lg}}>
      <CtaButton onClick={() => setOpen(true)}>Open sheet</CtaButton>
      {mounted && (
        <BottomSheet
          visible={visible}
          onClose={() => setOpen(false)}
          onTransitionEnd={onTransitionEnd}
          ariaLabel="Demo sheet"
          sheetRef={sheetRef}
          onKeyDown={handleKeyDown}
          sheetStyle={{maxHeight: '60vh'}}>
          <div style={{padding: SPACING.lg, color: COLORS.text, fontSize: FONT_SIZES.base}}>
            Backdrop, drag handle, slide-up chrome, and the iOS safe-area inset — shared by both
            sheets instead of copy-pasted.
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

export const Default: Story = {render: () => <DemoSheet />};
