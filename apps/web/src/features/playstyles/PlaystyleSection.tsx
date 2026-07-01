import type {ReactNode} from 'react';
import {COLORS, FONTS, FONT_SIZES} from '../../shared/constants';

export interface PlaystyleSectionProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** A gallery section: heading + one-line subtitle + a responsive fan-tile grid. */
export function PlaystyleSection({title, subtitle, children}: PlaystyleSectionProps) {
  return (
    <section style={{marginTop: 28}}>
      <h2 style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700, color: COLORS.text, margin: 0}}>{title}</h2>
      <p style={{fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted, margin: '4px 0 14px'}}>{subtitle}</p>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16}}>{children}</div>
    </section>
  );
}
