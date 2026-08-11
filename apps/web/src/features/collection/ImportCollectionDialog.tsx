import {useRef, useState} from 'react';
import {CtaButton, DialogShell} from '../../shared/components';
import {COLORS, DIALOG_BODY, DIALOG_TITLE, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';
import type {LorcanaCard} from '../deck/types';
import {parseCollectionCsv, type CollectionEntries, type CollectionSummary} from './collectionParser';

interface ImportCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The card pool the CSV rows are joined against. */
  pool: readonly LorcanaCard[];
  /**
   * Whether {@link pool} is COMPLETE. Required, not optional-defaulting-true, on
   * purpose: the non-Core sets load lazily, so for the first few hundred ms after
   * the dialog opens `pool` holds only the 1,024 Core cards. Parsing against that
   * partial pool does not fail — it silently reclassifies every non-Core row as
   * "outside Core" and drops it, which is roughly two thirds of a real
   * collection. A caller that has not thought about this should not compile.
   */
  isPoolReady: boolean;
  /**
   * Store the parsed collection. Returns null on success, or a message to show.
   * Wired to `useCollection().importCollection` by the page; taken as a prop so
   * this component needs no provider in tests or stories.
   */
  onImport: (entries: CollectionEntries, importedAt: number) => string | null;
}

/** Thousands separators: these numbers run to four digits and get compared. */
function count(n: number): string {
  return n.toLocaleString();
}

/** `3 cards` / `1 card`. A real collection never hits the singular, but a nearly
 *  empty one does, and "Another 1 cards" is the kind of thing people screenshot. */
function plural(n: number, one: string, many: string): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/**
 * The receipt. ALWAYS shown on success, unlike `ImportDeckDialog`, which closes
 * silently on a clean import because the deck list is its own receipt.
 *
 * A collection has no such surface: the cards land in a filter the user has not
 * opened yet. And roughly two thirds of a real collection is outside Core (1645
 * of 2476 distinct cards, measured), so an import that said nothing would look
 * like it had lost most of the file. Naming the remainder is the whole point.
 *
 * THE NON-CORE SENTENCE INVERTS WHEN COLLECTION VIEWING LANDS. It currently says
 * those cards are not part of your collection here, which is true today: the
 * parser stores only Core cards. Once Browse can show every set (Phase C of
 * `docs/deck-builder/2026-08-10-collection-view-and-image-pipeline-design.md`)
 * they ARE in the collection, just unavailable for deck building, and this copy
 * becomes a lie. Change it in the same commit that makes them visible.
 */
function SummaryStep({summary}: {summary: CollectionSummary}) {
  const problems = summary.unmatched.length + summary.unparsed.length;
  return (
    <>
      <p style={{...DIALOG_BODY, marginTop: SPACING.xs}}>
        {plural(summary.coreCardsOwned, 'Core card', 'Core cards')},{' '}
        {plural(summary.coreCopiesOwned, 'copy', 'copies')} in all.
      </p>
      {summary.nonCoreCardsOwned > 0 && (
        <p style={{...DIALOG_BODY, fontWeight: 400, marginTop: SPACING.sm}}>
          {summary.nonCoreCardsOwned === 1
            ? 'Another card you own is'
            : `Another ${count(summary.nonCoreCardsOwned)} cards you own are`}{' '}
          from sets 1 to 8, which the Core format does not use.
        </p>
      )}
      {problems > 0 && (
        <p style={{...DIALOG_BODY, fontWeight: 400, marginTop: SPACING.sm}}>
          {plural(problems, 'row', 'rows')} could not be read, and {problems === 1 ? 'was' : 'were'}{' '}
          skipped.
        </p>
      )}
    </>
  );
}

/**
 * The file input is visually hidden rather than `display: none`. The visible
 * `CtaButton` is what anyone actually operates — it forwards the click — but
 * `display: none` drops the input out of the accessibility tree entirely and
 * makes it impossible to focus or drive, so the standard clip is used instead.
 * No behavioural cost, and the real control stays reachable.
 */
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** What to upload, and where it comes from. */
function ChooseStep({
  onPick,
  busy,
  isPoolReady,
}: {
  onPick: (file: File) => void;
  busy: boolean;
  isPoolReady: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <p style={{...DIALOG_BODY, fontWeight: 400, marginTop: SPACING.xs}}>
        Export your collection from Dreamborn as CSV, then choose the file here. Importing
        replaces whatever collection Inkweave already has.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Collection CSV file"
        style={VISUALLY_HIDDEN}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset the input so choosing the SAME file twice still fires a change
          // event — otherwise a failed import cannot be retried with one click.
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
      <CtaButton
        variant="ghost"
        disabled={busy || !isPoolReady}
        onClick={() => inputRef.current?.click()}
        style={{marginTop: SPACING.md, width: '100%'}}>
        {busy ? 'Reading…' : isPoolReady ? 'Choose a CSV file' : 'Loading card list…'}
      </CtaButton>
    </>
  );
}

/**
 * Dreamborn collection import (#553). Takes the CSV export, joins it to the Core
 * pool on `(set, number)`, and hands the owned cards to `onImport`.
 *
 * A FILE, not a paste, unlike the decklist import beside it: a Dreamborn
 * collection export is a census of every printed card, 5329 rows and 300 KB, so
 * a textarea would be the wrong instrument by two orders of magnitude.
 */
export function ImportCollectionDialog({
  isOpen,
  onClose,
  pool,
  isPoolReady,
  onImport,
}: ImportCollectionDialogProps) {
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setSummary(null);
    setError(null);
    setBusy(false);
    onClose();
  };

  const runImport = async (file: File) => {
    // The one funnel every import passes through, so the incomplete-pool guard
    // lives here rather than only on the button: a disabled button still leaves
    // drag-drop and programmatic paths open, and getting this wrong is silent.
    if (!isPoolReady) {
      setError('Still loading the full card list. Try again in a moment.');
      return;
    }
    setBusy(true);
    setError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setBusy(false);
      setError('That file could not be read. Try exporting it from Dreamborn again.');
      return;
    }

    const {entries, summary: parsed} = parseCollectionCsv(text, pool);
    setBusy(false);

    // Nothing owned is not a storage failure, and must not be reported as one:
    // the likeliest cause is the wrong file, so say that instead.
    if (parsed.coreCardsOwned === 0 && parsed.nonCoreCardsOwned === 0) {
      setError('No owned cards were found in that file. Is it a Dreamborn collection export?');
      return;
    }

    const storageError = onImport(entries, Date.now());
    if (storageError !== null) {
      setError(storageError);
      return;
    }
    setSummary(parsed);
  };

  const title = summary ? 'Collection imported' : 'Import your collection';

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      ariaLabel="Import your collection"
      size="md"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={DIALOG_TITLE}>{title}</h2>

      {summary ? (
        <SummaryStep summary={summary} />
      ) : (
        <ChooseStep onPick={(file) => void runImport(file)} busy={busy} isPoolReady={isPoolReady} />
      )}

      {error !== null && (
        <p
          role="alert"
          style={{
            ...DIALOG_BODY,
            fontWeight: 400,
            color: COLORS.error,
            fontSize: `${FONT_SIZES.sm}px`,
            marginTop: SPACING.sm,
          }}>
          {error}
        </p>
      )}

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        {summary ? (
          <CtaButton onClick={close} style={{flex: 1}}>
            Done
          </CtaButton>
        ) : (
          <CtaButton variant="neutral" onClick={close} style={{flex: 1}}>
            Cancel
          </CtaButton>
        )}
      </div>
    </DialogShell>
  );
}
