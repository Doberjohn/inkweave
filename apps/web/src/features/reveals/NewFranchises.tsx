import {FRANCHISES} from './franchise';
import {INK_COLORS, FONTS} from '../../shared/constants';
import {inkRgba} from './inkTint';

interface NewFranchisesProps {
  compact?: boolean;
}

/**
 * The "new to the Inkverse" section: one card per debut franchise, each with its
 * real key art, an ink-tinted bloom, a "NEW THIS SET" pill in that ink, the
 * franchise name, and a one-line blurb. The ink tint is the curated association
 * from franchise.ts.
 */
export function NewFranchises({compact = false}: NewFranchisesProps) {
  return (
    <section>
      <div style={{textAlign: 'center', marginBottom: compact ? 18 : 26}}>
        <div style={{fontWeight: 600, fontSize: compact ? 10 : 12, letterSpacing: compact ? 2.2 : 2.8, textTransform: 'uppercase', color: '#d4af37'}}>
          New to the Inkverse
        </div>
        <h2 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: compact ? 23 : 32, color: '#ececf2', margin: '10px 0 0'}}>
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
        {FRANCHISES.map((f) => {
          const inkText = INK_COLORS[f.ink].text;
          return (
            <article
              key={f.id}
              style={{
                position: 'relative',
                background: '#0c0c15',
                border: '1px solid #24243a',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                backgroundImage: `radial-gradient(420px 200px at 50% -20%, ${inkRgba(f.ink, 0.16)}, transparent)`,
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
                  src={`/art/franchises/${f.id}.webp`}
                  alt={f.label}
                  // These assets are logo/title treatments, not scene art — contain
                  // them so the full logo shows centered instead of being cropped.
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
                    border: `1px solid ${inkRgba(f.ink, 0.4)}`,
                    background: inkRgba(f.ink, 0.1),
                    padding: '4px 10px',
                    borderRadius: 20,
                  }}
                >
                  New this set
                </span>
                <h3 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: compact ? 22 : 26, color: '#f0f0f5', margin: '13px 0 0'}}>
                  {f.label}
                </h3>
                <p style={{fontWeight: 400, fontSize: compact ? 12 : 13, lineHeight: 1.55, color: '#c8c8d8', margin: '8px 0 0'}}>
                  {f.blurb}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
