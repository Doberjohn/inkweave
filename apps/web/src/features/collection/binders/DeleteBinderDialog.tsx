import {useRef, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {BottomSheet, CtaButton, DialogShell} from '../../../shared/components';
import {useDialogFocus, useScrollLock, useTransitionPresence} from '../../../shared/hooks';
import {COLORS, DIALOG_BODY, DIALOG_TITLE, FONTS, FONT_SIZES, LINE_HEIGHT, SPACING} from '../../../shared/constants';

export interface DeleteBinderDialogProps {
  isOpen: boolean;
  /** The binder asked about. Kept by the shelf while the dialog closes, so its words stay through the exit. */
  name: string;
  isMobile: boolean;
  /** The delete is on its way: the dialog stays, its buttons wait. */
  deleting: boolean;
  /** The last delete failed: the dialog says so and offers it again. */
  failed: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** What the dialog is called: our words, never the binder's name, which stays out of attributes. */
const DIALOG_NAME = 'Delete binder';

const BODY: CSSProperties = {...DIALOG_BODY, marginTop: SPACING.sm, lineHeight: LINE_HEIGHT.relaxed};

const FAILED: CSSProperties = {margin: `${SPACING.md}px 0 0`, color: COLORS.error, fontSize: `${FONT_SIZES.base}px`};

const BUTTONS: CSSProperties = {display: 'flex', gap: SPACING.sm, marginTop: SPACING.xl};

/**
 * The confirm before a binder of your own is deleted (#1074): "Delete Amber?", what goes and what
 * stays, then Delete binder or Keep it. Nothing is deleted before Delete binder. A dialog on a
 * computer, a sheet on a phone (`.claude/rules/overlays.md`). While the delete is on its way it
 * stays open, Escape and the backdrop included, since it alone would say the delete failed.
 *
 * Its content carries `ph-no-capture`: the title is the player's own words.
 */
export function DeleteBinderDialog({isOpen, name, isMobile, deleting, failed, onConfirm, onClose}: DeleteBinderDialogProps) {
  const close = () => {
    if (!deleting) onClose();
  };
  const body = <AskBody name={name} deleting={deleting} failed={failed} onConfirm={onConfirm} onKeep={close} />;
  if (isMobile) {
    return (
      <PhoneSheet isOpen={isOpen} onClose={close}>
        {body}
      </PhoneSheet>
    );
  }
  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      ariaLabel={DIALOG_NAME}
      size="sm"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      {body}
    </DialogShell>
  );
}

interface AskBodyProps {
  name: string;
  deleting: boolean;
  failed: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}

function AskBody({name, deleting, failed, onConfirm, onKeep}: AskBodyProps) {
  return (
    <div className="ph-no-capture">
      <h2 style={DIALOG_TITLE}>{`Delete ${name}?`}</h2>
      <p style={BODY}>The binder goes from your shelf. Your cards stay in My collection.</p>
      {failed && !deleting && (
        <p role="alert" style={FAILED}>
          Couldn&apos;t delete it. Try again.
        </p>
      )}
      <div style={BUTTONS}>
        <CtaButton onClick={onConfirm} disabled={deleting} style={{flex: 1}}>
          {deleting ? 'Deleting…' : 'Delete binder'}
        </CtaButton>
        <CtaButton variant="neutral" onClick={onKeep} disabled={deleting} style={{flex: 1}}>
          Keep it
        </CtaButton>
      </div>
    </div>
  );
}

/** The phone's sheet: the house hook trio over `BottomSheet`, in a portal so no ancestor's transform holds it. */
function PhoneSheet({isOpen, onClose, children}: {isOpen: boolean; onClose: () => void; children: ReactNode}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const {mounted, visible, onTransitionEnd} = useTransitionPresence(isOpen);
  useScrollLock(isOpen);
  const {handleKeyDown} = useDialogFocus({isOpen, containerRef: sheetRef, initialFocusRef: sheetRef, onClose});
  if (!mounted) return null;
  return createPortal(
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onTransitionEnd={onTransitionEnd}
      ariaLabel={DIALOG_NAME}
      sheetRef={sheetRef}
      onKeyDown={handleKeyDown}>
      <div style={{padding: `${SPACING.sm}px ${SPACING.lg}px ${SPACING.lg}px`}}>{children}</div>
    </BottomSheet>,
    document.body,
  );
}
