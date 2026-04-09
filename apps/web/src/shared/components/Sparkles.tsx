import {useState, useEffect, useCallback} from 'react';

interface Sparkle {
  id: string;
  createdAt: number;
  color: string;
  size: number;
  style: React.CSSProperties;
}

interface SparklesProps {
  /** Color of sparkles. Default '#ffd700' (gold). */
  color?: string;
  /** Min sparkle size in px. Default 4. */
  minSize?: number;
  /** Max sparkle size in px. Default 10. */
  maxSize?: number;
  /** Interval in ms between spawns. Default 400. */
  rate?: number;
  children: React.ReactNode;
}

const SPARKLE_LIFETIME_MS = 1000;

/** Inject keyframes once */
(function injectKeyframes() {
  const STYLE_ID = 'sparkle-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes sparkle-spin {
      0%   { transform: rotate(0deg) scale(0); }
      50%  { transform: rotate(90deg) scale(1); }
      100% { transform: rotate(180deg) scale(0); }
    }
    @keyframes sparkle-grow {
      0%   { transform: scale(0); }
      50%  { transform: scale(1); }
      100% { transform: scale(0); }
    }
  `;
  document.head.appendChild(style);
})();

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateSparkle(color: string, minSize: number, maxSize: number): Sparkle {
  const size = randomBetween(minSize, maxSize);
  return {
    id: String(Math.random()),
    createdAt: Date.now(),
    color,
    size,
    style: {
      position: 'absolute',
      top: `${randomBetween(0, 100)}%`,
      left: `${randomBetween(0, 100)}%`,
      pointerEvents: 'none',
      zIndex: 2,
    },
  };
}

/** 4-point star SVG path */
function SparkleIcon({size, color}: {size: number; color: string}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      style={{display: 'block'}}>
      <path
        d="M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Wraps children with randomly spawning sparkle particles.
 * Each sparkle appears at a random position, spins/scales in and out,
 * and is garbage collected after its lifetime.
 *
 * Respects prefers-reduced-motion by showing 2 static sparkles.
 */
export function Sparkles({
  color = '#ffd700',
  minSize = 4,
  maxSize = 10,
  rate = 400,
  children,
}: SparklesProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>(() => [
    generateSparkle(color, minSize, maxSize),
    generateSparkle(color, minSize, maxSize),
  ]);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const addSparkle = useCallback(() => {
    const now = Date.now();
    setSparkles((prev) => [
      // Garbage collect expired sparkles
      ...prev.filter((s) => now - s.createdAt < SPARKLE_LIFETIME_MS),
      generateSparkle(color, minSize, maxSize),
    ]);
  }, [color, minSize, maxSize]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(addSparkle, rate);
    return () => clearInterval(interval);
  }, [addSparkle, rate, prefersReducedMotion]);

  return (
    <span style={{position: 'relative', display: 'block', flex: 1, minWidth: 0}}>
      {sparkles.map((sparkle) => (
        <span
          key={sparkle.id}
          style={{
            ...sparkle.style,
            animation: prefersReducedMotion
              ? undefined
              : `sparkle-grow ${SPARKLE_LIFETIME_MS}ms ease-in-out forwards`,
          }}>
          {/* Outer wrapper for rotation (separate from scale to avoid transform conflict) */}
          <span
            style={{
              display: 'block',
              animation: prefersReducedMotion
                ? undefined
                : `sparkle-spin ${SPARKLE_LIFETIME_MS}ms linear forwards`,
            }}>
            <SparkleIcon size={sparkle.size} color={sparkle.color} />
          </span>
        </span>
      ))}
      <span style={{position: 'relative', zIndex: 1}}>
        {children}
      </span>
    </span>
  );
}
