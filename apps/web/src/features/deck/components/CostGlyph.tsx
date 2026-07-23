import {COLORS} from '../../../shared/constants';
import {InkwellIcon} from '../../../shared/components/InkwellIcon';

interface CostGlyphProps {
  /** Ink cost shown in the centre; >= 9 renders as "9+". */
  cost: number;
  /** true → inkable symbol; false → uninkable symbol. */
  inkwell: boolean;
  /** Square px size of the glyph (default 28). */
  size?: number;
}

// One glyph per card: the inkable / uninkable filter symbol (InkwellIcon) with the
// cost number overlaid dead-centre — mirrors the real card (the cost sits inside the
// inkwell symbol) and folds cost + inkability into a single mark.
export function CostGlyph({cost, inkwell, size = 28}: CostGlyphProps) {
  const label = cost >= 9 ? '9+' : String(cost);
  const fontSize = cost >= 9 ? size * 0.3 : size * 0.36;
  return (
    <span style={{position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0}}>
      <InkwellIcon value={inkwell ? 'inkable' : 'uninkable'} size={size} decorative={false} />
      <span style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: COLORS.white, fontSize, fontWeight: 700, lineHeight: 1, pointerEvents: 'none', userSelect: 'none'}}>
        {label}
      </span>
    </span>
  );
}
