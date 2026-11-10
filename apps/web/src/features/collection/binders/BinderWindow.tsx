import {useRef, useState, type CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CtaButton, DialogShell} from '../../../shared/components';
import {trackEvent} from '../../../shared/lib/analytics';
import {COLORS, DIALOG_TITLE, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import type {CollectionEntries} from '../collectionParser';
import {PhoneSheet, ProblemLine, WhenGone, type SaveProblem} from './binderDialogs';
import {LEAD as LEAD_TEXT} from './binderFields';
import {ruleKinds, type Binder} from './binderRules';
import {createBinder, updateBinder} from './binderShelf';
import {DraftCount, DraftCover, DraftPreview, RulesFields} from './BinderWindowParts';
import {startOf, useBinderDraft, type BinderDraft, type DraftStart, type NewStart} from './useBinderDraft';

export interface BinderWindowProps {
  isOpen: boolean;
  /** The binder Edit rules changes, or null for a new one. */
  binder: Binder | null;
  /**
   * A new binder's name, Sets and rules to start from: Save as a binder's, whose More rules opens
   * the window. Left out, a new binder starts empty.
   */
  seed?: NewStart;
  /** Every card a binder can hold, which its rules run over. */
  pool: readonly LorcanaCard[];
  entries: CollectionEntries;
  /** Whose shelf: the save waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** Told once the server has the binder, as it stored it; the caller closes the window. */
  onSaved: (binder: Binder) => void;
  onClose: () => void;
  /** Told once a closed window's exit has run, so the page can unmount it. */
  onGone: () => void;
}

/**
 * Makes the binder, or changes the one being edited, and counts it once it lands: never its name.
 * A binder Save as a binder began is `from: 'saved'`, made here or in its box.
 */
async function saveDraft({start, seeded}: {start: DraftStart; seeded: boolean}, readerId: string, draft: BinderDraft) {
  const {input, change} = draft;
  if (start.binder === null) {
    const made = await createBinder({readerId, input});
    if ('binder' in made) trackEvent('binder_created', {from: seeded ? 'saved' : 'window', kinds: ruleKinds(made.binder)});
    return made;
  }
  const changed = await updateBinder({readerId, id: start.binder.id, patch: input});
  if ('binder' in changed && change !== null) trackEvent('binder_changed', {what: change});
  return changed;
}

/**
 * The save, and what it came to. While it runs every way out waits, as the display name dialog's
 * does: the window alone would say it failed. A failure keeps everything the player picked. The
 * button, disabled while it runs, stops a second save: React draws a press's change before the next.
 */
function useSave(props: Pick<BinderWindowProps, 'readerId' | 'onSaved' | 'onClose' | 'seed'> & {start: DraftStart}, draft: BinderDraft) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const save = async () => {
    if (!draft.canSave) return;
    setSaving(true);
    setProblem(null);
    const result = await saveDraft({start: props.start, seeded: props.seed !== undefined}, props.readerId, draft);
    setSaving(false);
    if ('problem' in result) setProblem(result.problem);
    else props.onSaved(result.binder);
  };
  const close = () => {
    if (!saving) props.onClose();
  };
  return {saving, problem, save: () => void save(), close};
}

type Save = ReturnType<typeof useSave>;

/** The new binder's words, and an edit's. */
const NEW_WORDS = {dialogName: 'New binder', action: 'Create binder', phoneAction: 'Create'};
const EDIT_WORDS = {dialogName: 'Edit binder', action: 'Save changes', phoneAction: 'Save'};
const SAVING_WORDS = {action: 'Saving…', phoneAction: 'Saving…'};

/**
 * What the window says of itself: its title, its name for screen readers, which is ours and never
 * the binder's (that stays out of attributes), and its button's words.
 */
function wordsOf({binder}: DraftStart, saving: boolean) {
  const words = binder === null ? NEW_WORDS : EDIT_WORDS;
  const title = binder === null ? 'New binder' : `Edit ${binder.name}`;
  return {...words, title, ...(saving ? SAVING_WORDS : {})};
}

const LEAD = 'Pick the cards it holds. Your copies fill it on their own, and it grows with each new set.';
const NOTE = 'You can change its rules, name and cover later.';

/**
 * The New binder window, and Edit rules': the binder's name, its Sets and its rules,
 * beside what they would make, its cover, count, chips and first page, each following every
 * pick. A dialog on a computer and a tablet, a sheet on a phone (`.claude/rules/overlays.md`).
 * It creates nothing until Create binder, and only a binder with a name and a card.
 *
 * Lazy, in a chunk of its own, and only with binders on (`flag.ts`). It carries
 * `ph-no-capture`: its title and fields hold the player's own words.
 */
export function BinderWindow(props: BinderWindowProps) {
  const start = startOf(props.binder, props.seed);
  const draft = useBinderDraft({start, pool: props.pool, entries: props.entries});
  const save = useSave({...props, start}, draft);
  const words = wordsOf(start, save.saving);
  const nameRef = useRef<HTMLInputElement>(null);
  const isNew = props.binder === null;
  if (props.isMobile) {
    return <PhoneWindow {...props} draft={draft} save={save} words={words} />;
  }
  return (
    <DialogShell
      isOpen={props.isOpen}
      onClose={save.close}
      ariaLabel={words.dialogName}
      size="lg"
      initialFocusRef={nameRef}
      panelStyle={PANEL}>
      <div className="ph-no-capture" style={FRAME}>
        <WhenGone onGone={props.onGone} />
        <header style={HEAD}>
          <h2 style={DIALOG_TITLE}>{words.title}</h2>
          {isNew && <p style={LEAD_TEXT}>{LEAD}</p>}
        </header>
        <div style={COLUMNS}>
          <div style={RULES_COLUMN}>
            <RulesFields draft={draft} isMobile={false} locked={save.saving} nameRef={nameRef} />
          </div>
          {/* The preview scrolls, and past the cover's choices nothing in it takes focus, so it takes
              the focus itself and the keyboard scrolls it (WCAG 2.1.1). It stays a stop when
              everything fits, as with rules that hold few cards, at the cost of one Tab more. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll container, as the rule's docs allow */}
          <div role="region" aria-label="Preview" tabIndex={0} className="inset-focus-outline" style={PREVIEW_COLUMN}>
            <DraftPreview draft={draft} locked={save.saving} />
          </div>
        </div>
        <footer style={FOOT}>
          <ProblemLine problem={save.problem} />
          <div style={FOOT_ROW}>
            <p style={NOTE_STYLE}>{isNew && NOTE}</p>
            <CtaButton variant="neutral" onClick={save.close} disabled={save.saving}>
              Cancel
            </CtaButton>
            <CtaButton onClick={save.save} disabled={!draft.canSave || save.saving}>
              {words.action}
            </CtaButton>
          </div>
        </footer>
      </div>
    </DialogShell>
  );
}

interface PhoneWindowProps extends BinderWindowProps {
  draft: BinderDraft;
  save: Save;
  words: ReturnType<typeof wordsOf>;
}

/**
 * A phone's window: a sheet whose header holds Cancel, the title and Create, then the cover with
 * its count and bar, then Name, Sets and the Cover's designs, then the rules, each line's name over
 * its choices.
 */
function PhoneWindow({isOpen, onGone, draft, save, words}: PhoneWindowProps) {
  return (
    <PhoneSheet isOpen={isOpen} onClose={save.close} dialogName={words.dialogName} sheetStyle={TALL_SHEET}>
      <div className="ph-no-capture" style={SHEET_FRAME}>
        <WhenGone onGone={onGone} />
        <div style={SHEET_HEAD}>
          <CtaButton variant="ghost" onClick={save.close} disabled={save.saving}>
            Cancel
          </CtaButton>
          <h2 style={{...DIALOG_TITLE, fontSize: FONT_SIZES.xl, textAlign: 'center', minWidth: 0}}>{words.title}</h2>
          <CtaButton onClick={save.save} disabled={!draft.canSave || save.saving}>
            {words.phoneAction}
          </CtaButton>
        </div>
        <div style={SHEET_BODY}>
          <ProblemLine problem={save.problem} />
          <div style={PHONE_SUMMARY}>
            <div style={PHONE_COVER}>
              <DraftCover draft={draft} />
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <DraftCount draft={draft} />
            </div>
          </div>
          <RulesFields draft={draft} isMobile locked={save.saving} />
        </div>
      </div>
    </PhoneSheet>
  );
}

/** The panel holds its height, so the rules scroll inside it while the preview and the foot stay. */
const PANEL: CSSProperties = {
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  height: 'min(85vh, 860px)',
  overflow: 'hidden',
  fontFamily: FONTS.body,
};

const FRAME: CSSProperties = {flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'};

const HEAD: CSSProperties = {padding: `${SPACING.xl}px ${SPACING.xxxl}px ${SPACING.lg}px ${SPACING.xl}px`};

const COLUMNS: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 300px',
  borderTop: `1px solid ${COLORS.surfaceBorder}`,
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
};

const RULES_COLUMN: CSSProperties = {overflowY: 'auto', padding: `${SPACING.lg}px ${SPACING.xl}px`};

const PREVIEW_COLUMN: CSSProperties = {
  overflowY: 'auto',
  padding: SPACING.xl,
  borderLeft: `1px solid ${COLORS.surfaceBorder}`,
  background: COLORS.background,
};

const FOOT: CSSProperties = {padding: `${SPACING.md}px ${SPACING.xl}px`, display: 'flex', flexDirection: 'column', gap: SPACING.sm};

const FOOT_ROW: CSSProperties = {display: 'flex', alignItems: 'center', gap: SPACING.sm};

const NOTE_STYLE: CSSProperties = {flex: 1, margin: 0, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

/** The phone's window takes the screen, short of its top, so the rules scroll inside it. */
const TALL_SHEET: CSSProperties = {top: SPACING.xxxl};

const SHEET_FRAME: CSSProperties = {flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'};

const SHEET_HEAD: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: SPACING.sm,
  padding: `0 ${SPACING.lg}px ${SPACING.md}px`,
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
};

const SHEET_BODY: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: `${SPACING.lg}px ${SPACING.lg}px ${SPACING.xxl}px`,
};

/** Near a phone shelf's own cover width, so the plate's words fit as they do there. */
const PHONE_COVER: CSSProperties = {width: 150, flexShrink: 0};

const PHONE_SUMMARY: CSSProperties = {display: 'flex', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg};
