/** WCAG's relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG's contrast ratio of two `#rrggbb` colours. */
export const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** An `rgba(r, g, b, a)` wash laid over a `#rrggbb` ground, as the colour it paints. */
export function over(wash: string, ground: string): string {
  const [r, g, b, alpha] = (wash.match(/[\d.]+/g) ?? []).map(Number);
  return `#${[r, g, b]
    .map((channel, at) => {
      const below = parseInt(ground.slice(1 + at * 2, 3 + at * 2), 16);
      return Math.round(channel * alpha + below * (1 - alpha))
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}
