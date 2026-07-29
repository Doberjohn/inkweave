import './reveals.css';
import {FRANCHISES, type FranchiseConfig} from './franchise';
import {INK_COLORS, FONTS} from '../../shared/constants';
import {inkRgba} from './inkTint';

interface NewFranchisesProps {
  /** Opens the franchise's cards modal when its card is clicked. */
  onSelect?: (franchise: FranchiseConfig) => void;
  compact?: boolean;
}

/**
 * One debut-franchise card: real key art over an ink-tinted bloom, a "NEW THIS
 * SET" pill in that ink, the name, and a blurb. A button that opens the
 * franchise's cards modal. Held to its own component so the per-card `compact`
 * branches don't pile onto NewFranchises' complexity.
 */
function FranchiseCard({franchise, onSelect, compact}: {franchise: FranchiseConfig; onSelect?: (f: FranchiseConfig) => void; compact: boolean}) {
  const inkText = INK_COLORS[franchise.ink].text;
  return (
    <button
      type="button"
      className="reveal-franchise-card"
      onClick={() => onSelect?.(franchise)}
      aria-label={`View ${franchise.label} cards`}
      style={{
        position: 'relative',
        appearance: 'none',
        font: 'inherit',
        color: 'inherit',
        textAlign: 'left',
        padding: 0,
        width: '100%',
        display: 'block',
        background: '#0c0c15',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundImage: `radial-gradient(420px 200px at 50% -20%, ${inkRgba(franchise.ink, 0.16)}, transparent)`,
      }}
    >
      <div
        style={{
          height: compact ? 150 : 210,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? '12px 18px' : '16px 24px',
        }}
      >
        <img
          src={`/art/franchises/${franchise.id}.webp`}
          alt={franchise.label}
          // These assets are logo/title treatments, not scene art — contain them
          // so the full logo shows centered instead of being cropped.
          style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block'}}
        />
      </div>
      <div style={{padding: compact ? '14px 16px 18px' : '20px 22px 24px'}}>
        <span
          style={{
            display: 'inline-block',
            fontWeight: 600,
            fontSize: 10,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: inkText,
            border: `1px solid ${inkRgba(franchise.ink, 0.4)}`,
            background: inkRgba(franchise.ink, 0.1),
            padding: '4px 10px',
            borderRadius: 20,
          }}
        >
          New this set
        </span>
        <div style={{fontFamily: FONTS.hero, fontWeight: 400, fontSize: compact ? 22 : 26, color: '#f0f0f5', margin: '13px 0 0'}}>
          {franchise.label}
        </div>
        <p style={{fontWeight: 400, fontSize: compact ? 12 : 13, lineHeight: 1.55, color: '#c8c8d8', margin: '8px 0 0'}}>
          {franchise.blurb}
        </p>
      </div>
    </button>
  );
}

/**
 * The "new to the Inkverse" section: one card per debut franchise, each opening
 * that franchise's cards modal (via `onSelect`).
 */
export function NewFranchises({onSelect, compact = false}: NewFranchisesProps) {
  return (
    <section>
      <div style={{textAlign: 'center', marginBottom: compact ? 18 : 26}}>
        <div style={{fontWeight: 600, fontSize: compact ? 10 : 12, letterSpacing: compact ? 2.2 : 2.8, textTransform: 'uppercase', color: '#d4af37'}}>
          New to the Inkverse
        </div>
        <h2 style={{fontFamily: FONTS.hero, fontWeight: 400, fontSize: compact ? 23 : 32, color: '#ececf2', margin: '10px 0 0'}}>
          Three new franchises
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: compact ? 14 : 20,
        }}
      >
        {FRANCHISES.map((f) => (
          <FranchiseCard key={f.id} franchise={f} onSelect={onSelect} compact={compact} />
        ))}
      </div>
    </section>
  );
}
