// Higher-level category describing how a synergy creates value
export type SynergyCategory = 'direct' | 'playstyle';

// Known playstyle identifiers — update this union when adding new playstyles
export type PlaystyleId = 'lore-denial' | 'location-control' | 'discard';

// A playstyle groups related synergy rules that reinforce the same way of playing.
// The more cards supporting a playstyle, the more consistent the deck becomes.
export interface Playstyle {
  id: PlaystyleId;
  name: string;
  description: string; // Shown in UI as group explanation
}
