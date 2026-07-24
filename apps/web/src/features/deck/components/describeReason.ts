// Turns a raw rankSuggestions reason string into a friendly one-liner for the
// SuggestionList (#471). The engine emits terse/jargon reasons; this is the
// view-layer rewording. Unknown reasons pass through unchanged so a new engine
// reason degrades gracefully instead of vanishing.

const FIXED: Record<string, string> = {
  'Fills removal gap': "Adds removal you're short on",
  'Fills card-draw gap': "Adds card draw you're short on",
  'BECKON enabler for Merida': 'Feeds your Merida engine',
  'Shift target for a card in the deck': 'A Shift target for your deck',
  'On-curve Song for a Singer': 'A song your singers can play free',
};

export function describeReason(reason: string): string {
  const fixed = FIXED[reason];
  if (fixed) return fixed;

  const curve = reason.match(/^Fills curve hole at cost (\d+)$/);
  if (curve) return `Fills a gap at ${curve[1]} cost`;

  const synergy = reason.match(/^Synergizes with (\d+) deck cards?$/);
  if (synergy) return `Works with ${synergy[1]} of your cards`;

  return reason;
}
