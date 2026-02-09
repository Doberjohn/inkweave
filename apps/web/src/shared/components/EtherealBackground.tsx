import {COLORS} from '../constants';

const orbStyle = (
  size: number,
  x: string,
  y: string,
  color: string,
): React.CSSProperties => ({
  position: 'absolute',
  width: size,
  height: size,
  left: x,
  top: y,
  borderRadius: '50%',
  background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
  pointerEvents: 'none',
});

export function EtherealBackground() {
  return (
    <div
      data-testid="ethereal-background"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${COLORS.background} 0%, ${COLORS.surface} 50%, ${COLORS.background} 100%)`,
        pointerEvents: 'none',
      }}>
      <div style={orbStyle(600, '-120px', '-80px', COLORS.etherealPurple)} />
      <div style={orbStyle(500, '65%', '55%', COLORS.etherealGold)} />
      <div style={orbStyle(450, '75%', '5%', COLORS.etherealEmerald)} />
    </div>
  );
}
