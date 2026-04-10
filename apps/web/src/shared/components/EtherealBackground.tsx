import {COLORS} from '../constants';

/** Blurred glow orb positioned absolutely within the background. */
function GlowOrb({size, x, y, color, blur}: {size: number; x: string; y: string; color: string; blur: number}) {
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
        filter: `blur(${blur}px)`,
        pointerEvents: 'none',
      }}
    />
  );
}

/** Vivid orb colors: higher opacity for pages that need more atmosphere */
const VIVID_COLORS = {
  blue: 'rgba(43, 127, 255, 0.22)',
  purple: 'rgba(173, 70, 255, 0.2)',
  amber: 'rgba(212, 175, 55, 0.12)',
  teal: 'rgba(0, 187, 167, 0.1)',
};

interface EtherealBackgroundProps {
  isMobile?: boolean;
  /** Higher opacity orbs with additional colors for immersive pages */
  vivid?: boolean;
}

export function EtherealBackground({isMobile, vivid}: EtherealBackgroundProps) {
  const blur = vivid ? 60 : 40;

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
          <GlowOrb size={300} x="24%" y="0px" color={vivid ? VIVID_COLORS.blue : COLORS.etherealBlue} blur={blur} />
          <GlowOrb size={300} x="-4%" y="64%" color={vivid ? VIVID_COLORS.purple : COLORS.etherealPurple} blur={blur} />
          <GlowOrb size={250} x="48%" y="50%" color={vivid ? VIVID_COLORS.teal : COLORS.etherealTeal} blur={blur} />
        </>
      ) : (
        <>
          <GlowOrb size={vivid ? 450 : 384} x="28.5%" y="0px" color={vivid ? VIVID_COLORS.blue : COLORS.etherealBlue} blur={blur} />
          <GlowOrb size={vivid ? 450 : 384} x="65.5%" y="77.5%" color={vivid ? VIVID_COLORS.purple : COLORS.etherealPurple} blur={blur} />
          <GlowOrb size={vivid ? 400 : 384} x="57%" y="56.5%" color={vivid ? VIVID_COLORS.teal : COLORS.etherealTeal} blur={blur} />
          {vivid && (
            <GlowOrb size={350} x="10%" y="60%" color={VIVID_COLORS.amber} blur={70} />
          )}
        </>
      )}
    </div>
  );
}
