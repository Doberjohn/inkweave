import {useRef, useState, type CSSProperties} from 'react';
import {CtaButton} from '../../../shared/components';
import {trackEvent} from '../../../shared/lib/analytics';
import {DIALOG_TITLE, SPACING} from '../../../shared/constants';
import {AskDialog, NameField, ProblemLine, WhenGone, type SaveProblem} from './binderDialogs';
import {isValidBinderName, trimBinderName} from './binderName';
import type {Binder} from './binderRules';
import {updateBinder} from './shelfStore';

export interface RenameBinderDialogProps {
  isOpen: boolean;
  /** The binder renamed. Kept by the shelf while the dialog closes, so its name stays through the exit. */
  binder: Binder;
  /** Whose shelf: the save waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** Told once the server has the new name; the caller closes the dialog. */
  onSaved: (binder: Binder) => void;
  onClose: () => void;
  /** Told once a closed dialog's exit has run, so the shelf can unmount it. */
  onGone: () => void;
}

/** What the dialog is called: our words, never the binder's name, which stays out of attributes. */
const DIALOG_NAME = 'Rename binder';

const BUTTONS: CSSProperties = {display: 'flex', gap: SPACING.sm, marginTop: SPACING.xl};

/** Renames the binder, and counts it once it lands: never its name. */
async function rename(readerId: string, binder: Binder, name: string) {
  const changed = await updateBinder({readerId, id: binder.id, patch: {name}});
  if ('binder' in changed) trackEvent('binder_changed', {what: 'name'});
  return changed;
}

/**
 * The ⋯ menu's Rename, built as the display name dialog is: the name filled in and selected, Save
 * once it is a name the table takes and another than the binder's, and Cancel. While the save
 * runs every way out waits, since the dialog alone would say it failed; a failure keeps the name
 * typed, with the window's line. A dialog on a computer and a tablet, a sheet on a phone.
 *
 * It carries `ph-no-capture`: the name is the player's own words.
 */
export function RenameBinderDialog(props: RenameBinderDialogProps) {
  const {binder, readerId, isMobile, onSaved, onClose} = props;
  const [name, setName] = useState(binder.name);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const trimmed = trimBinderName(name);
  const canSave = isValidBinderName(name) && trimmed !== binder.name && !saving;
  const save = async () => {
    setSaving(true);
    setProblem(null);
    const changed = await rename(readerId, binder, trimmed);
    setSaving(false);
    if ('problem' in changed) setProblem(changed.problem);
    else onSaved(changed.binder);
  };
  const close = () => {
    if (!saving) onClose();
  };
  return (
    <AskDialog
      isOpen={props.isOpen}
      isMobile={isMobile}
      onClose={close}
      dialogName={DIALOG_NAME}
      size="sm"
      initialFocusRef={isMobile ? undefined : nameRef}>
      <div className="ph-no-capture">
        <WhenGone onGone={props.onGone} />
        <h2 style={DIALOG_TITLE}>Rename binder</h2>
        <NameField value={name} onChange={setName} disabled={saving} inputRef={nameRef} />
        <ProblemLine problem={problem} style={{marginTop: SPACING.md}} />
        <div style={BUTTONS}>
          <CtaButton onClick={() => void save()} disabled={!canSave} style={{flex: 1}}>
            {saving ? 'Saving…' : 'Save'}
          </CtaButton>
          <CtaButton variant="neutral" onClick={close} disabled={saving} style={{flex: 1}}>
            Cancel
          </CtaButton>
        </div>
      </div>
    </AskDialog>
  );
}
