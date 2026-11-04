import type {CSSProperties} from 'react';
import {CtaButton} from '../../../shared/components';
import {COLORS, DIALOG_BODY, DIALOG_TITLE, FONT_SIZES, LINE_HEIGHT, SPACING} from '../../../shared/constants';
import {AskDialog} from './binderDialogs';

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
  return (
    <AskDialog isOpen={isOpen} isMobile={isMobile} onClose={close} dialogName={DIALOG_NAME} size="sm">
      <AskBody name={name} deleting={deleting} failed={failed} onConfirm={onConfirm} onKeep={close} />
    </AskDialog>
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
