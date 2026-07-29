import {useState} from 'react';
import {CtaButton, DialogShell} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import type {DeckCard, LorcanaCard} from '../types';
import {parseDecklist, resolveDecklist} from '../deckTransfer';

interface ImportDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The Core card pool the pasted names are matched against. */
  pool: readonly LorcanaCard[];
  /** Replaces the deck with the imported cards. */
  onImport: (cards: DeckCard[]) => void;
  /** Cards currently in the deck — an import replaces them, so warn first. */
  currentCardCount: number;
}

/** Only the lines Inkweave could not use — a clean import closes without a receipt. */
interface ImportResult {
  skipped: string[];
}

const PLACEHOLDER = `4 Angel - Experiment 624 (11-191)
4 Nani - Stage Manager
2 Bambi - Ethereal Fawn`;

/** The pasted list, before it is read. */
function PasteStep({
  text,
  onChange,
  currentCardCount,
}: {
  text: string;
  onChange: (value: string) => void;
  currentCardCount: number;
}) {
  return (
    <>
      <p style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, marginTop: SPACING.xs}}>
        Paste a decklist from Dreamborn, Duels.ink, or anywhere else — one card per line.
        The <code>(set-number)</code> is optional.
      </p>
      <textarea
        aria-label="Decklist to import"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={10}
        style={{
          width: '100%',
          marginTop: SPACING.md,
          padding: SPACING.sm,
          background: COLORS.surfaceAlt,
          border: `1px solid ${COLORS.surfaceBorder}`,
          borderRadius: RADIUS.md,
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
          resize: 'vertical',
        }}
      />
      {currentCardCount > 0 && (
        <p style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, marginTop: SPACING.sm}}>
          This replaces the {currentCardCount} cards currently in your deck.
        </p>
      )}
    </>
  );
}

/**
 * Shown ONLY when lines could not be used — the deck itself is the receipt for a
 * clean import, so success closes silently.
 */
function SkippedStep({result}: {result: ImportResult}) {
  return (
    <>
      <p style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, marginTop: SPACING.xs}}>
        The rest of the deck was imported. Inkweave covers the Core format (sets 9 and up),
        and these lines matched no Core card:
      </p>
      <ul style={{margin: `${SPACING.md}px 0 0`, paddingLeft: SPACING.lg, color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>
        {result.skipped.map((line) => (
          <li key={line} style={{marginBottom: 2}}>
            {line}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Paste-a-decklist import (#473). Reads the community format (`4 Name (11-191)`,
 * the ref optional), matches BY NAME against the Core pool, and REPLACES the deck.
 * Lines that match nothing are reported rather than dropped silently — a pasted
 * Infinity deck legitimately contains cards Core has no entry for.
 */
export function ImportDeckDialog({isOpen, onClose, pool, onImport, currentCardCount}: ImportDeckDialogProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const close = () => {
    setText('');
    setResult(null);
    onClose();
  };

  const runImport = () => {
    const {lines, unparsed} = parseDecklist(text);
    const {cards, unmatched} = resolveDecklist(lines, pool);
    onImport(cards);

    // A clean import needs no receipt — the deck list itself shows the result. Only
    // stay open when there is something the user would otherwise not know about.
    const skipped = [...unmatched, ...unparsed];
    if (skipped.length === 0) {
      close();
      return;
    }
    setResult({skipped});
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      ariaLabel="Import a decklist"
      size="md"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>
        {result ? `Skipped ${result.skipped.length} ${result.skipped.length === 1 ? 'card' : 'cards'}` : 'Import a deck'}
      </h2>

      {result ? <SkippedStep result={result} /> : <PasteStep text={text} onChange={setText} currentCardCount={currentCardCount} />}

      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        {result ? (
          <CtaButton onClick={close} style={{flex: 1}}>
            Got it
          </CtaButton>
        ) : (
          <>
            <CtaButton onClick={runImport} disabled={text.trim() === ''} style={{flex: 1}}>
              Import
            </CtaButton>
            <CtaButton variant="neutral" onClick={close} style={{flex: 1}}>
              Cancel
            </CtaButton>
          </>
        )}
      </div>
    </DialogShell>
  );
}
