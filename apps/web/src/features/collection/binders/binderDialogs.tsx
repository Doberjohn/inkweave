import {useEffect, useEffectEvent, useId, useRef, type CSSProperties, type FocusEvent, type ReactNode, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {BottomSheet, DialogShell} from '../../../shared/components';
import {useDialogFocus, useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, FONT_WEIGHT, SPACING} from '../../../shared/constants';
import {FIELD} from './binderFields';
import {clampBinderName} from './binderName';
import {SHELF_FULL_WORDS} from './shelfWords';

/*
 * What the binder dialogs share: the phone's sheet, a small dialog that is a sheet on a phone, the
 * name field, and the line a save that didn't land says.
 */

interface PhoneSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Its name for screen readers: our words, never a binder's name, which stays out of attributes. */
  dialogName: string;
  /** Where focus goes as it opens; the sheet itself by default. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  sheetStyle?: CSSProperties;
  children: ReactNode;
}

/** The phone's sheet: the house hook trio over `BottomSheet`, in a portal so no ancestor's transform holds it. */
export function PhoneSheet({isOpen, onClose, dialogName, initialFocusRef, sheetStyle, children}: PhoneSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);
  const {handleKeyDown} = useDialogFocus({
    isOpen,
    containerRef: sheetRef,
    initialFocusRef: initialFocusRef ?? sheetRef,
    onClose,
  });
  if (!mounted) return null;
  return createPortal(
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      ariaLabel={dialogName}
      sheetRef={sheetRef}
      onKeyDown={handleKeyDown}
      sheetStyle={sheetStyle}>
      {children}
    </BottomSheet>,
    document.body,
  );
}

interface AskDialogProps extends Omit<PhoneSheetProps, 'sheetStyle'> {
  isMobile: boolean;
  size: 'sm' | 'md';
}

/** As tall as a dialog grows, so a long one (Change cover's cards) scrolls inside the sheet. */
const SHEET_CAP: CSSProperties = {maxHeight: '85vh'};

const SHEET_PAD: CSSProperties = {minHeight: 0, overflowY: 'auto', padding: `${SPACING.sm}px ${SPACING.lg}px ${SPACING.lg}px`};

/** A small binder dialog: a `DialogShell` on a computer and a tablet, a sheet on a phone (`.claude/rules/overlays.md`). */
export function AskDialog({isMobile, size, ...sheet}: AskDialogProps) {
  if (isMobile) {
    return (
      <PhoneSheet {...sheet} sheetStyle={SHEET_CAP}>
        <div style={SHEET_PAD}>{sheet.children}</div>
      </PhoneSheet>
    );
  }
  return (
    <DialogShell
      isOpen={sheet.isOpen}
      onClose={sheet.onClose}
      ariaLabel={sheet.dialogName}
      size={size}
      initialFocusRef={sheet.initialFocusRef}
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      {sheet.children}
    </DialogShell>
  );
}

/** Why a save didn't land: the shelf is full, the binder was deleted elsewhere, or it failed. */
export type SaveProblem = 'full' | 'gone' | 'failed';

const PROBLEM_WORDS: Record<SaveProblem, string> = {
  full: SHELF_FULL_WORDS,
  gone: "This binder isn't on your shelf anymore.",
  failed: "Couldn't save the binder. Try again.",
};

const PROBLEM_STYLE: CSSProperties = {margin: 0, fontSize: `${FONT_SIZES.base}px`, color: COLORS.error};

/** A failed save's line, over the buttons. */
export function ProblemLine({problem, style}: {problem: SaveProblem | null; style?: CSSProperties}) {
  if (problem === null) return null;
  return (
    <p role="alert" style={{...PROBLEM_STYLE, ...style}}>
      {PROBLEM_WORDS[problem]}
    </p>
  );
}

/**
 * Inside a dialog or a sheet, which unmount what they hold once their exit has run: it says so
 * then, and the page unmounts the dialog, whose figures would otherwise count each change of the
 * page's collection for no one.
 */
export function WhenGone({onGone}: {onGone: () => void}) {
  const gone = useEffectEvent(onGone);
  useEffect(() => () => gone(), []);
  return null;
}

/** Selects the field's words the first time it takes focus, so typing replaces them; later presses place the caret. */
function useSelectOnce() {
  const selected = useRef(false);
  return (event: FocusEvent<HTMLInputElement>) => {
    if (selected.current) return;
    selected.current = true;
    event.currentTarget.select();
  };
}

const LABEL: CSSProperties = {
  display: 'block',
  margin: `${SPACING.lg}px 0 ${SPACING.xs}px`,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: FONT_WEIGHT.semibold,
  color: COLORS.text,
};

interface NameFieldProps {
  value: string;
  /** Handed the name clamped to what the table holds (`clampBinderName`). */
  onChange: (name: string) => void;
  /** While a save runs: what it sends is the name it began with. */
  disabled: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}

/** A binder's Name, filled in and selected the first time it takes focus, so typing replaces it. */
export function NameField({value, onChange, disabled, inputRef}: NameFieldProps) {
  const id = useId();
  const selectOnce = useSelectOnce();
  return (
    <>
      <label htmlFor={id} style={LABEL}>
        Name
      </label>
      <input
        id={id}
        ref={inputRef}
        autoComplete="off"
        value={value}
        disabled={disabled}
        onFocus={selectOnce}
        onChange={(event) => onChange(clampBinderName(event.target.value))}
        style={FIELD}
      />
    </>
  );
}
