import {COLORS} from '../constants';

/** Blurred glow orb positioned absolutely within the background. */
function GlowOrb({
  size,
  x,
  y,
  color,
}: {
  size: number;
  x: string;
  y: string;
  color: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        left: x,
        top: y,
        borderRadius: '50%',
        background: color,
        filter: 'blur(64px)',
        pointerEvents: 'none',
      }}
    />
  );
}

interface EtherealBackgroundProps {
  isMobile?: boolean;
}

export function EtherealBackground({isMobile}: EtherealBackgroundProps) {
  return (
    <div
      data-testid="ethereal-background"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: isMobile
          ? 'linear-gradient(105deg, #020618 0%, #162456 50%, #0f172b 100%)'
          : `linear-gradient(180deg, ${COLORS.background} 0%, ${COLORS.surface} 50%, ${COLORS.background} 100%)`,
        pointerEvents: 'none',
      }}>
      {isMobile ? (
        <>
          {/* Mobile orbs — from Figma positions */}
          <GlowOrb size={300} x="24%" y="0px" color={COLORS.etherealBlue} />
          <GlowOrb size={300} x="-4%" y="64%" color={COLORS.etherealPurple} />
          <GlowOrb size={250} x="48%" y="50%" color={COLORS.etherealTeal} />
        </>
      ) : (
        <>
          {/* Desktop orbs */}
          <GlowOrb size={384} x="28.5%" y="0px" color={COLORS.etherealBlue} />
          <GlowOrb size={384} x="65.5%" y="77.5%" color={COLORS.etherealPurple} />
          <GlowOrb size={384} x="57%" y="56.5%" color={COLORS.etherealTeal} />
        </>
      )}
    </div>
  );
}
